# Glossary Entry PR Creation Workflow Improvement Plan

## Overview
This development plan outlines the necessary tasks to improve the GitHub PR workflow in the `create-pr.ts` file to implement proper idempotency, ensuring that the workflow can run multiple times without creating duplicate resources. The improvements will follow the proposed approach while maintaining compatibility with the existing implementation.
## GUIDELINES 

### 1. Core Workflow Implementation
- [ ] Implement file check in base branch
  - [ ] Add function to check if file exists in main branch with identical content
  - [ ] Implement early return if file exists and is identical
- [ ] Implement branch discovery system
  - [ ] Use consistent branch naming pattern (keep `richard/add_${slug}` prefix)
  - [ ] List branches matching the pattern for the given glossary term
  - [ ] Filter branches to find the most relevant ones
- [ ] Implement PR status check
  - [ ] Check for open PRs related to the branches
  - [ ] Check for recently merged PRs related to the branches
- [ ] Implement the case-based handling logic
  - [ ] Case 1: File exists + identical content + PR exists → Return existing PR
  - [ ] Case 2: File exists + identical content + No PR → Create PR from branch
  - [ ] Case 3: File exists + different content + PR exists → Update file
  - [ ] Case 4: File exists + different content + No PR → Update and create PR
  - [ ] Case 5: File doesn't exist + PR exists → Create file in branch
  - [ ] Case 6: File doesn't exist + No PR → Create branch, file, and PR
- [ ] Fix the linter error with `existingPr.data[0].html_url`
  - [ ] Correctly access the PR URL property

### 2. Error Handling and Logging
- [ ] Enhance error handling throughout the workflow
  - [ ] Use the existing `tryCatch` utility consistently
  - [ ] Add specific error messages for each failure case
- [ ] Improve logging
  - [ ] Add comprehensive logging for each step of the process
  - [ ] Include details about which case is being handled


### 3. Documentation
- [ ] Update code comments
  - [ ] Document the overall workflow strategy
  - [ ] Document each helper function
  - [ ] Document case handling logic
  - [ ] Explain the idempotent behavior of the workflow

### 4. Integration
- [ ] Ensure backward compatibility
  - [ ] Maintain existing branch naming conventions
  - [ ] Preserve existing log message format
  - [ ] Keep the same return structure
- [ ] Verify integration with dependent systems
  - [ ] Check database interactions
  - [ ] Verify file content generation works with the new flow

### 5. Performance Optimization
- [ ] Implement parallel processing where appropriate
  - [ ] Process branch checks in parallel
  - [ ] Use Promise.all for multiple GitHub API calls
- [ ] Add caching for frequent operations
  - [ ] Cache file content comparisons
  - [ ] Cache branch listing results

### 6. Logging
- [ ] use console.info to log useful infos about the status of the pr creation to a user

## Pseudo Proposal Code

Stay close to this suggestion. Keep in mind that this is pseudo code though, but the coding style and general logic makes sense.

Make sure you follow the above guidelines at all times and are opinionated about the changes you make.

Stay as close as possible to the original outcomes as possible while adopting the coding style & logic flow from this proposal

