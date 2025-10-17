import { db } from "@/lib/db-marketing/client";
import {
  type SelectKeywords,
  entries,
  exaScrapedResults,
  insertSectionContentTypeSchema,
  insertSectionSchema,
  insertSectionsToKeywordsSchema,
  keywords,
  sectionContentTypes,
  sections,
  sectionsToKeywords,
} from "@/lib/db-marketing/schemas";
import { tryCatch } from "@/lib/utils/try-catch";
import { openai } from "@ai-sdk/openai";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import type { CacheStrategy } from "../_generate-glossary-entry";
import {
  performEditorialEvalTask,
  performSEOEvalTask,
  performTechnicalEvalTask,
} from "../evaluate/evals";
import { reviseEditorialOutlineTask } from "./revise-editorial-outline";
import { reviseSEOOutlineTask } from "./revise-seo-outline";
import { reviseTechnicalOutlineTask } from "./revise-technical-outline";

// TODO: this task is a bit flake-y still
// - split up into smaller tasks,  and/or
// - move some of the in-memory storage to db caching, and/or
// - improve the prompts
export const generateOutlineTask = task({
  id: "generate_outline",
  retry: {
    maxAttempts: 5,
  },
  run: async ({
    term,
    onCacheHit = "stale" as CacheStrategy,
  }: { term: string; onCacheHit?: CacheStrategy }) => {
    const drizzleQuery = db.query.entries.findFirst({
      where: eq(entries.inputTerm, term),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
      columns: {
        id: true,
        inputTerm: true,
        createdAt: true,
      },
      with: {
        dynamicSections: {
          with: {
            contentTypes: true,
            sectionsToKeywords: {
              with: {
                keyword: true,
              },
            },
          },
        },
      },
    });
    const { data: existing, error } = await tryCatch(drizzleQuery);

    if (error) {
      throw new AbortTaskRunError(`Database error: ${error}`);
    }

    if (
      existing?.dynamicSections &&
      existing.dynamicSections.length > 0 &&
      onCacheHit === "stale"
    ) {
      return existing;
    }
    if (!existing?.id) {
      throw new AbortTaskRunError(
        `GenerateOutlineTask: Called without an entry for term '${term}'`,
      );
    }

    const technicalResearchSummaries = await db.query.exaScrapedResults.findMany({
      columns: {
        url: true,
        summary: true,
      },
      where: eq(exaScrapedResults.inputTerm, term),
    });

    const contentKeywords = await db.query.keywords.findMany({
      where: and(
        or(eq(keywords.source, "headers"), eq(keywords.source, "title")),
        eq(keywords.inputTerm, term),
      ),
    });

    // Step 4: Generate initial outline
    const initialOutline = await generateInitialOutline({
      term,
      technicalResearchSummary: technicalResearchSummaries
        .map((s) => `${s.url}\n${s.summary}`)
        .join("\n\n"),
      contentKeywords,
    });
    console.info(
      `Step 4/7 - INITIAL OUTLINE RESULT: ${JSON.stringify(initialOutline.object.outline)}`,
    );

    // Step 5: Technical review by domain expert
    const technicalEval = await performTechnicalEvalTask.triggerAndWait({
      input: term,
      content: initialOutline.object.outline
        .map((section) => `${section.heading}\n${section.description}`)
        .join("\n\n"),
      onCacheHit,
    });
    if (!technicalEval.ok) {
      throw new AbortTaskRunError("Technical evaluation failed");
    }
    if (!technicalEval.output?.id) {
      throw new AbortTaskRunError(`The technical evaluation task didn't return an eval id.`);
    }
    console.info(`Step 5/7 - TECHNICAL EVALUATION RESULT: 
        ===
        Ratings: ${JSON.stringify(technicalEval?.output?.ratings)}
        ===
        Recommendations: ${JSON.stringify(technicalEval?.output?.recommendations)}
        `);

    // Step 6: Revise outline based on technical feedback
    const technicalRevision = await reviseTechnicalOutlineTask.triggerAndWait({
      term,
      outlineToRefine: initialOutline.object.outline,
      reviewReport: technicalEval.output,
      technicalContext: technicalResearchSummaries
        .map((s) => `${s.url}\n${s.summary}`)
        .join("\n\n"),
      onCacheHit,
    });
    if (!technicalRevision.ok) {
      throw new AbortTaskRunError("Technical revision failed");
    }
    console.info(
      `Step 6/7 - TECHNICAL REVISED OUTLINE RESULT: ${JSON.stringify(
        technicalRevision.output?.outline,
      )}`,
    );
    const seoKeywords = await db.query.keywords.findMany({
      where: and(
        or(eq(keywords.source, "related_searches"), eq(keywords.source, "auto_suggest")),
        eq(keywords.inputTerm, term),
      ),
    });

    // Step 7: SEO review on technically revised outline
    const seoEval = await performSEOEvalTask.triggerAndWait({
      input: term,
      content:
        technicalRevision.output?.outline
          .map((section) => `${section.heading}\n${section.description}`)
          .join("\n\n") || "",
      onCacheHit,
    });
    if (!seoEval.ok) {
      throw new AbortTaskRunError("SEO evaluation failed");
    }
    console.info(`Step 7/7 - SEO EVALUATION RESULT: 
        ===
        Ratings: ${JSON.stringify(seoEval.output.ratings)}
        ===
        Recommendations: ${JSON.stringify(seoEval.output.recommendations)}
        `);

    // Step 8: Revise outline based on SEO feedback
    const seoRevision = await reviseSEOOutlineTask.triggerAndWait({
      term,
      outlineToRefine: (technicalRevision.output?.outline || []).map((section) => ({
        ...section,
        keywords: [], // SEO revision task will populate these
      })),
      reviewReport: seoEval.output,
      seoKeywordsToAllocate: seoKeywords,
      onCacheHit,
    });
    if (!seoRevision.ok) {
      throw new AbortTaskRunError("SEO revision failed");
    }
    console.info(
      `Step 8/7 - SEO OPTIMIZED OUTLINE RESULT: ${JSON.stringify(seoRevision.output?.outline)}`,
    );

    // Validate keywords after SEO revision
    console.info("\n=== KEYWORD VALIDATION AFTER SEO REVISION ===");
    const seoKeywordSet = new Set(seoKeywords.map((k) => k.keyword));
    let invalidKeywordsFound = false;

    if (seoRevision.output?.outline) {
      for (const section of seoRevision.output.outline) {
        if (section.keywords && Array.isArray(section.keywords)) {
          for (const kw of section.keywords) {
            if (!seoKeywordSet.has(kw.keyword)) {
              console.warn(
                `⚠️  SEO Revision - Invalid keyword in section "${section.heading}": "${kw.keyword}"`,
              );
              invalidKeywordsFound = true;
            }
          }
        }
      }
    }

    if (!invalidKeywordsFound) {
      console.info("✅ All keywords from SEO revision are valid");
    } else {
      console.warn("❌ SEO revision introduced keywords not in the provided list");
      console.info("Available keywords were:", Array.from(seoKeywordSet).join(", "));
    }

    // Step 9: Editorial review on SEO optimized outline
    const editorialEval = await performEditorialEvalTask.triggerAndWait({
      input: term,
      content:
        seoRevision.output?.outline
          .map((section) => `${section.heading}\n${section.description}`)
          .join("\n\n") || "",
      onCacheHit,
    });
    if (!editorialEval.ok) {
      throw new AbortTaskRunError("Editorial evaluation failed");
    }
    console.info(`Step 9/7 - EDITORIAL EVALUATION RESULT: 
        ===
        Ratings: ${JSON.stringify(editorialEval.output.ratings)}
        ===
        Recommendations: ${JSON.stringify(editorialEval.output.recommendations)}
        `);

    if (!editorialEval.output || !editorialEval.output.id) {
      throw new AbortTaskRunError("Editorial evaluation output or outline is missing.");
    }

    // Step 10: Revise outline based on editorial feedback
    // Store keywords before editorial revision
    const keywordsByOrder = new Map();
    seoRevision.output?.outline.forEach((section) => {
      keywordsByOrder.set(section.order, section.keywords || []);
    });

    // Remove keywords from outline before sending to editorial revision
    const outlineWithoutKeywords = (seoRevision.output?.outline || []).map((section) => {
      const { keywords, ...sectionWithoutKeywords } = section;
      return sectionWithoutKeywords;
    });

    const editorialRevision = await reviseEditorialOutlineTask.triggerAndWait({
      term,
      outlineToRefine: outlineWithoutKeywords,
      reviewReport: editorialEval.output,
      onCacheHit,
    });
    if (!editorialRevision.ok) {
      throw new AbortTaskRunError("Editorial revision failed");
    }
    // Restore keywords to editorial revision output
    if (editorialRevision.output?.outline) {
      editorialRevision.output.outline = editorialRevision.output.outline.map((section) => {
        // Restore keywords based on section order
        const originalKeywords = keywordsByOrder.get(section.order) || [];
        return {
          ...section,
          keywords: originalKeywords,
        };
      });
    }

    console.info(
      `Step 10/7 - EDITORIAL OPTIMIZED OUTLINE RESULT: ${JSON.stringify(
        editorialRevision.output?.outline,
      )}`,
    );

    // Validate keywords after Editorial revision
    console.info("\n=== KEYWORD VALIDATION AFTER EDITORIAL REVISION ===");
    invalidKeywordsFound = false;

    if (editorialRevision.output?.outline) {
      for (const section of editorialRevision.output.outline) {
        if (section.keywords && Array.isArray(section.keywords)) {
          for (const kw of section.keywords) {
            if (!seoKeywordSet.has(kw.keyword)) {
              console.warn(
                `⚠️  Editorial Revision - Invalid keyword in section "${section.heading}": "${kw.keyword}"`,
              );
              invalidKeywordsFound = true;
            }
          }
        }
      }
    }

    if (!invalidKeywordsFound) {
      console.info("✅ All keywords from Editorial revision are valid");
    } else {
      console.warn("❌ Editorial revision introduced/changed keywords not in the provided list");
    }

    // persist to db as a new entry by with their related entities
    const finalOutline = editorialRevision.output?.outline || [];
    const sectionInsertionPayload = finalOutline.map((section) =>
      insertSectionSchema.parse({
        ...section,
        entryId: existing?.id,
      }),
    );
    const newSectionIds = await db.insert(sections).values(sectionInsertionPayload).$returningId();

    // associate the keywords with the sections
    const keywordInsertionPayload = [];
    for (let i = 0; i < finalOutline.length; i++) {
      // add the newly inserted section id to our outline
      const section = {
        ...(finalOutline[i] as unknown as object),
        id: newSectionIds[i].id,
      };
      for (let j = 0; j < (section as any).keywords.length; j++) {
        const keyword = (section as any).keywords[j];
        const keywordId = seoKeywords.find(
          (seoKeyword) => keyword.keyword === seoKeyword.keyword,
        )?.id;
        if (!keywordId) {
          console.warn(
            `Keyword "${keyword.keyword}" not found in seo keywords for keyword ${keyword.keyword}`,
          );
          continue;
        }
        const payload = insertSectionsToKeywordsSchema.parse({
          sectionId: section.id,
          keywordId,
        });
        keywordInsertionPayload.push(payload);
      }
    }

    // Only insert if we have keywords to insert
    if (keywordInsertionPayload.length > 0) {
      await db.insert(sectionsToKeywords).values(keywordInsertionPayload);
      console.info(`✅ Inserted ${keywordInsertionPayload.length} keyword associations`);
    } else {
      console.warn("⚠️  No valid keywords to associate with sections - skipping keyword insertion");
    }

    // associate the content types with the sections
    const contentTypesInsertionPayload = finalOutline.flatMap((section, index) =>
      section.contentTypes.map((contentType: any) =>
        insertSectionContentTypeSchema.parse({
          ...contentType,
          sectionId: newSectionIds[index].id,
        }),
      ),
    );
    await db.insert(sectionContentTypes).values(contentTypesInsertionPayload);

    const newEntry = await db.query.entries.findFirst({
      where: eq(entries.id, existing.id),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
      with: {
        dynamicSections: {
          with: {
            contentTypes: true,
            sectionsToKeywords: {
              with: {
                keyword: true,
              },
            },
          },
        },
      },
    });

    return newEntry;
  },
});

