import { db } from "@/lib/db-marketing/client";
import { entries } from "@/lib/db-marketing/schemas";
import { tryCatch } from "@/lib/utils/try-catch";
import { withRetry } from "@/lib/utils/retry";
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import GithubSlugger from "github-slugger";
import yaml from "js-yaml";
import type { CacheStrategy } from "../generate-glossary-entry";

export async function createPrStep({
  input,
  onCacheHit = "stale" as CacheStrategy,
}: {
  input: string;
  onCacheHit?: CacheStrategy;
}) {
  return withRetry(
    async () => {
      const owner =
        process.env.NODE_ENV === "production" ? "unkeyed" : "unkeyed";
      const repo = "marketing";
      console.info(
        `[createPr][owner:${owner}][repo:${repo}][term:${input}] Start PR creation`,
      );
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
          `[createPr][owner:${owner}][repo:${repo}][term:${input}] Cache hit, returning PR: ${existing.githubPrUrl}`,
        );
        return {
          entry: {
            id: existing.id,
            inputTerm: existing.inputTerm,
            githubPrUrl: existing.githubPrUrl,
          },
        };
      }

      console.info(
        `[createPr][owner:${owner}][repo:${repo}][term:${input}] Preparing MDX file`,
      );
      const entry = await db.query.entries.findFirst({
        where: eq(entries.inputTerm, input),
        orderBy: (entries, { asc }) => [asc(entries.createdAt)],
      });
      if (!entry?.dynamicSectionsContent) {
        throw new Error(
          `Unable to create PR: The markdown content for the dynamic sections are not available for the entry to term: ${input}.`,
        );
      }
      if (!entry.takeaways) {
        throw new Error(
          `Unable to create PR: The takeaways are not available for the entry to term: ${input}.`,
        );
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
          sortKeys: (a, b) =>
            a === "question" ? -1 : b === "question" ? 1 : 0,
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
      const prTitle = `Add or update ${input} in Glossary`;
      const prBody = `This PR adds or updates the ${input}.mdx file in the API documentation.`;
      const octokit = new Octokit({
        auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
      });

      console.info(
        `[createPr][owner:${owner}][repo:${repo}][term:${input}] Check file in main branch`,
      );
      const mainFileResult = await tryCatch(
        octokit.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: baseBranch,
        }),
      );
      let fileExistsInMain = false;
      let fileIsIdenticalInMain = false;
      let _mainFileSha: string | undefined = undefined;
      if (mainFileResult.data && !mainFileResult.error) {
        const mainFile = mainFileResult.data.data;
        if (mainFile && typeof mainFile === "object" && "content" in mainFile) {
          fileExistsInMain = true;
          const mainFileContent = (mainFile.content as string).replace(
            /\n/g,
            "",
          );
          fileIsIdenticalInMain = mainFileContent === contentBase64;
          _mainFileSha = (mainFile as any).sha;
        }
      }
      if (fileExistsInMain && fileIsIdenticalInMain) {
        console.info(
          `[createPr][owner:${owner}][repo:${repo}][term:${input}] File identical in main, early return`,
        );
        return {
          entry: {
            id: entry.id,
            inputTerm: entry.inputTerm,
            githubPrUrl: entry.githubPrUrl,
          },
        };
      }

      console.info(
        `[createPr][owner:${owner}][repo:${repo}][term:${input}] List all branches`,
      );
      const branchListResult = await tryCatch(
        octokit.repos.listBranches({ owner, repo }),
      );
      if (branchListResult.error) {
        throw new Error(`Failed to list branches: ${branchListResult.error}`);
      }
      const allBranches = branchListResult.data?.data || [];
      const relevantBranches = allBranches
        .filter((b: any) => b.name.startsWith(branchPrefix))
        .map((b: any) => b.name);

      if (relevantBranches.length > 0) {
        const branch = relevantBranches[0];
        const fileResult = await tryCatch(
          octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch,
          }),
        );
        let branchFileExists = false;
        let branchFileIsIdentical = false;
        let branchFileSha: string | undefined = undefined;
        if (fileResult.data && !fileResult.error) {
          const branchFile = fileResult.data.data;
          if (
            branchFile &&
            typeof branchFile === "object" &&
            "content" in branchFile
          ) {
            branchFileExists = true;
            const branchFileContent = (branchFile.content as string).replace(
              /\n/g,
              "",
            );
            branchFileIsIdentical = branchFileContent === contentBase64;
            branchFileSha = (branchFile as any).sha;
          }
        }
        const prsResult = await tryCatch(
          octokit.rest.pulls.list({
            owner,
            repo,
            head: `${owner}:${branch}`,
            base: baseBranch,
            state: "open",
          }),
        );
        const prs = prsResult.data?.data || [];
        const prExists = prs.length > 0;
        const openPr = prExists ? prs[0] : null;
        const caseKey = `branch-existant:${branchFileIsIdentical ? "fileDiff-unchanged" : branchFileExists ? "fileDiff-changed" : "fileDiff-unchanged"}:${prExists ? "pr-existant" : "pr-inexistant"}`;
        console.info(
          `[createPr][owner:${owner}][repo:${repo}][branch:${branch}] Case: ${caseKey}`,
        );
        switch (caseKey) {
          case "branch-existant:fileDiff-unchanged:pr-existant":
            if (openPr?.html_url) {
              await db
                .update(entries)
                .set({ githubPrUrl: openPr.html_url })
                .where(eq(entries.inputTerm, input));
            }
            return {
              entry: {
                id: entry.id,
                inputTerm: entry.inputTerm,
                githubPrUrl: openPr?.html_url,
              },
            };
          case "branch-existant:fileDiff-unchanged:pr-inexistant": {
            const newPr1Result = await tryCatch(
              octokit.pulls.create({
                owner,
                repo,
                title: prTitle,
                body: prBody,
                head: branch,
                base: baseBranch,
              }),
            );
            if (!newPr1Result.data) {
              throw new Error("Failed to create PR for existing branch");
            }
            await db
              .update(entries)
              .set({ githubPrUrl: newPr1Result.data.data.html_url })
              .where(eq(entries.inputTerm, input));
            return {
              entry: {
                id: entry.id,
                inputTerm: entry.inputTerm,
                githubPrUrl: newPr1Result.data.data.html_url,
              },
            };
          }
          case "branch-existant:fileDiff-changed:pr-existant": {
            const updateResult1 = await tryCatch(
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
            if (!updateResult1.data) {
              throw new Error("Failed to update file in existing branch");
            }
            if (openPr?.html_url) {
              await db
                .update(entries)
                .set({ githubPrUrl: openPr.html_url })
                .where(eq(entries.inputTerm, input));
            }
            return {
              entry: {
                id: entry.id,
                inputTerm: entry.inputTerm,
                githubPrUrl: openPr?.html_url,
              },
            };
          }
          case "branch-existant:fileDiff-changed:pr-inexistant": {
            const updateResult2 = await tryCatch(
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
            if (!updateResult2.data) {
              throw new Error("Failed to update file in existing branch");
            }
            const newPr2Result = await tryCatch(
              octokit.pulls.create({
                owner,
                repo,
                title: prTitle,
                body: prBody,
                head: branch,
                base: baseBranch,
              }),
            );
            if (!newPr2Result.data) {
              throw new Error("Failed to create PR for updated branch");
            }
            await db
              .update(entries)
              .set({ githubPrUrl: newPr2Result.data.data.html_url })
              .where(eq(entries.inputTerm, input));
            return {
              entry: {
                id: entry.id,
                inputTerm: entry.inputTerm,
                githubPrUrl: newPr2Result.data.data.html_url,
              },
            };
          }
        }
      }

      console.info(
        `[createPr][owner:${owner}][repo:${repo}][term:${input}] No branch, creating new branch/PR`,
      );
      const timestamp = Date.now();
      const newBranchName = `${branchPrefix}_${timestamp}`;
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
        throw new Error(
          `Failed to create file ${filePath} in branch ${newBranchName}`,
        );
      }
      const createPrResult = await tryCatch(
        octokit.pulls.create({
          owner,
          repo,
          title: prTitle,
          body: prBody,
          head: newBranchName,
          base: baseBranch,
        }),
      );
      if (!createPrResult.data) {
        throw new Error(`Failed to create PR from branch ${newBranchName}`);
      }
      await db
        .update(entries)
        .set({ githubPrUrl: createPrResult.data.data.html_url })
        .where(eq(entries.inputTerm, input));
      console.info(
        `[createPr][owner:${owner}][repo:${repo}][term:${input}] Done, PR: ${createPrResult.data.data.html_url}`,
      );
      return {
        entry: {
          id: entry.id,
          inputTerm: entry.inputTerm,
          githubPrUrl: createPrResult.data.data.html_url,
        },
      };
    },
    { maxAttempts: 3, label: "createPr" },
  );
}
