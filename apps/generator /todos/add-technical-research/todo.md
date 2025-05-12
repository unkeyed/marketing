# Technical Research Integration TODO

## Add technical research

- [x] **Integrate Technical Research Step**
  - Add technical research before outline generation in `_generate-glossary-entry.ts` and persist output to the db within the technicalResearchTask.
  - **Before:**
    ```ts
    // Step 1: Keyword Research
    const keywordResearch = await keywordResearchTask.triggerAndWait({ term, onCacheHit });
    // Step 2: Generate Outline
    const outline = await generateOutlineTask.triggerAndWait({ term, onCacheHit });
    ```
  - **After:**
    ```ts
    // Step 1: Keyword Research
    const keywordResearch = await keywordResearchTask.triggerAndWait({ term, onCacheHit });
    
    // Step 1.5: Technical Research
    const technicalResearch = await technicalResearchTask.triggerAndWait({ term, onCacheHit });
    // ↓ technicalResearch.output persisted to db from here ↓
    
    // Step 2: Generate Outline
    const outline = await generateOutlineTask.triggerAndWait({ term, onCacheHit });
    ```
  - **To Implement**
    - Integrate the technical research step into _generate-glossary-entry.ts before outline generation.
    - Persist the technical research output in the database.
    - Update the DB schema if necessary to store the technical research output.
    - General refactoring: remove now-unused firecrawl references and queries from the entry point.

  - **How to test**
    - Trigger a glossary entry generation and verify that the technical research output is present and persisted in the database for the entry.


## Replace Firecrawl Consumers with Technical Research Context
**Status**: Ready to implement
**Task**
  - Replace Firecrawl-based context with Technical Research in content-generation workflows.

1. Context
   - Current:
     > We currently fetch top organic search results via `db.query.firecrawlResponses.findMany` and use those in each consumer task.
   - After:
     > We will query `entries.technicalResearch.included` (populated by the `technicalResearchTask`) for `url` and `summary`, and feed those into each consumer.
     ```ts
     const { technicalResearch } = await db.query.entries.findFirst({
       where: eq(entries.inputTerm, term),
       columns: { technicalResearch },
     });
     // Use `technicalResearch.included` instead of `firecrawlResponses`
     ```
   - Goal: Swap out Firecrawl-based context for our new Technical Research output.
   - Test for acceptance:
     1. Run `generateOutlineTask`, `draftSectionsTask`, and `contentTakeawaysTask` with a sample term.  
     2. Inspect DB queries to confirm they read from `entries.technicalResearch` instead of `firecrawlResponses`.  
     3. Verify each task still returns valid context summaries.

