import { db } from "@/lib/db-marketing/client";
import { blogPosts } from "@/lib/db-marketing/schemas/blog-posts";
import type { CacheStrategy } from "@/lib/types";
import { withRetry } from "@/lib/utils/retry";
import { tryCatch } from "@/lib/utils/try-catch";
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import GithubSlugger from "github-slugger";
import yaml from "js-yaml";

export async function commitBlogToBranchStep({
  blogPostId,
  onCacheHit = "stale",
}: {
  blogPostId: number;
  onCacheHit?: CacheStrategy;
}) {
  return withRetry(
    async () => {
      const owner = process.env.NODE_ENV === "production" ? "unkeyed" : "unkeyed";
      const repo = "marketing";

      const post = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.id, blogPostId),
      });

      if (!post) {
        throw new Error(`Blog post ${blogPostId} not found`);
      }

      if (post.githubPrUrl && onCacheHit === "stale") {
        console.info(`[blog-commit] Cache hit for blog post ${blogPostId}: ${post.githubPrUrl}`);
        return { blogPost: post, branch: post.githubPrUrl };
      }

      if (!post.content) {
        throw new Error(`Blog post ${blogPostId} has no content.`);
      }

      const slugger = new GithubSlugger();
      const slug = post.slug || slugger.slug(post.keyTerms.join("-"));

      if (!post.slug) {
        await db.update(blogPosts).set({ slug }).where(eq(blogPosts.id, blogPostId));
      }

      const yamlString = yaml.dump(
        {
          title: post.metaTitle || post.title,
          description: post.metaDescription,
          h1: post.metaH1,
          tags: post.keyTerms,
          audienceLevel: post.audienceLevel,
          updatedAt: post.updatedAt,
          slug,
        },
        {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        },
      );
      const frontmatter = `---\n${yamlString}---\n`;
      const mdxContent = `${frontmatter}${post.content}`;
      const contentBase64 = Buffer.from(mdxContent).toString("base64");
      const baseBranch = "main";
      const branchPrefix = `blog/add_${slug}`;
      const filePath = `apps/www/content/blog/${slug}.mdx`;
      const commitMessage = `feat(blog): Add or update ${slug}.mdx`;
      const octokit = new Octokit({ auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN });

      // Check if file is identical in main
      const mainFileResult = await tryCatch(
        octokit.repos.getContent({ owner, repo, path: filePath, ref: baseBranch }),
      );
      if (mainFileResult.data && !mainFileResult.error) {
        const mainFile = mainFileResult.data.data;
        if (mainFile && typeof mainFile === "object" && "content" in mainFile) {
          const mainFileContent = (mainFile.content as string).replace(/\n/g, "");
          if (mainFileContent === contentBase64) {
            console.info("[blog-commit] File identical in main, nothing to do");
            return { blogPost: post, branch: baseBranch };
          }
        }
      }

      // Check for existing branch
      const branchListResult = await tryCatch(octokit.repos.listBranches({ owner, repo }));
      const allBranches = branchListResult.data?.data || [];
      const relevantBranches = allBranches
        .filter((b: any) => b.name.startsWith(branchPrefix))
        .map((b: any) => b.name);

      if (relevantBranches.length > 0) {
        const branch = relevantBranches[0];

        const fileResult = await tryCatch(
          octokit.repos.getContent({ owner, repo, path: filePath, ref: branch }),
        );
        let branchFileSha: string | undefined;
        if (fileResult.data && !fileResult.error) {
          const branchFile = fileResult.data.data;
          if (branchFile && typeof branchFile === "object" && "sha" in branchFile) {
            branchFileSha = (branchFile as any).sha;
          }
        }

        const updateResult = await tryCatch(
          octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: commitMessage,
            content: contentBase64,
            branch,
            sha: branchFileSha,
          }),
        );
        if (!updateResult.data) {
          throw new Error(`Failed to update file in branch ${branch}`);
        }

        await db.update(blogPosts).set({ githubPrUrl: branch }).where(eq(blogPosts.id, blogPostId));
        console.info(`[blog-commit] Updated file in existing branch: ${branch}`);
        return { blogPost: { ...post, githubPrUrl: branch }, branch };
      }

      // Create new branch and commit
      const newBranchName = `${branchPrefix}_${Date.now()}`;
      const refResult = await tryCatch(
        octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` }),
      );
      if (!refResult.data) {
        throw new Error(`Failed to get ref for ${baseBranch}`);
      }

      const createBranchResult = await tryCatch(
        octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${newBranchName}`,
          sha: refResult.data.data.object.sha,
        }),
      );
      if (!createBranchResult.data) {
        throw new Error(`Failed to create branch ${newBranchName}`);
      }

      const createFileResult = await tryCatch(
        octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message: commitMessage,
          content: contentBase64,
          branch: newBranchName,
        }),
      );
      if (!createFileResult.data) {
        throw new Error(`Failed to create file ${filePath}`);
      }

      await db
        .update(blogPosts)
        .set({ githubPrUrl: newBranchName })
        .where(eq(blogPosts.id, blogPostId));
      console.info(`[blog-commit] Created branch and committed: ${newBranchName}`);
      return { blogPost: { ...post, githubPrUrl: newBranchName }, branch: newBranchName };
    },
    { maxAttempts: 3, label: "commitBlogToBranch" },
  );
}
