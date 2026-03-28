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
import { withRetry } from "@/lib/utils/retry";
import { tryCatch } from "@/lib/utils/try-catch";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { performEditorialEval, performSEOEval, performTechnicalEval } from "../evaluate/evals";
import type { CacheStrategy } from "../generate-glossary-entry";
import { reviseEditorialOutline } from "./revise-editorial-outline";
import { reviseSEOOutline } from "./revise-seo-outline";
import { reviseTechnicalOutline } from "./revise-technical-outline";

export async function generateOutlineStep({
  term,
  onCacheHit = "stale" as CacheStrategy,
}: { term: string; onCacheHit?: CacheStrategy }) {
  return withRetry(
    async () => {
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
        throw new Error(`Database error: ${error}`);
      }

      if (
        existing?.dynamicSections &&
        existing.dynamicSections.length > 0 &&
        onCacheHit === "stale"
      ) {
        return existing;
      }
      if (!existing?.id) {
        throw new Error(`GenerateOutlineTask: Called without an entry for term '${term}'`);
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

      const technicalEval = await performTechnicalEval({
        input: term,
        content: initialOutline.object.outline
          .map((section) => `${section.heading}\n${section.description}`)
          .join("\n\n"),
        onCacheHit,
      });
      if (!technicalEval?.id) {
        throw new Error(`The technical evaluation task didn't return an eval id.`);
      }
      console.info(`Step 5/7 - TECHNICAL EVALUATION RESULT:
        Ratings: ${JSON.stringify(technicalEval?.ratings)}
        Recommendations: ${JSON.stringify(technicalEval?.recommendations)}`);

      const technicalRevision = await reviseTechnicalOutline({
        term,
        outlineToRefine: initialOutline.object.outline,
        reviewReport: technicalEval,
        technicalContext: technicalResearchSummaries
          .map((s) => `${s.url}\n${s.summary}`)
          .join("\n\n"),
        onCacheHit,
      });
      console.info(
        `Step 6/7 - TECHNICAL REVISED OUTLINE RESULT: ${JSON.stringify(technicalRevision?.outline)}`,
      );
      const seoKeywords = await db.query.keywords.findMany({
        where: and(
          or(eq(keywords.source, "related_searches"), eq(keywords.source, "auto_suggest")),
          eq(keywords.inputTerm, term),
        ),
      });

      const seoEval = await performSEOEval({
        input: term,
        content:
          technicalRevision?.outline
            .map((section) => `${section.heading}\n${section.description}`)
            .join("\n\n") || "",
        onCacheHit,
      });
      if (!seoEval?.id) {
        throw new Error("SEO evaluation failed");
      }
      console.info(`Step 7/7 - SEO EVALUATION RESULT:
        Ratings: ${JSON.stringify(seoEval.ratings)}
        Recommendations: ${JSON.stringify(seoEval.recommendations)}`);

      const seoRevision = await reviseSEOOutline({
        term,
        outlineToRefine: (technicalRevision?.outline || []).map((section) => ({
          ...section,
          keywords: [],
        })),
        reviewReport: seoEval,
        seoKeywordsToAllocate: seoKeywords,
      });
      console.info(
        `Step 8/7 - SEO OPTIMIZED OUTLINE RESULT: ${JSON.stringify(seoRevision?.outline)}`,
      );

      console.info("\n=== KEYWORD VALIDATION AFTER SEO REVISION ===");
      const seoKeywordSet = new Set(seoKeywords.map((k) => k.keyword));
      let invalidKeywordsFound = false;

      if (seoRevision?.outline) {
        for (const section of seoRevision.outline) {
          if (section.keywords && Array.isArray(section.keywords)) {
            for (const kw of section.keywords) {
              if (!seoKeywordSet.has(kw.keyword)) {
                console.warn(
                  `SEO Revision - Invalid keyword in section "${section.heading}": "${kw.keyword}"`,
                );
                invalidKeywordsFound = true;
              }
            }
          }
        }
      }

      if (!invalidKeywordsFound) {
        console.info("All keywords from SEO revision are valid");
      }

      const editorialEval = await performEditorialEval({
        input: term,
        content:
          seoRevision?.outline
            .map((section) => `${section.heading}\n${section.description}`)
            .join("\n\n") || "",
        onCacheHit,
      });
      if (!editorialEval?.id) {
        throw new Error("Editorial evaluation failed");
      }

      const keywordsByOrder = new Map();
      seoRevision?.outline.forEach((section) => {
        keywordsByOrder.set(section.order, section.keywords || []);
      });

      const outlineWithoutKeywords = (seoRevision?.outline || []).map((section) => {
        const { keywords, ...sectionWithoutKeywords } = section;
        return sectionWithoutKeywords;
      });

      let editorialRevision = await reviseEditorialOutline({
        term,
        outlineToRefine: outlineWithoutKeywords,
        reviewReport: editorialEval,
      });

      if (editorialRevision?.outline) {
        editorialRevision = {
          ...editorialRevision,
          outline: editorialRevision.outline.map((section) => {
            const originalKeywords = keywordsByOrder.get(section.order) || [];
            return {
              ...section,
              keywords: originalKeywords,
            };
          }),
        };
      }

      console.info(
        `Step 10/7 - EDITORIAL OPTIMIZED OUTLINE RESULT: ${JSON.stringify(editorialRevision?.outline)}`,
      );

      const finalOutline = editorialRevision?.outline || [];
      const sectionInsertionPayload = finalOutline.map((section) =>
        insertSectionSchema.parse({
          ...section,
          entryId: existing?.id,
        }),
      );
      const newSectionIds = await db
        .insert(sections)
        .values(sectionInsertionPayload)
        .returning({ id: sections.id });

      const keywordInsertionPayload = [];
      for (let i = 0; i < finalOutline.length; i++) {
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
            console.warn(`Keyword "${keyword.keyword}" not found in seo keywords`);
            continue;
          }
          const payload = insertSectionsToKeywordsSchema.parse({
            sectionId: section.id,
            keywordId,
          });
          keywordInsertionPayload.push(payload);
        }
      }

      if (keywordInsertionPayload.length > 0) {
        await db.insert(sectionsToKeywords).values(keywordInsertionPayload);
        console.info(`Inserted ${keywordInsertionPayload.length} keyword associations`);
      }

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
    { maxAttempts: 5, label: "generateOutline" },
  );
}

const initialOutlineSchema = z
  .object({
    outline: z.array(
      insertSectionSchema.omit({ entryId: true }).extend({
        order: z.number().optional(),
        citedSources: z.string().url(),
        contentTypes: z.array(insertSectionContentTypeSchema.omit({ sectionId: true })),
      }),
    ),
  })
  .transform((data) => ({
    ...data,
    outline: data.outline.map((section, i) => ({
      ...section,
      order: section.order ?? i + 1,
    })),
  }));

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
