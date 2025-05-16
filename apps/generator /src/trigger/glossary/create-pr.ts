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
    console.info(`🟢 [createPrTask][term:${input}] Start PR creation`);
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
      console.info(`✅ [createPrTask][term:${input}] Cache hit, returning PR: ${existing.githubPrUrl}`);
      return { entry: { id: existing.id, inputTerm: existing.inputTerm, githubPrUrl: existing.githubPrUrl } };
    }

    // 2. Prepare MDX file content
    console.info(`📄 [createPrTask][term:${input}] Preparing MDX file`);
    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { asc }) => [asc(entries.createdAt)],
    });
    if (!entry?.dynamicSectionsContent) {
      console.error(`❌ [createPrTask][term:${input}] No dynamicSectionsContent found`);
      throw new AbortTaskRunError(
        `Unable to create PR: The markdown content for the dynamic sections are not available for the entry to term: ${input}. It's likely that draft-sections.ts didn't run as expected .`,
      );
    }
    if (!entry.takeaways) {
      console.error(`❌ [createPrTask][term:${input}] No takeaways found`);
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
    console.info(`🔍 [createPrTask][term:${input}] Check file in main branch`);
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
      console.info(`🟢 [createPrTask][term:${input}] File identical in main, early return`);
      return { entry: { id: entry.id, inputTerm: entry.inputTerm, githubPrUrl: entry.githubPrUrl } };
    } else if (fileExistsInMain) {
      console.info(`🟡 [createPrTask][term:${input}] File exists in main, content differs`);
    } else {
      console.info(`🟠 [createPrTask][term:${input}] File missing in main`);
    }

    // 4. List all branches and filter for relevant ones (reuse branches)
    console.info(`🌿 [createPrTask][term:${input}] List all branches`);
    const branchListResult = await tryCatch(
      octokit.repos.listBranches({ owner, repo })
    );
    if (branchListResult.error) {
      console.error(`❌ [createPrTask][term:${input}] Failed to list branches: ${branchListResult.error}`);
      throw new AbortTaskRunError(`Failed to list branches: ${branchListResult.error}`);
    }
    const allBranches = branchListResult.data?.data || [];
    const relevantBranches = allBranches
      .filter((b: any) => b.name.startsWith(branchPrefix))
      .map((b: any) => b.name);
    console.info(`🌿 [createPrTask][term:${input}] Found ${relevantBranches.length} branches for slug '${slug}'`);

    // 5. For each relevant branch, check file content and PR status (only first branch)
    if (relevantBranches.length > 0) {
      const branch = relevantBranches[0];
      console.info(`🔄 [createPrTask][branch:${branch}] Start branch check`);
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
      // Add branch existence to the caseKey for both logic and logging
      const branchExists = true;
      const caseKey = `${branchExists ? 'branch-existant' : 'branch-inexistant'}:${branchFileIsIdentical ? 'fileDiff-unchanged' : branchFileExists ? 'fileDiff-changed' : 'fileDiff-unchanged'}:${prExists ? 'pr-existant' : 'pr-inexistant'}`;
      // Branch summary log
      console.info(`🔄 [createPrTask][branch:${branch}] file:${branchFileExists ? (branchFileIsIdentical ? 'unchanged' : 'changed') : 'missing'} pr:${prExists ? 'open' : 'none'}`);
      console.info(`⚡ [createPrTask][branch:${branch}] Case: ${caseKey}`);
      switch (caseKey) {
        case "branch-existant:fileDiff-unchanged:pr-existant":
          // Case 1: File exists, is identical, and PR exists
          console.info(`✅ [createPrTask][branch:${branch}] File unchanged, PR exists: ${openPr?.html_url}`);
          if (openPr && openPr.html_url) {
            await db.update(entries).set({ githubPrUrl: openPr.html_url }).where(eq(entries.inputTerm, input));
          }
          return { entry: { id: entry.id, inputTerm: entry.inputTerm, githubPrUrl: openPr?.html_url } };
        case "branch-existant:fileDiff-unchanged:pr-inexistant":
          // Case 2: File exists, is identical, but no PR
          console.info(`⚡ [createPrTask][branch:${branch}] File unchanged, creating PR`);
          const newPr1Result = await tryCatch(
            octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: branch, base: baseBranch })
          );
          if (!newPr1Result.data) {
            console.error(`❌ [createPrTask][branch:${branch}] Failed to create PR`);
            throw new AbortTaskRunError("Failed to create PR for existing branch");
          }
          await db.update(entries).set({ githubPrUrl: newPr1Result.data.data.html_url }).where(eq(entries.inputTerm, input));
          return { entry: { id: entry.id, inputTerm: entry.inputTerm, githubPrUrl: newPr1Result.data.data.html_url } };
        case "branch-existant:fileDiff-changed:pr-existant":
          // Case 3: File exists, is different, and PR exists
          console.info(`⚡ [createPrTask][branch:${branch}] File changed, updating file in PR`);
          const updateResult1 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch, sha: branchFileSha })
          );
          if (!updateResult1.data) {
            console.error(`❌ [createPrTask][branch:${branch}] Failed to update file`);
            throw new AbortTaskRunError("Failed to update file in existing branch");
          }
          if (openPr && openPr.html_url) {
            await db.update(entries).set({ githubPrUrl: openPr.html_url }).where(eq(entries.inputTerm, input));
          }
          return { entry: { id: entry.id, inputTerm: entry.inputTerm, githubPrUrl: openPr?.html_url } };
        case "branch-existant:fileDiff-changed:pr-inexistant":
          // Case 4: File exists, is different, and no PR
          console.info(`⚡ [createPrTask][branch:${branch}] File changed, updating file and creating PR`);
          const updateResult2 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch, sha: branchFileSha })
          );
          if (!updateResult2.data) {
            console.error(`❌ [createPrTask][branch:${branch}] Failed to update file`);
            throw new AbortTaskRunError("Failed to update file in existing branch");
          }
          const newPr2Result = await tryCatch(
            octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: branch, base: baseBranch })
          );
          if (!newPr2Result.data) {
            console.error(`❌ [createPrTask][branch:${branch}] Failed to create PR`);
            throw new AbortTaskRunError("Failed to create PR for updated branch");
          }
          await db.update(entries).set({ githubPrUrl: newPr2Result.data.data.html_url }).where(eq(entries.inputTerm, input));
          return { entry: { id: entry.id, inputTerm: entry.inputTerm, githubPrUrl: newPr2Result.data.data.html_url } };
      }
    }

    // 7. No usable branch found, create new branch and PR
    console.info(`🆕 [createPrTask][term:${input}] No branch, creating new branch/PR`);
    const timestamp = Date.now();
    const newBranchName = `${branchPrefix}_${timestamp}`;
    // Get the SHA of the latest commit on the base branch
    console.info(`🔍 [createPrTask][branch:${newBranchName}] Get SHA for base branch`);
    const refResult = await tryCatch(
      octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` })
    );
    if (!refResult.data) {
      console.error(`❌ [createPrTask][branch:${newBranchName}] Failed to get ref for base branch`);
      throw new AbortTaskRunError(`Failed to get ref for base branch ${baseBranch}`);
    }
    // Create new branch
    console.info(`🌿 [createPrTask][branch:${newBranchName}] Creating branch`);
    const createBranchResult = await tryCatch(
      octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranchName}`, sha: refResult.data.data.object.sha })
    );
    if (!createBranchResult.data) {
      console.error(`❌ [createPrTask][branch:${newBranchName}] Failed to create branch`);
      throw new AbortTaskRunError(`Failed to create branch ${newBranchName}`);
    }
    // Create file in the new branch
    console.info(`📄 [createPrTask][branch:${newBranchName}] Creating file`);
    const createFileResult = await tryCatch(
      octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: commitMessage, content: contentBase64, branch: newBranchName })
    );
    if (!createFileResult.data) {
      console.error(`❌ [createPrTask][branch:${newBranchName}] Failed to create file`);
      throw new AbortTaskRunError(`Failed to create file ${filePath} in branch ${newBranchName}`);
    }
    // Create PR
    console.info(`⚡ [createPrTask][branch:${newBranchName}] Creating PR`);
    const createPrResult = await tryCatch(
      octokit.pulls.create({ owner, repo, title: prTitle, body: prBody, head: newBranchName, base: baseBranch })
    );
    if (!createPrResult.data) {
      console.error(`❌ [createPrTask][branch:${newBranchName}] Failed to create PR`);
      throw new AbortTaskRunError(`Failed to create PR from branch ${newBranchName}`);
    }
    await db.update(entries).set({ githubPrUrl: createPrResult.data.data.html_url }).where(eq(entries.inputTerm, input));
    console.info(`✅ [createPrTask][term:${input}] Done, PR: ${createPrResult.data.data.html_url}`);
    return { entry: { id: entry.id, inputTerm: entry.inputTerm, githubPrUrl: createPrResult.data.data.html_url } };
  },
});
