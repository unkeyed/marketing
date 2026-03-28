import { db } from "@/lib/db-marketing/client";
import { entries } from "@/lib/db-marketing/schemas";
import type { CacheStrategy } from "@/lib/types";
import { withRetry } from "@/lib/utils/retry";
import { tryCatch } from "@/lib/utils/try-catch";
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import GithubSlugger from "github-slugger";
import yaml from "js-yaml";

export async function commitToBranchStep({
  input,
  onCacheHit = "stale" as CacheStrategy,
}: {
  input: string;
  onCacheHit?: CacheStrategy;
}) {
  return withRetry(
    async () => {
      const owner = process.env.NODE_ENV === "production" ? "unkeyed" : "unkeyed";
      const repo = "marketing";
      console.info(`[commit][owner:${owner}][repo:${repo}][term:${input}] Start branch commit`);

      const existing = await db.query.entries.findFirst({
        where: eq(entries.inputTerm, input),
        columns: {
          id: true,
          inputTerm: true,
          githubPrUrl: true,
          takeaways: true,
        },
        orderBy: (entries, { asc }) => [asc(entries.createdAt)],
      });
      if (existing?.githubPrUrl && onCacheHit === "stale") {
        console.info(
          `[commit][term:${input}] Cache hit, returning branch: ${existing.githubPrUrl}`,
        );
        return {
          entry: {
            id: existing.id,
            inputTerm: existing.inputTerm,
            branch: existing.githubPrUrl,
          },
        };
      }

      const entry = await db.query.entries.findFirst({
        where: eq(entries.inputTerm, input),
        orderBy: (entries, { asc }) => [asc(entries.createdAt)],
      });
      if (!entry?.dynamicSectionsContent) {
        throw new Error(`Unable to commit: No content available for term: ${input}.`);
      }
      if (!entry.takeaways) {
        throw new Error(`Unable to commit: No takeaways available for term: ${input}.`);
      }

      const slugger = new GithubSlugger();
      const slug = slugger.slug(entry.inputTerm);
      const yamlString = yaml.dump(
        {
          title: entry.metaTitle,
          description: entry.metaDescription,
          h1: entry.metaH1,
          term: entry.inputTerm,
          categories: entry.categories,
          takeaways: entry.takeaways,
          faq: entry.faq,
          updatedAt: entry.updatedAt,
          slug,
        },
        {
          sortKeys: (a, b) => (a === "question" ? -1 : b === "question" ? 1 : 0),
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        },
      );
      const frontmatter = `---\n${yamlString}---\n`;
      const mdxContent = `${frontmatter}${entry.dynamicSectionsContent}`;
      const contentBase64 = Buffer.from(mdxContent).toString("base64");
      const baseBranch = "main";
      const branchPrefix = `glossary/add_${slug}`;
      const filePath = `apps/www/content/glossary/${slug}.mdx`;
      const commitMessage = `feat(glossary): Add or update ${input}.mdx in glossary`;
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
            console.info(`[commit][term:${input}] File identical in main, nothing to do`);
            return {
              entry: { id: entry.id, inputTerm: entry.inputTerm, branch: baseBranch },
            };
          }
        }
      }

      // Check for existing branch and update file if found
      const branchListResult = await tryCatch(octokit.repos.listBranches({ owner, repo }));
      const allBranches = branchListResult.data?.data || [];
      const relevantBranches = allBranches
        .filter((b: any) => b.name.startsWith(branchPrefix))
        .map((b: any) => b.name);

      if (relevantBranches.length > 0) {
        const branch = relevantBranches[0];

        // Get existing file SHA in branch (needed for update)
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

        // Commit updated file to existing branch
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

        await db.update(entries).set({ githubPrUrl: branch }).where(eq(entries.inputTerm, input));

        console.info(`[commit][term:${input}] Updated file in existing branch: ${branch}`);
        return {
          entry: { id: entry.id, inputTerm: entry.inputTerm, branch },
        };
      }

      // Create new branch and commit
      const newBranchName = `${branchPrefix}_${Date.now()}`;
      const refResult = await tryCatch(
        octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` }),
      );
      if (!refResult.data) {
        throw new Error(`Failed to get ref for base branch ${baseBranch}`);
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
        throw new Error(`Failed to create file ${filePath} in branch ${newBranchName}`);
      }

      await db
        .update(entries)
        .set({ githubPrUrl: newBranchName })
        .where(eq(entries.inputTerm, input));

      console.info(`[commit][term:${input}] Created branch and committed: ${newBranchName}`);
      return {
        entry: { id: entry.id, inputTerm: entry.inputTerm, branch: newBranchName },
      };
    },
    { maxAttempts: 3, label: "commitToBranch" },
  );
}