// the keywords are associated later
const initialOutlineSchema = z.object({
  outline: z.array(
    insertSectionSchema.omit({ entryId: true }).extend({
      citedSources: z.string().url(),
      contentTypes: z.array(insertSectionContentTypeSchema.omit({ sectionId: true })),
    }),
  ),
});

async function generateInitialOutline({
  term,
  technicalResearchSummary,
  contentKeywords,
}: {
  term: string;
  technicalResearchSummary: string;
  contentKeywords: Array<SelectKeywords>;
}) {
  const initialOutlineSystem = `You are a **Technical SEO Content Writer** specializing in API development and computer science.
  Your objective is to create a flat, comprehensive outline for a glossary page based on summarized content from top-ranking pages.
  Ensure factual correctness, clarity, and SEO optimization without unnecessary subheadings.`;

  const initialOutlinePrompt = `
  Generate a comprehensive and factually accurate outline for a glossary page dedicated to the term: **${term}**.
  
  **Instructions:**
  - Analyze the summarized content from the top-ranking pages.
  - Create a flat, customized outline with sections that best address the search intent and provide comprehensive coverage of the term.
  - Ensure all sections are factually correct, unique, and tailored to the specific term's context in API development and computer science.
  - Denote the order of the sections
  - Include a short description under each heading that outlines the content to be included, explains its importance, and references sources.
  - Describe recommended content types for each section as per the schema definition called "type" inside the contentTypes array. These represent different type of content forms for SEO pages. Make a recommendation for what to use and keep track of your reasoning.
  - Ensure headers are under 70 characters, descriptive, and maintain clarity and readability.
  - Cite the sources for every section in the form of the URL and collect them in the "citedSources" field.
  
  =====
  TOP RANKING PAGES CONTENT:
  =====
  ${technicalResearchSummary}
  
  =====
  KEYWORDS USED IN HEADERS:
  =====
  FROM PAGE TITLES:
  ${contentKeywords
    .filter((k) => k.source === "title")
    .map((k) => `- ${k.keyword}`)
    .join("\n")}
  FROM HEADERS:
  ${contentKeywords
    .filter((k) => k.source === "headers")
    .map((k) => `- ${k.keyword}`)
    .join("\n")}
  `;

  return await generateObject({
    model: openai("gpt-4o-mini"),
    system: initialOutlineSystem,
    prompt: initialOutlinePrompt,
    schema: initialOutlineSchema,
    experimental_repairText: async (res) => {
      console.debug(`[DEBUG] Repairing text: ${res.text}`);
      console.warn(`[DEBUG] Encountered error: ${res.error}`);
      return res.text;
    },
    experimental_telemetry: {
      functionId: "generateInitialOutline",
      recordInputs: true,
      recordOutputs: true,
    },
  });
}
