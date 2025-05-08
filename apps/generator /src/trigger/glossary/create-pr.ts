import { db } from "@/lib/db-marketing/client";
import { entries } from "@/lib/db-marketing/schemas";
import { tryCatch } from "@/lib/utils/try-catch";
import { Octokit } from "@octokit/rest";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";
import { eq, or } from "drizzle-orm";
import GithubSlugger from "github-slugger";
import yaml from "js-yaml"; // install @types/js-yaml?
import type { CacheStrategy } from "./_generate-glossary-entry";

// =====================
// GLOSSARY PR CREATION WORKFLOW (IDEMPOTENT, CASE-BASED)
// =====================

export const createPrTask = task({
  id: "create_pr",
  retry: {
    maxAttempts: 0,
  },
  run: async ({
    input,
    onCacheHit = "stale" as CacheStrategy,
  }: { input: string; onCacheHit?: CacheStrategy }) => {
    // 1. Check for existing PR URL in DB (cache hit)
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
      return { entry: existing };
    }

    // 2. Prepare MDX file content
    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { asc }) => [asc(entries.createdAt)],
    });
    if (!entry?.dynamicSectionsContent) {
      throw new AbortTaskRunError(
        `Unable to create PR: The markdown content for the dynamic sections are not available for the entry to term: ${input}. It's likely that draft-sections.ts didn't run as expected .`,
      );
    }
    if (!entry.takeaways) {
      throw new AbortTaskRunError(
        `Unable to create PR: The takeaways are not available for the entry to term: ${input}. It's likely that content-takeaways.ts didn't run as expected.`,
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
        sortKeys: (a, b) => (a === "question" ? -1 : b === "question" ? 1 : 0),
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
      },
    );
    const frontmatter = `---\n${yamlString}---\n`;
    const mdxContent = `${frontmatter}${entry.dynamicSectionsContent}`;
    const contentBase64 = Buffer.from(mdxContent).toString("base64");
    const owner = process.env.NODE_ENV === "production" ? "unkeyed" : "p6l-richard";
    const repo = "marketing";
    const baseBranch = "main";
    const branchPrefix = `richard/add_${slug}`;
    const filePath = `apps/www/content/glossary/${slug}.mdx`;
    const commitMessage = `feat(glossary): Add or update ${input}.mdx in glossary`;
    const prTitle = `Add or update ${input} in Glossary`;
    const prBody = `This PR adds or updates the ${input}.mdx file in the API documentation.`;
    const octokit = new Octokit({ auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN });

    // 3. Check if file exists in main branch and if content is identical
    const mainFileResult = await tryCatch(
      octokit.repos.getContent({ owner, repo, path: filePath, ref: baseBranch })
    );
    let fileExistsInMain = false;
    let fileIsIdenticalInMain = false;
    let mainFileSha: string | undefined = undefined;
    if (mainFileResult.data && !mainFileResult.error) {
      const mainFile = mainFileResult.data.data;
      if (mainFile && typeof mainFile === "object" && "content" in mainFile) {
        fileExistsInMain = true;
        const mainFileContent = (mainFile.content as string).replace(/\n/g, "");
        fileIsIdenticalInMain = mainFileContent === contentBase64;
        mainFileSha = (mainFile as any).sha;
      }
    }
    if (fileExistsInMain && fileIsIdenticalInMain) {
      console.info("File already exists with identical content in main branch. Early return.");
      return { entry };
    }

    // 4. List all branches and filter for relevant ones (reuse branches)
    const branchListResult = await tryCatch(
      octokit.repos.listBranches({ owner, repo })
    );
    if (branchListResult.error) {
      throw new AbortTaskRunError(`Failed to list branches: ${branchListResult.error}`);
    }
    const allBranches = branchListResult.data?.data || [];
    const relevantBranches = allBranches
      .filter((b: any) => b.name.startsWith(branchPrefix))
      .map((b: any) => b.name);
    console.info(`Found ${relevantBranches.length} relevant branches for slug '${slug}'.`);

    // 5. For each relevant branch, check file content and PR status in parallel
    const branchProcessResults = await Promise.all(
      relevantBranches.map(async (branch) => {
        // Get file content in this branch (if it exists)
        const fileResult = await tryCatch(
          octokit.repos.getContent({ owner, repo, path: filePath, ref: branch })
        );
        let branchFileExists = false;
        let branchFileIsIdentical = false;
        let branchFileSha: string | undefined = undefined;
        if (fileResult.data && !fileResult.error) {
          const branchFile = fileResult.data.data;
          if (branchFile && typeof branchFile === "object" && "content" in branchFile) {
            branchFileExists = true;
            const branchFileContent = (branchFile.content as string).replace(/\n/g, "");
            branchFileIsIdentical = branchFileContent === contentBase64;
            branchFileSha = (branchFile as any).sha;
          }
        }
        // Check for open PRs from this branch
        const prsResult = await tryCatch(
          octokit.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, base: baseBranch, state: "open" })
        );
        const prs = prsResult.data?.data || [];
        const prExists = prs.length > 0;
        const openPr = prExists ? prs[0] : null;
        return { branch, branchFileExists, branchFileIsIdentical, branchFileSha, prExists, openPr };
      })
    );

    // 6. Case-based handling logic (6 cases)
    for (const result of branchProcessResults) {
      const { branch, branchFileExists, branchFileIsIdentical, branchFileSha, prExists, openPr } = result;
      const caseKey = `${branchFileExists ? (branchFileIsIdentical ? "identical" : "different") : "missing"}:${prExists ? "pr-exists" : "no-pr"}`;
      console.info(`Handling case for branch ${branch}: ${caseKey}`);
      switch (caseKey) {
        case "identical:pr-exists":
          // Case 1: File exists, is identical, and PR exists
          console.info("File is identical and PR exists, returning existing PR");
          if (openPr && openPr.html_url) {
            await db.update(entries).set({ githubPrUrl: openPr.html_url }).where(eq(entries.inputTerm, input));
          }
          return { entry: { ...entry, githubPrUrl: openPr?.html_url } };
        case "identical:no-pr":
          // Case 2: File exists, is identical, but no PR
          console.info("File is identical but no PR exists, creating PR");
          const newPr1Result = await tryCatch(
            octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: branch, base: baseBranch })
          );
          if (!newPr1Result.data) {
            console.info("Failed to create PR, trying next branch");
            continue;
          }
          await db.update(entries).set({ githubPrUrl: newPr1Result.data.data.html_url }).where(eq(entries.inputTerm, input));
          return { entry: { ...entry, githubPrUrl: newPr1Result.data.data.html_url } };
        case "different:pr-exists":
          // Case 3: File exists, is different, and PR exists
          console.info("File is different and PR exists, updating file");
          const updateResult1 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch, sha: branchFileSha })
          );
          if (!updateResult1.data) {
            console.info("Failed to update file, trying next branch");
            continue;
          }
          if (openPr && openPr.html_url) {
            await db.update(entries).set({ githubPrUrl: openPr.html_url }).where(eq(entries.inputTerm, input));
          }
          return { entry: { ...entry, githubPrUrl: openPr?.html_url } };
        case "different:no-pr":
          // Case 4: File exists, is different, and no PR
          console.info("File is different and no PR exists, updating file and creating PR");
          const updateResult2 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch, sha: branchFileSha })
          );
          if (!updateResult2.data) {
            console.info("Failed to update file, trying next branch");
            continue;
          }
          const newPr2Result = await tryCatch(
            octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: branch, base: baseBranch })
          );
          if (!newPr2Result.data) {
            console.info("Failed to create PR, trying next branch");
            continue;
          }
          await db.update(entries).set({ githubPrUrl: newPr2Result.data.data.html_url }).where(eq(entries.inputTerm, input));
          return { entry: { ...entry, githubPrUrl: newPr2Result.data.data.html_url } };
        case "missing:pr-exists":
          // Case 5: File doesn't exist, but PR exists
          console.info("File doesn't exist but PR exists, creating file in branch");
          const createResult1 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch })
          );
          if (!createResult1.data) {
            console.info("Failed to create file, trying next branch");
            continue;
          }
          if (openPr && openPr.html_url) {
            await db.update(entries).set({ githubPrUrl: openPr.html_url }).where(eq(entries.inputTerm, input));
          }
          return { entry: { ...entry, githubPrUrl: openPr?.html_url } };
        case "missing:no-pr":
          // Case 6: File doesn't exist and no PR
          console.info("File doesn't exist and no PR exists, creating file and PR");
          const createResult2 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch })
          );
          if (!createResult2.data) {
            console.info("Failed to create file, trying next branch");
            continue;
          }
          const newPr3Result = await tryCatch(
            octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: branch, base: baseBranch })
          );
          if (!newPr3Result.data) {
            console.info("Failed to create PR, trying next branch");
            continue;
          }
          await db.update(entries).set({ githubPrUrl: newPr3Result.data.data.html_url }).where(eq(entries.inputTerm, input));
          return { entry: { ...entry, githubPrUrl: newPr3Result.data.data.html_url } };
      }
    }

    // 7. No usable branch found, create new branch and PR
    console.info("No usable branch found, creating new branch and PR");
    const timestamp = Date.now();
    const newBranchName = `${branchPrefix}_${timestamp}`;
    // Get the SHA of the latest commit on the base branch
    const refResult = await tryCatch(
      octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` })
    );
    if (!refResult.data) {
      throw new AbortTaskRunError(`Failed to get ref for base branch ${baseBranch}`);
    }
    // Create new branch
    const createBranchResult = await tryCatch(
      octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranchName}`, sha: refResult.data.data.object.sha })
    );
    if (!createBranchResult.data) {
      throw new AbortTaskRunError(`Failed to create branch ${newBranchName}`);
    }
    // Create file in the new branch
    const createFileResult = await tryCatch(
      octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch: newBranchName })
    );
    if (!createFileResult.data) {
      throw new AbortTaskRunError(`Failed to create file ${filePath} in branch ${newBranchName}`);
    }
    // Create PR
    const createPrResult = await tryCatch(
      octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: newBranchName, base: baseBranch })
    );
    if (!createPrResult.data) {
      throw new AbortTaskRunError(`Failed to create PR from branch ${newBranchName}`);
    }
    await db.update(entries).set({ githubPrUrl: createPrResult.data.data.html_url }).where(eq(entries.inputTerm, input));
    return { entry: { ...entry, githubPrUrl: createPrResult.data.data.html_url } };
  },
});