2. Todos  
**Note on sequential and parallel execution**:  
We must first update summary generation, then swap in each consumer task. Steps 2 and 3 can run in parallel.

  - [ ] **Update getOrCreateSummary to support Technical Research output**  
       File: `apps/generator /src/lib/firecrawl.ts` (lines 130–155)  
       Replace:
       ```ts
       // 1. Check for existing Firecrawl summary
       const existing = await db.query.firecrawlResponses.findFirst({
         where: eq(firecrawlResponses.sourceUrl, url),
       });
       const firecrawlResponse = await getOrCreateFirecrawlResponse({ url, connectTo });
       ```
       With:
       ```ts
       // Query the stored Technical Research entries
       const { technicalResearch } = await db.query.entries.findFirst({
         where: eq(entries.inputTerm, connectTo.term),
         columns: { technicalResearch },
       });
       const existing = technicalResearch.included.find(r => r.url === url);
       // Removed getOrCreateFirecrawlResponse usage
       ```
       - Changes:
         - Removed Firecrawl API and DB queries.  
         - Queried `entries.technicalResearch.included` for summaries.  
       - Test for acceptance:
         1. Call `getOrCreateSummary({ url, connectTo })` and confirm it returns the correct object from `entries.technicalResearch.included`.  
         2. Ensure no `db.query.firecrawlResponses` calls remain in this function.

  - [ ] **Update generateOutlineTask to use Technical Research**  
       File: `apps/generator /src/trigger/glossary/generate-outline.ts` (lines 70–77)  
       Replace:
       ```ts
       const organicResults = await db.query.firecrawlResponses.findMany({
         where: eq(firecrawlResponses.inputTerm, term),
         with: { serperOrganicResult: { columns: { position: true } } },
       });
       const summaries = await Promise.all(
         organicResults.map(result =>
           getOrCreateSummary({ url: result.sourceUrl, connectTo: { term }, onCacheHit }),
         ),
       );
       ```
       With:
       ```ts
       const { technicalResearch } = await db.query.entries.findFirst({
         where: eq(entries.inputTerm, term),
         columns: { technicalResearch },
       });
       const summaries = await Promise.all(
         technicalResearch.included.map(result =>
           getOrCreateSummary({ url: result.url, connectTo: { term }, onCacheHit }),
         ),
       );
       ```
       - Changes:
         - Switched context source to `technicalResearch.included`.  
       - Test for acceptance:
         1. Run `generateOutlineTask` and query the DB entry to verify each included item has a `summary` next to its `text` field.  
         2. Confirm no references to `firecrawlResponses` remain in this file.

  - [ ] **Update draftSectionsTask to use Technical Research**  
       File: `apps/generator /src/trigger/glossary/draft-sections.ts` (lines 170–178)  
       Replace:
       ```ts
       const organicResults = await db.query.firecrawlResponses.findMany({
         where: eq(firecrawlResponses.inputTerm, term),
         limit: 3,
       });
       // …
       ${organicResults.map(r => `Source URL: ${r.sourceUrl}\nSummary: ${r.summary}`).join("\n")}
       ```
       With:
       ```ts
       const { technicalResearch } = await db.query.entries.findFirst({
         where: eq(entries.inputTerm, term),
         columns: { technicalResearch },
       });
       const organicResults = technicalResearch.included.slice(0, 3);
       // …
       ${organicResults.map(r => `Source URL: ${r.url}\nSummary: ${r.summary}`).join("\n")}
       ```
       - Changes:
         - Updated to use `technicalResearch.included`.  
       - Test for acceptance:
         1. Run `draftSectionsTask` and inspect OTEL traces to ensure summaries match those in the DB.  
         2. Confirm removal of all `firecrawlResponses` queries.

  - [ ] **Update contentTakeawaysTask to use Technical Research**  
       File: `apps/generator /src/trigger/glossary/content-takeaways.ts` (lines 35–42)  
       Replace:
       ```ts
       const scrapedContent = await db.query.firecrawlResponses.findMany({
         where: eq(firecrawlResponses.inputTerm, term),
         columns: { markdown: true, summary: true },
       });
       // …
       ${scrapedContent.map(c => c.summary).join("\n\n")}
       ```
       With:
       ```ts
       const { technicalResearch } = await db.query.entries.findFirst({
         where: eq(entries.inputTerm, term),
         columns: { technicalResearch },
       });
       const scrapedContent = technicalResearch.included;
       // …
       ${scrapedContent.map(r => r.summary).join("\n\n")}
       ```
       - Changes:
         - Switched to `technicalResearch.included`.  
       - Test for acceptance:
         1. Run `contentTakeawaysTask` and verify AI SDK traces to confirm correct summaries.

3. **Exclusions**
   > The following code paths are related but out of scope for this PR:
   - `apps/generator /src/trigger/glossary/keyword-research.ts`  
     ```ts
     const keywordsFromHeaders = await getOrCreateKeywordsFromHeaders({ term });
     ```
     Reason: Keyword extraction is not part of replacing context in generation workflows.

   - `apps/generator /src/trigger/glossary/seo-meta-tags.ts`  
     ```ts
     const topRankingPages = await db.query.firecrawlResponses.findMany({
       where: eq(firecrawlResponses.inputTerm, term),
     });
     ```
     Reason: SEO meta tag generation remains unchanged in this pass.

   - `apps/generator /src/trigger/glossary/evals.ts`  
     ```ts
     export const getOrCreateRatingsTask = task({ … });
     ```
     Reason: Evaluation tasks will be refactored in a subsequent PR.

4. **Rules**
   - Cited rules:
     1. Avoid nested `if/else`; use Trigger.dev's built-in error handling (`tryCatch`) if needed.  
     2. Prefer TypeScript type inference; avoid explicit type annotations.  
   - Mentioned patterns:
     - Trigger.dev `.triggerAndWait` for workflow steps.  
     - Drizzle-ORM query methods (`findFirst`, `findMany`).  
