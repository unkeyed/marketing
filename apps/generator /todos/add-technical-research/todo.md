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


## Add full technical reserach or summarized research to Drafting &  Review in outline & content generation

- [ ] **Replace firecrawlResponses with Technical Research Output in Outline Generation**
  - Use `exaResults` from technical research instead of firecrawl summaries.
  - **Before:**
    ```ts
    const organicResults = await db.query.firecrawlResponses.findMany({ ... });
    const summaries = await Promise.all(organicResults.map(...getOrCreateSummary...));
    const topRankingContent = summaries.map(...).join(...);
    ```
  - **After:**
    ```ts
    const technicalResearch = await getTechnicalResearchForTerm(term);
    const summaries = await Promise.all(technicalResearch.included.map(result => summarizeText(result.text, ...)));
    const technicalResearchSummaries = summaries.map(...).join(...);
    ```

- [ ] **Update getOrCreateSummary to Summarize Technical Research Texts**
  - **Before:**
    ```ts
    getOrCreateSummary({ url, connectTo, onCacheHit }) // uses firecrawl markdown
    ```
  - **After:**
    ```ts
    summarizeText({ text, term }) // uses technical research text
    ```

- [ ] **Update performTechnicalEvalTask to  Remove Caching**
  - **Before:**
    ```ts
    const existing = await db.query.evals.findFirst({ ... });
    if (existing && onCacheHit === "stale") { ... return ... }
    // context: summaries or none
    ```
  - **After:**
    ```ts
    // context: technicalResearchSummaries
    ```

- [ ] **Update contentTakeawaysTask to Use Technical Research Output**
  - **Before:**
    ```ts
    // context: firecrawlResponses summaries
    ```
  - **After:**
    ```ts
    // context: technicalResearchSummaries
    ```

- [ ] **Update performTechnicalEvalTask to Use Full Technical Research Texts and Remove Caching**
  - **Before:**
    ```ts
    const existing = await db.query.evals.findFirst({ ... });
    if (existing && onCacheHit === "stale") { ... return ... }
    // context: summaries or none
    ```
  - **After:**
    ```ts
    // No cache check, always run eval
    // context: technicalResearch.included.map(r => r.text)
    ```

- [ ] **Update reviewContent in draftSectionsTask to Use Full Technical Research Texts and Gemini**
  - **Before:**
    ```ts
    // context: firecrawl summaries, model: gpt-4o-mini
    ```
  - **After:**
    ```ts
    // context: technicalResearch.included.map(r => r.text), model: gemini
    ```

- [ ] **Audit Outline Revision Flow**
  - Ensure correct outline is passed between all eval steps and technical research context is available.
  - **Before:**
    ```ts
    // outline passed as is, context may be missing
    ```
  - **After:**
    ```ts
    // outline and technicalResearch context passed explicitly between steps
    ```

- [ ] **How to test**
  - For drafting steps (outline, draft sections, takeaways): Confirm that only technical research summaries are used as context and firecrawl data is not referenced anywhere.
  - For review/evaluation steps (technical eval, reviewContent): Confirm that the full technical research texts are used as context and the Gemini model is used for review/eval.
  - For outline revision: Confirm that the correct outline and technical research context are passed between all evaluation steps.

## Improved Results Evaluation

- [ ] **Filter Technical Research Results in evaluateSearchResults**
  - Update prompt to exclude irrelevant URLs (e.g., GitHub code repos, OWASP, MDN Add-ons).
  - **Before:**
    ```txt
    Evaluate these search results for relevance to: "${inputTerm}"
    // ...
    - Only give high ratings (7+) to older content if it's truly foundational
    ```
  - **After:**
    ```txt
    Evaluate these search results for relevance to: "${inputTerm}"
    // ...
    - Exclude results that are code repositories, security lists, or not explanatory for API development (e.g., GitHub repos, OWASP, MDN Add-ons)
    ```
  - **How to test**
    - Run technical research for the input term "sdk" and compare the number of included results to the previous output in @technical_research-output.json; the number of relevant results should increase and irrelevant ones (e.g., GitHub, OWASP, MDN Add-ons) should be excluded.

- [ ] **General/Refactoring: Remove firecrawlReferences and Update DB Schema if Needed**
  - **Before:**
    ```ts
    // firecrawl references and queries
    ```
  - **After:**
    ```ts
    // technical research references and queries
    ```

- [ ] **Naming/Code Hygiene**
  - Rename variables, arguments, and comments to reflect technical research as the new context source.
  - **Before:**
    ```ts
    // topRankingContent, firecrawlSummaries
    ```
  - **After:**
    ```ts
    // technicalResearchSummaries
    ```

- [ ] **Testing/Validation**
  - Add/update tests to ensure only relevant technical research results are included and context is passed correctly.
  - **Before:**
    ```ts
    // tests reference firecrawl context
    ```
  - **After:**
    ```ts
    // tests reference technical research context
    ``` 