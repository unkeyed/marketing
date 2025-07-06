# Marketing Generator

A Trigger.dev-based workflow for automatically generating marketing content, specifically focused on glossary entries. The system uses PlanetScale as its database with Drizzle ORM for data management.

## Overview

The main workflow (`_generate-glossary-entry.ts`) orchestrates the generation of glossary entries through a series of sequential and parallel tasks. The workflow is idempotent and can be safely restarted if aborted.

### Workflow Steps

1. **Keyword Research**
   - Analyzes and generates relevant keywords for the term
   - Stores results in the database

2. **Technical Research**
   - Performs technical analysis of the term
   - Stores research results in the database

3. **Outline Generation**
   - Creates a structured outline for the content
   - Defines dynamic sections for the entry

4. **Parallel Processing**
   - Drafts content sections
   - Generates content takeaways
   - Both tasks run concurrently for efficiency

5. **SEO Optimization**
   - Generates meta tags
   - Creates SEO-optimized title and description

6. **FAQ Generation**
   - Creates relevant FAQs for the term
   - Stores in the database

7. **PR Creation**
   - Creates a GitHub PR with the generated content
   - Stores the PR URL in the database

## Database Schema

The system uses PlanetScale with Drizzle ORM. The main `entries` table stores:

- Basic content (title, description, sections)
- SEO metadata
- Technical research
- FAQs
- Content takeaways
- GitHub PR information
- Status tracking
- Timestamps

## Development Instructions

### For Humans

1. Start the development server:
   ```bash
   pnpm -F generator dev
   ```

2. The Trigger.dev server will run in the background
3. Access the Trigger.dev dashboard to monitor and manage workflows
4. Use the database studio to inspect data:
   ```bash
   pnpm -F generator db:studio
   ```

### For Agents

1. Start the development server with MCP support:
   ```bash
   pnpm -F generator dev:mcp
   ```

2. The Trigger.dev server will run in the background with MCP enabled
3. Make Trigger MCP calls to test specific workflow runs
4. Monitor the workflow execution through the Trigger.dev dashboard

### Analyzing Workflows

To understand the workflow structure:

1. **Task Identification**
   - Look for `task()` definitions in the codebase
   - Each task has a unique `id` and may have retry configurations

2. **Workflow Patterns**
   - **Sequential Tasks**: Tasks that run one after another
   - **Parallel Tasks**: Tasks that run concurrently ("in batch"), look for `import { batch } from "trigger.dev"` or find "`batch.trigger`" to find usages

3. **Task Dependencies**
   - Check for `triggerAndWait` or `trigger` calls to identify task dependencies
   - Look for error handling and abort conditions
   - Note the `onCacheHit` strategy for each task

4. **Database Interactions**
   - Tasks typically interact with the database through Drizzle ORM
   - Look for `db.query` and `db.insert` operations
   - Check for transaction handling

## Available Scripts

- `dev`: Start development server
- `dev:mcp`: Start development server with MCP support
- `trigger:deploy`: Deploy to Trigger.dev
- `db:push`: Push database schema changes
- `db:studio`: Open database studio
- `db:generate`: Generate database migrations
- `db:migrate`: Run database migrations
- `db:pull`: Pull database schema

## Dependencies

The project uses:
- Trigger.dev v4-beta for workflow orchestration
- PlanetScale for database
- Drizzle ORM for database operations
- Various AI SDKs for content generation
- GitHub integration for PR creation

## Notes

- The workflow is designed to be idempotent
- Each task has a maximum of 5 retry attempts
- Tasks use caching by default but can be forced to revalidate
- The system maintains a comprehensive audit trail of all operations

## Testing

### Trigger.dev

#### Instructions

1. Run the following command in a background terminal:
   ```bash
   pnpm -F generator dev:mcp
   ```
   - **Wait until you see:**
     `Trigger.dev MCP Server is now running on port <PORT>`
   - The default port may be `3333` (as shown in logs)
   - **Example logs for successful operation**

   ```bash
   pnpm -F generator dev:mcp

   > generator@1.0.0 dev:mcp /Users/richardpoelderl/marketing-1/apps/generator 
   > pnpm dlx trigger.dev@v4-beta dev --mcp

   Trigger.dev (4.0.0-v4-beta.21)
   ------------------------------------------------------
   Key: Version | Task | Run
   ------------------------------------------------------
   Trigger.dev MCP Server is now running on port 3333 ✨
   ○ Building background worker…
   │
   ■  Error: (node:9267) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
   │  (Use `node --trace-deprecation ...` to show where the warning was created)
   │  
   ○ Background worker ready [node] -> 20250613.2 | Test tasks | View runs
   ```
2. Use the trigger.dev MCP to list its tool calls.

Successful operation:

You should see a list of available tasks in the response, similar to this:
```
Parameters:
 No parameters

Result: 

[ 
  "...",
  "...",
  "...",
] 
```