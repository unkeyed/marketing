# Glossary Generation - Generate Phase

This folder contains the tasks responsible for generating glossary content after the research phase is complete.

## Overview

The generate phase transforms research data into a complete glossary entry through a series of evaluation and revision cycles.

## Key Tasks

### 1. `generate-outline.ts` - Main Orchestrator
The primary task that coordinates the entire outline generation process.

**Flow:**
1. Initial outline generation based on technical research
2. Technical evaluation → Technical revision
3. SEO evaluation → SEO revision (with keyword allocation)
4. Editorial evaluation → Editorial revision
5. Database persistence

### 2. Revision Tasks

#### `revise-technical-outline.ts`
- Refines outline based on technical accuracy feedback
- Ensures completeness and depth for API developers
- Adds technical details identified in review

#### `revise-seo-outline.ts`
- Optimizes outline for search engines
- **Allocates keywords from database to sections**
- Only uses keywords from provided list (no new keywords)

#### `revise-editorial-outline.ts`
- Improves readability and flow
- Enhances descriptions and headings
- **Does NOT modify keywords** (see implementation note below)

### 3. Content Generation Tasks

#### `draft-sections.ts`
- Generates actual content for each section
- Reviews content for technical accuracy
- Optimizes content for SEO

#### `content-takeaways.ts`
- Extracts key insights from the content
- Runs in parallel with draft-sections

#### `seo-meta-tags.ts`
- Generates SEO title and description
- Validates length constraints

#### `generate-faqs.ts`
- Creates FAQ entries based on "People Also Ask" data

## Critical Implementation: Keyword Preservation

### Problem
The editorial revision task was replacing valid SEO keywords with generic terms, causing database insertion failures.

### Solution
Keywords are **stripped before** editorial revision and **restored after** to prevent modification.

#### Implementation Details

1. **Before Editorial Revision:**
```typescript
// Store keywords by section order
const keywordsByOrder = new Map();
seoRevision.output?.outline.forEach(section => {
  keywordsByOrder.set(section.order, section.keywords || []);
});

// Remove keywords from outline
const outlineWithoutKeywords = outline.map(section => {
  const { keywords, ...sectionWithoutKeywords } = section;
  return sectionWithoutKeywords;
});
```

2. **During Editorial Revision:**
- AI only sees sections without keywords
- Cannot modify what it doesn't receive
- Focuses only on content improvement

3. **After Editorial Revision:**
```typescript
// Restore keywords based on section order
editorialRevision.output.outline = editorialRevision.output.outline.map(section => {
  const originalKeywords = keywordsByOrder.get(section.order) || [];
  return {
    ...section,
    keywords: originalKeywords
  };
});
```

### Why This Approach?

1. **Prompt-based solutions failed** - Even with explicit instructions, the AI would replace keywords
2. **Code-based solution is foolproof** - AI cannot modify data it doesn't receive
3. **Preserves data integrity** - Keywords must match database entries exactly for foreign key constraints

### Assumptions

- Sections maintain their `order` field during editorial revision
- Editorial revision doesn't merge or split sections
- If these assumptions break, consider adding unique IDs to track sections

## Error Handling

### Schema Validation
All revision tasks include:
- Truncation detection (checks JSON ending pattern)
- Bracket balance validation
- Detailed Zod error logging
- Repair functions with field-by-field fixes

### Keyword Validation
- Validates keywords after SEO revision
- Validates keywords after editorial revision (should be unchanged)
- Prevents empty array insertion to avoid Drizzle errors

## Database Schema

Keywords are stored in a many-to-many relationship:
- `sections` table - stores outline sections
- `keywords` table - stores SEO keywords (from research phase)
- `sectionsToKeywords` junction table - links sections to keywords

The keywords MUST exist in the keywords table before they can be associated with sections.

## Common Issues

1. **"Keyword not found in seo keywords"** - SEO revision used keywords not in database
2. **"values() must be called with at least one value"** - No valid keywords to insert
3. **Response truncation** - Outline too long, reduce sections or description length

## Testing

When testing changes:
1. Check keyword validation logs after SEO revision
2. Verify keywords are unchanged after editorial revision
3. Ensure successful database insertion
4. Monitor for truncation errors in revision tasks