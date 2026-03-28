import { db } from "@/lib/db-marketing/client";
import { blogPosts } from "@/lib/db-marketing/schemas/blog-posts";
import type { CacheStrategy } from "@/lib/types";
import { tryCatch } from "@/lib/utils/try-catch";
import { withRetry } from "@/lib/utils/retry";
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import GithubSlugger from "github-slugger";
import yaml from "js-yaml";

export async function createBlogPrStep({
  blogPostId,
  onCacheHit = "stale",
}: {
  blogPostId: number;
  onCacheHit?: CacheStrategy;
}) {
  return withRetry(async () => {
    const owner = process.env.NODE_ENV === "production" ? "unkeyed" : "unkeyed";
    const repo = "marketing";

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, blogPostId),
    });

    if (!post) {
      throw new Error(`Blog post ${blogPostId} not found`);
    }

    if (post.githubPrUrl && onCacheHit === "stale") {
      console.info(`[blog-pr] Cache hit for blog post ${blogPostId}: ${post.githubPrUrl}`);
      return { blogPost: post };
    }

    if (!post.content) {
      throw new Error(`Blog post ${blogPostId} has no content.`);
    }

    const slugger = new GithubSlugger();
    const slug = post.slug || slugger.slug(post.keyTerms.join("-"));

    // Update slug if it wasn't set
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
    const prTitle = `Add or update blog post: ${post.title || slug}`;
    const prBody = `This PR adds or updates the blog post covering: ${post.keyTerms.join(", ")}.`;
    const octokit = new Octokit({ auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN });

    // Check if file exists in main
    const mainFileResult = await tryCatch(
      octokit.repos.getContent({ owner, repo, path: filePath, ref: baseBranch }),
    );
    let fileExistsInMain = false;
    let fileIsIdenticalInMain = false;
    if (mainFileResult.data && !mainFileResult.error) {
      const mainFile = mainFileResult.data.data;
      if (mainFile && typeof mainFile === "object" && "content" in mainFile) {
        fileExistsInMain = true;
        const mainFileContent = (mainFile.content as string).replace(/\n/g, "");
        fileIsIdenticalInMain = mainFileContent === contentBase64;
      }
    }
    if (fileExistsInMain && fileIsIdenticalInMain) {
      console.info(`[blog-pr] File identical in main, skipping PR`);
      return { blogPost: post };
    }

    // Check for existing branches
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

      // Update file in existing branch
      await tryCatch(
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

      // Check for existing PR
      const prsResult = await tryCatch(
        octokit.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, base: baseBranch, state: "open" }),
      );
      const prs = prsResult.data?.data || [];
      if (prs.length > 0) {
        await db.update(blogPosts).set({ githubPrUrl: prs[0].html_url }).where(eq(blogPosts.id, blogPostId));
        return { blogPost: { ...post, githubPrUrl: prs[0].html_url } };
      }

      // Create PR on existing branch
      const prResult = await tryCatch(
        octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: branch, base: baseBranch }),
      );
      if (prResult.data) {
        await db.update(blogPosts).set({ githubPrUrl: prResult.data.data.html_url }).where(eq(blogPosts.id, blogPostId));
        return { blogPost: { ...post, githubPrUrl: prResult.data.data.html_url } };
      }
    }

    // Create new branch and PR
    const newBranchName = `${branchPrefix}_${Date.now()}`;
    const refResult = await tryCatch(
      octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` }),
    );
    if (!refResult.data) {
      throw new Error(`Failed to get ref for ${baseBranch}`);
    }

    await tryCatch(
      octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranchName}`,
        sha: refResult.data.data.object.sha,
      }),
    );

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

    const createPrResult = await tryCatch(
      octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: newBranchName, base: baseBranch }),
    );
    if (!createPrResult.data) {
      throw new Error(`Failed to create PR from ${newBranchName}`);
    }

    const prUrl = createPrResult.data.data.html_url;
    await db.update(blogPosts).set({ githubPrUrl: prUrl }).where(eq(blogPosts.id, blogPostId));
    console.info(`[blog-pr] Created PR: ${prUrl}`);

    return { blogPost: { ...post, githubPrUrl: prUrl } };
  }, { maxAttempts: 3, label: "createBlogPr" });
}
