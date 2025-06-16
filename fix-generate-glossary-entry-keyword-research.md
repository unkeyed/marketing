# Bug-Fix Tracker: generate_glossary_entry Keyword Research Failure

## 1. Static Analysis
- **Workflow:** `generate_glossary_entry` (Trigger.dev)
- **Failing Step:** Keyword research (input: `RESTful API`)
- **Observed Logs:**
  - `-- Starting glossary entry generation for term: RESTful API --`
  - `Step 1 - Starting keyword research...`
  - `keyword_research` subtask started
  - `1/6 - SEARCH QUERY: RESTful API development best practices`
  - `[search] ℹ️ No complete search response found for 'RESTful API development best practices', running Serper API call`
  - `2/6 - SEARCH RESPONSE: Found 10 organic results`
  - `3/6 - Getting content for top 3 results`
  - ❌ `AbortTaskRunError: Keyword research failed for term: RESTful API`

## 2. Reproduction
- [x] Run MCP locally with input `{ "term": "RESTful API", "onCacheHit": "revalidate" }`
  - MCP server started successfully using `pnpm -F generator dev:mcp`.
- [x] Run keywordResearchTask regression test in isolation (via MCP CLI/code, not UI)
  - Test triggered as `keyword_research_regression_test` using MCP.
- [x] Observe logs and confirm failure at keyword research step
  - Failure confirmed. The test failed as expected, reproducing the bug.
- [x] Document exact error and stack trace
  - **Error:** `TypeError: value.toISOString is not a function`
  - **Stacktrace:**
    ```
    TypeError: value.toISOString is not a function
        at MySqlTimestamp.mapToDriverValue (.../chunk-M4CJJIEQ.mjs:3017:18)
        at .../chunk-M4CJJIEQ.mjs:904:73
        at Array.map (<anonymous>)
        at _SQL.buildQueryFromSourceParams (.../chunk-M4CJJIEQ.mjs:846:32)
        ...
    ```
  - The error occurs during the processing of a URL (e.g., https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) in the keyword research step.

**Next step:** Begin static and dynamic debugging to identify the root cause of the `toISOString` error in the workflow.

## 3. Write Failing Test
- [x] Add regression test for `keywordResearchTask` with input `RESTful API`
  - Regression test added to `_keyword-research-test.ts`.
- [ ] Confirm test fails as expected

## 4. Debugging
- [ ] Analyze code in `_generate-glossary-entry.ts` and keyword research implementation
- [ ] Check for API failures, LLM output issues, or data handling bugs
- [ ] Review recent changes to keyword research logic
- [ ] Document findings

## 5. Implement Fix
- [ ] Patch code to handle failure (details to be filled after debugging)
- [ ] Add/adjust error handling or logic as needed

## 6. Verify Fix
- [ ] Run regression test (should pass)
- [ ] Run full workflow (should proceed past keyword research)
- [ ] Run all related tests

## 7. Completion
- [ ] Update tracker with context, what worked, what didn't
- [ ] Commit with message: `fix: keyword research bug in glossary entry workflow (#4)`
- [ ] Push branch and create PR (linking issue #4)

---

### Context Log
- MCP server started successfully (v4-beta.21) using `pnpm -F generator dev:mcp`.
- **Known Error:** Running `pnpm -F generator dev` will fail with a CLI version mismatch error because it uses the latest Trigger.dev CLI, not the v4 beta required for MCP. Always use `pnpm -F generator dev:mcp` for MCP testing as per the troubleshooting section of @testing-workflows.mdc.
- Regression test for RESTful API input added to `_keyword-research-test.ts`. 