import { db } from "@/lib/db-marketing/client";
import { blogPosts } from "@/lib/db-marketing/schemas/blog-posts";
import { entries } from "@/lib/db-marketing/schemas";
import type { AudienceLevel, CacheStrategy } from "@/lib/types";
import { eq } from "drizzle-orm";
import { keywordResearchStep } from "../glossary/research/keyword-research";
import { technicalResearchStep } from "../glossary/research/technical-research";
import { generateBlogOutlineStep } from "./generate/generate-blog-outline";
import { draftBlogSectionsStep } from "./generate/draft-blog-sections";
import { blogSeoMetaTagsStep } from "./generate/blog-seo-meta-tags";
import { commitBlogToBranchStep } from "./publish/create-blog-pr";

/**
 * Generates a blog post from a set of key terms.
 *
 * Workflow:
 * 1. Research each key term (keyword + technical research) — reuses glossary research pipeline
 * 2. Generate blog outline
 * 3. Draft blog content
 * 4. Generate SEO meta tags
 * 5. Create PR
 *
 * Each step caches its output. Pass onCacheHit: "revalidate" to force fresh generation.
 */
export async function generateBlogPost({
  keyTerms,
  audienceLevel,
  onCacheHit = "stale",
}: {
  keyTerms: string[];
  audienceLevel: AudienceLevel;
  onCacheHit?: CacheStrategy;
}) {
  console.info(`-- Starting blog post generation for terms: [${keyTerms.join(", ")}] (audience: ${audienceLevel}) --`);

  // Create blog post record
  const [inserted] = await db
    .insert(blogPosts)
    .values({
      keyTerms,
      audienceLevel,
    })
    .returning({ id: blogPosts.id });

  const blogPostId = inserted.id;
  console.info(`[blog] Created blog post record #${blogPostId}`);

  // Step 1: Research each key term (reuse glossary research pipeline)
  for (const term of keyTerms) {
    console.info(`[blog] Step 1 - Researching term: "${term}"`);

    // Ensure an entry exists for this term so the research pipeline works
    const existingEntry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, term),
    });
    if (!existingEntry) {
      await db.insert(entries).values({ inputTerm: term });
    }

    await keywordResearchStep({ term, onCacheHit });
    console.info(`[blog] Keyword research completed for "${term}"`);

    await technicalResearchStep({ inputTerm: term, onCacheHit });
    console.info(`[blog] Technical research completed for "${term}"`);
  }

  // Step 2: Generate blog outline
  console.info("[blog] Step 2 - Generating outline...");
  const outline = await generateBlogOutlineStep({
    blogPostId,
    keyTerms,
    audienceLevel,
    onCacheHit,
  });
  console.info(`[blog] Outline generated with ${outline.length} sections`);

  // Step 3: Draft blog content
  console.info("[blog] Step 3 - Drafting content...");
  await draftBlogSectionsStep({
    blogPostId,
    keyTerms,
    audienceLevel,
    onCacheHit,
  });
  console.info("[blog] Content drafted");

  // Step 4: Generate SEO meta tags
  console.info("[blog] Step 4 - Generating SEO meta tags...");
  await blogSeoMetaTagsStep({
    blogPostId,
    keyTerms,
    onCacheHit,
  });
  console.info("[blog] SEO meta tags generated");

  // Step 5: Commit to branch
  console.info("[blog] Step 5 - Committing to branch...");
  const commit = await commitBlogToBranchStep({
    blogPostId,
    onCacheHit,
  });
  console.info(`[blog] Committed to branch: ${commit.branch}`);

  return {
    keyTerms,
    audienceLevel,
    branch: commit.branch,
  };
}