```ts
import { Octokit } from "@octokit/rest";
import { components } from "@octokit/openapi-types"; // use the types from @octokit/rest if available, only use this if they're not available

// Using Octokit's types for parameters and returns
type ReposGetContentParams = Parameters<Octokit["repos"]["getContent"]>[0];
type PullsCreateParams = Parameters<Octokit["pulls"]["create"]>[0];
type ReposCreateOrUpdateFileContentsParams = Parameters<Octokit["repos"]["createOrUpdateFileContents"]>[0];
type PullRequest = components["schemas"]["pull-request"];
type ContentFile = components["schemas"]["content-file"];

/**
 * Creates or updates a file in a repository and creates a PR, handling idempotency.
 * This function checks for existing branches and PRs to avoid duplication.
 */
async function task...(term: string) {
    // ...content generation above...


  // Constants for the workflow
  const owner = "github-org";
  const repo = "docs-repo";
  const baseBranch = "main";
  const branchPrefix = "update-docs";
  const filePath = `docs/${term}.mdx`;
  const commitMessage = `Update ${term} documentation`;
  const prTitle = `Documentation: Update ${term}`;
  const prBody = `This PR updates the documentation for ${term}.`;
  
  // Assume content is created earlier
  const content = "# Documentation\n\nThis is the updated content.";
  const contentBase64 = Buffer.from(content).toString("base64");

  // Step 1: Check if file exists in main branch
  const mainFileResult = await tryCatch(
    octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: baseBranch
    })
  );

  // If file exists and is identical, early return
  if (mainFileResult.data) {
    const mainFile = mainFileResult.data.data as ContentFile;
    
    if ("content" in mainFile) {
      // Clean up base64 content (GitHub might add newlines)
      const mainFileContent = mainFile.content.replace(/\n/g, "");
      
      // Compare file content
      if (mainFileContent === contentBase64) {
        console.log("File already exists with identical content in base branch");
        return { 
          action: "no-changes-needed" 
        };
      }
    }
  }

  // Step 2: List branches that match our pattern
  const branchResult = await tryCatch(
    octokit.repos.listBranches({
      owner,
      repo
    })
  );

  // Process branches if we have results
  if (branchResult.data) {
    // Filter branches that match our pattern
    const filePathSlug = filePath.replace(/\//g, "-");
    const relevantBranches = branchResult.data.data
      .filter(branch => branch.name.startsWith(`${branchPrefix}-${filePathSlug}`))
      .map(branch => branch.name);
    
    console.log(`Found ${relevantBranches.length} relevant branches`);
    
    // Process branches in parallel
    const branchProcessResults = await Promise.all(
      relevantBranches.map(async (branch) => {
        // Get file content in this branch (if it exists)
        const fileResult = await tryCatch(
          octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch
          })
        );
        
        // Check for open PRs from this branch
        const prsResult = await tryCatch(
          octokit.pulls.list({
            owner,
            repo,
            head: `${owner}:${branch}`,
            base: baseBranch,
            state: "open"
          })
        );
        
        const prs = prsResult.data?.data || [];
        const prExists = prs.length > 0;
        const openPr = prExists ? prs[0] : null;
        
        // Determine if file exists and if it's identical
        let fileExists = false;
        let fileIsIdentical = false;
        let fileSha = undefined;
        
        if (fileResult.data) {
          const branchFile = fileResult.data.data as ContentFile;
          fileExists = true;
          
          if ("content" in branchFile) {
            const branchFileContent = branchFile.content.replace(/\n/g, "");
            fileIsIdentical = branchFileContent === contentBase64;
            fileSha = branchFile.sha;
          }
        }
        
        return {
          branch,
          fileExists,
          fileIsIdentical,
          fileSha,
          prExists,
          openPr
        };
      })
    );
    
    // Find the first usable branch
    for (const result of branchProcessResults) {
      const { branch, fileExists, fileIsIdentical, fileSha, prExists, openPr } = result;
      
      // Create a case key that covers all scenarios
      // This handles both file existence and PR existence
      // We have 2 boolean states (file exists/identical and PR exists) creating 6 possible cases
      const caseKey = `${fileExists ? (fileIsIdentical ? "identical" : "different") : "missing"}:${prExists ? "pr-exists" : "no-pr"}`;
      
      console.log(`Handling case for branch ${branch}: ${caseKey}`);
      
      switch (caseKey) {
        case "identical:pr-exists":
          // Case 1: File exists, is identical, and PR exists
          console.log("File is identical and PR exists, returning existing PR");
          return {
            action: "found-existing-pr",
            pr: openPr
          };
          
        case "identical:no-pr":
          // Case 2: File exists, is identical, but no PR
          console.log("File is identical but no PR exists, creating PR");
          const newPr1Result = await tryCatch(
            octokit.pulls.create({
              owner,
              repo,
              title: prTitle,
              body: prBody,
              head: branch,
              base: baseBranch
            })
          );
          
          if (!newPr1Result.data) {
            console.log("Failed to create PR, trying next branch");
            continue;
          }
          
          return {
            action: "created-pr-from-existing-branch",
            pr: newPr1Result.data.data
          };
          
        case "different:pr-exists":
          // Case 3: File exists, is different, and PR exists
          console.log("File is different and PR exists, updating file");
          const updateResult1 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: filePath,
              message: commitMessage,
              content: contentBase64,
              branch: branch,
              sha: fileSha
            })
          );
          
          if (!updateResult1.data) {
            console.log("Failed to update file, trying next branch");
            continue;
          }
          
          return {
            action: "updated-file-in-existing-pr",
            pr: openPr
          };
          
        case "different:no-pr":
          // Case 4: File exists, is different, and no PR
          console.log("File is different and no PR exists, updating file and creating PR");
          const updateResult2 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: filePath,
              message: commitMessage,
              content: contentBase64,
              branch: branch,
              sha: fileSha
            })
          );
          
          if (!updateResult2.data) {
            console.log("Failed to update file, trying next branch");
            continue;
          }
          
          const newPr2Result = await tryCatch(
            octokit.pulls.create({
              owner,
              repo,
              title: prTitle,
              body: prBody,
              head: branch,
              base: baseBranch
            })
          );
          
          if (!newPr2Result.data) {
            console.log("Failed to create PR, trying next branch");
            continue;
          }
          
          return {
            action: "updated-file-and-created-pr",
            pr: newPr2Result.data.data
          };
          
        case "missing:pr-exists":
          // Case 5: File doesn't exist, but PR exists
          console.log("File doesn't exist but PR exists, creating file in branch");
          const createResult1 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: filePath,
              message: commitMessage,
              content: contentBase64,
              branch: branch
            })
          );
          
          if (!createResult1.data) {
            console.log("Failed to create file, trying next branch");
            continue;
          }
          
          return {
            action: "created-file-in-existing-pr",
            pr: openPr
          };
          
        case "missing:no-pr":
          // Case 6: File doesn't exist and no PR
          console.log("File doesn't exist and no PR exists, creating file and PR");
          const createResult2 = await tryCatch(
            octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: filePath,
              message: commitMessage,
              content: contentBase64,
              branch: branch
            })
          );
          
          if (!createResult2.data) {
            console.log("Failed to create file, trying next branch");
            continue;
          }
          
          const newPr3Result = await tryCatch(
            octokit.pulls.create({
              owner,
              repo,
              title: prTitle,
              body: prBody,
              head: branch,
              base: baseBranch
            })
          );
          
          if (!newPr3Result.data) {
            console.log("Failed to create PR, trying next branch");
            continue;
          }
          
          return {
            action: "created-file-and-pr-in-existing-branch",
            pr: newPr3Result.data.data
          };
      }
    }
  }

  // Step 3: No usable branch found, create new branch and PR
  console.log("Creating new branch and PR");
  
  // Generate a unique branch name
  const timestamp = new Date().getTime();
  const filePathSlug = filePath.replace(/\//g, "-");
  const newBranchName = `${branchPrefix}-${filePathSlug}-${timestamp}`;
  
  // Get the SHA of the latest commit on the base branch
  const refResult = await tryCatch(
    octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })
  );
  
  if (!refResult.data) {
    console.log("Failed to get ref for base branch");
    throw new Error(`Failed to get ref for base branch ${baseBranch}`);
  }
  
  // Create new branch
  const createBranchResult = await tryCatch(
    octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: refResult.data.data.object.sha
    })
  );
  
  if (!createBranchResult.data) {
    console.log("Failed to create branch");
    throw new Error(`Failed to create branch ${newBranchName}`);
  }
  
  // Create file in the new branch
  const createFileResult = await tryCatch(
    octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: contentBase64,
      branch: newBranchName
    })
  );
  
  if (!createFileResult.data) {
    console.log("Failed to create file");
    throw new Error(`Failed to create file ${filePath} in branch ${newBranchName}`);
  }
  
  // Create PR
  const createPrResult = await tryCatch(
    octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: newBranchName,
      base: baseBranch
    })
  );
  
  if (!createPrResult.data) {
    console.log("Failed to create PR");
    throw new Error(`Failed to create PR from branch ${newBranchName}`);
  }
  
  return {
    action: "created-new-branch-and-pr",
    pr: createPrResult.data.data
  };
}

/**
 * Wraps a promise to return either a success value or an error
 * @param promise The promise to wrap
 * @returns A Result object with either data or error
 */
async function tryCatch<T, E = Error>(promise: Promise<T>) {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}
```