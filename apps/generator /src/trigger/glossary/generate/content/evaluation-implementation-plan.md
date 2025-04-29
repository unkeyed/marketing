# Content Evaluation Implementation Plan

## Overview
This plan outlines the steps to implement a modular evaluation system for generated content, with both technical and SEO evaluations.

## Implementation Steps

### 1. Define Test Cases ✅ (Implemented)
- **[Done]** Created `evaluations-test.ts` file with test cases for:
  - Technical evaluation (existing functionality)
  - SEO evaluation (new functionality)
  - Combined evaluation task
- **[Done]** Used sample content for a glossary entry to test evaluations
- **[Done]** Followed pattern from `update-takeaways-test.ts` and `update-content-test.ts` for testing trigger.dev tasks using the `@/lib/test` imports
- **[Done]** Defined expected output schemas for each evaluation type
- **[Done]** Included test for handling evaluation failures

### 2. Create Evaluations Module
- Create new file: `evaluations.ts`
- Copy existing `reviewContentTask` (rename to `technicalReviewTask`) -- it's currently inside /Users/richardpoelderl/marketing/apps/generator /src/trigger/glossary/generate/content/generate-content.ts but should be inside evaluations.ts
- Add JSDoc comments explaining each task's purpose
- Define schemas for each evaluation type

### 3. Implement SEO Evaluation
- Create `seoReviewTask` with:
  - Same input/output structure as technical review 
  - SEO-focused system prompt and evaluation criteria
  - Appropriate metadata tracking

### 4. Create Combined Evaluation Task
- Implement `reviewGenerationTask` that:
  - Runs both evaluations in parallel
  - Tracks status of each evaluation in metadata
  - Handles partial failures (complete with available results)
  - Returns combined results

### 5. Update Main Generation Task
- Update `generateContentTask` to use new combined evaluation
- Replace call to `reviewContentTask` with `reviewGenerationTask`
- Update result handling

## Testing
- Run tests with sample content to verify:
  - Technical evaluation works as before
  - SEO evaluation provides useful insights
  - Combined task returns properly structured results

## Future Extensions
- The evaluations module can be extended with additional evaluation types:
  - Readability evaluation
  - Compliance evaluation
  - Content quality metrics 