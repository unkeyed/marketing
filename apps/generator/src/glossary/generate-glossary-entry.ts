import { db } from "@/lib/db-marketing/client";
import { entries } from "@/lib/db-marketing/schemas";
import { eq } from "drizzle-orm";
import { contentTakeawaysStep } from "./generate/content-takeaways";
import { draftSectionsStep } from "./generate/draft-sections";
import { generateFaqsStep } from "./generate/generate-faqs";
import { generateOutlineStep } from "./generate/generate-outline";
import { seoMetaTagsStep } from "./generate/seo-meta-tags";
import { commitToBranchStep } from "./publish/create-pr";
import { keywordResearchStep } from "./research/keyword-research";
import { technicalResearchStep } from "./research/technical-research";

import type { CacheStrategy } from "@/lib/types";
export type { CacheStrategy } from "@/lib/types";

/**
 * Generates a glossary entry for a given term. This is the main entry point of the glossary generation process.
 *
 * This workflow runs multiple steps sequentially:
 * 1. Keyword Research
 * 2. Technical Research
 * 3. Generate Outline
 * 4. Draft Sections & Content Takeaways
 * 5. Generate SEO Meta Tags
 * 6. Generate FAQs
 * 7. Create PR
 *
 * Each workflow step generates output that's stored in the database.
 * The default behaviour of every step is to always return a cached output if available.
 * This behaviour can be overridden by setting the `onCacheHit` parameter to `revalidate`.
 *
 * The workflow is idempotent. If it fails, it can be safely restarted.
 */
export async function generateGlossaryEntry({
  term,
  onCacheHit = "stale" as CacheStrategy,
}: { term: string; onCacheHit?: CacheStrategy }) {
  console.info(`-- Starting glossary entry generation for term: ${term} --`);

  const existing = await db.query.entries.findFirst({
    where: eq(entries.inputTerm, term),
    columns: {
      id: true,
      inputTerm: true,
      dynamicSectionsContent: true,
      metaTitle: true,
      metaDescription: true,
      githubPrUrl: true,
    },
    orderBy: (entries, { desc }) => [desc(entries.createdAt)],
  });

  if (
    existing?.dynamicSectionsContent &&
    existing?.metaTitle &&
    existing?.metaDescription &&
    existing?.githubPrUrl &&
    onCacheHit === "stale"
  ) {
    return {
      term,
      entry: existing,
    };
  }

  if (!existing) {
    await db.insert(entries).values({ inputTerm: term });
  }

  // Step 1: Keyword Research
  console.info("Step 1 - Starting keyword research...");
  const keywordResearch = await keywordResearchStep({ term, onCacheHit });
  console.info(`Keyword research completed with ${keywordResearch.keywords.length} keywords`);

  // Step 1.5: Technical Research
  console.info("Step 1.5 - Starting technical research...");
  await technicalResearchStep({
    inputTerm: term,
    onCacheHit,
  });
  console.info("Technical research completed and persisted");

  // Step 2: Generate Outline
  console.info("Step 2 - Generating outline...");
  const outline = await generateOutlineStep({ term, onCacheHit });
  console.info("Outline generated");

  // Step 3: Draft Sections
  console.info("Step 3 - Drafting sections...");
  await draftSectionsStep({ term, onCacheHit });
  console.info("Sections drafted");

  // Step 4: Content Takeaways
  console.info("Step 4 - Generating takeaways...");
  await contentTakeawaysStep({ term, onCacheHit });
  console.info("Takeaways generated");

  // Step 5: Generate SEO Meta Tags
  console.info("Step 5 - Generating SEO meta tags...");
  await seoMetaTagsStep({ term, onCacheHit });
  console.info("SEO meta tags generated");

  // Step 6: Generate FAQs
  console.info("Step 6 - Generating FAQs...");
  await generateFaqsStep({ term, onCacheHit });
  console.info("FAQs generated");

  // Step 7: Commit to branch
  console.info("Step 7 - Committing to branch...");
  const result = await commitToBranchStep({ input: term, onCacheHit });

  if (!result.entry?.id) {
    throw new Error(`Branch commit failed for term: ${term}`);
  }
  console.info(`Committed to branch: ${result.entry.branch}`);

  return {
    term,
    branch: result.entry.branch,
    keywordCount: keywordResearch.keywords.length,
    sectionCount: outline?.dynamicSections?.length,
  };
}
