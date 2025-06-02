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
  selectKeywordsSchema,
} from "@/lib/db-marketing/schemas";
import { tryCatch } from "@/lib/utils/try-catch";
import { openai } from "@ai-sdk/openai";
import { AbortTaskRunError, type TaskOutput, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import type { CacheStrategy } from "./_generate-glossary-entry";
import { performEditorialEvalTask, performSEOEvalTask, performTechnicalEvalTask } from "./evals";

// TODO: this task is a bit flake-y still
// - split up into smaller tasks,  and/or
// - move some of the in-memory storage to db caching, and/or
// - improve the prompts
export const generateOutlineTask = task({
  id: "generate_outline",
  retry: {
    maxAttempts: 3,
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
    if (process.env.NODE_ENV === "development") {
      console.debug(`[DEBUG] Check the drizzle query:\n
        ${drizzleQuery.toSQL().sql}\n
        ---------
        params:
        ${JSON.stringify(drizzleQuery.toSQL().params)}
        `);
    }
    const { data: existing, error } = await tryCatch(drizzleQuery);

    if (error) {
      throw new AbortTaskRunError(`Database error: ${error}`);
    }
    if (process.env.NODE_ENV === "development") {
      console.debug("[DEBUG] first read query performed successfully");
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
      `Step 4/8 - INITIAL OUTLINE RESULT: ${JSON.stringify(initialOutline.object.outline)}`,
    );

    // Step 5: Technical review by domain expert
    const technicalEval = await performTechnicalEvalTask.triggerAndWait({
      input: term,
      content: technicalResearchSummaries.map((s) => `${s.url}\n${s.summary}`).join("\n\n"),
      onCacheHit,
    });
    if (!technicalEval.ok) {
      throw new AbortTaskRunError("Technical evaluation failed");
    }
    if (!technicalEval.output?.id) {
      throw new AbortTaskRunError(`The technical evaluation task didn't return an eval id.`);
    }
    console.info(`Step 5/8 - TECHNICAL EVALUATION RESULT: 
        ===
        Ratings: ${JSON.stringify(technicalEval?.output?.ratings)}
        ===
        Recommendations: ${JSON.stringify(technicalEval?.output?.recommendations)}
        `);
    const seoKeywords = await db.query.keywords.findMany({
      where: and(
        or(eq(keywords.source, "related_searches"), eq(keywords.source, "auto_suggest")),
        eq(keywords.inputTerm, term),
      ),
    });

    // Step 6: SEO review
    const seoEval = await performSEOEvalTask.triggerAndWait({
      input: term,
      content: technicalResearchSummaries
        .map((result) => `${result.url}\n${result.summary}`)
        .join("\n\n"),
      onCacheHit,
    });
    if (!seoEval.ok) {
      throw new AbortTaskRunError("SEO evaluation failed");
    }
    console.info(`Step 6/8 - SEO EVALUATION RESULT: 
        ===
        Ratings: ${JSON.stringify(seoEval.output.ratings)}
        ===
        Recommendations: ${JSON.stringify(seoEval.output.recommendations)}
        `);

    const seoOptimizedOutline = await reviseSEOOutline({
      term,
      outlineToRefine: initialOutline.object.outline,
      reviewReport: seoEval.output,
      seoKeywordsToAllocate: seoKeywords,
    });
    console.info(
      `Step 7/8 - SEO OPTIMIZED OUTLINE RESULT: ${JSON.stringify(
        seoOptimizedOutline.object.outline,
      )}`,
    );

    // Step 7: Editorial review
    const editorialEval = await performEditorialEvalTask.triggerAndWait({
      input: term,
      content: seoOptimizedOutline.object.outline
        .map((section) => `${section.heading}\n${section.description}`)
        .join("\n\n"),
      onCacheHit,
    });
    if (!editorialEval.ok) {
      throw new AbortTaskRunError("Editorial evaluation failed");
    }
    console.info(`Step 8/8 - EDITORIAL EVALUATION RESULT: 
        ===
        Ratings: ${JSON.stringify(editorialEval.output.ratings)}
        ===
        Recommendations: ${JSON.stringify(editorialEval.output.recommendations)}
        `);

    if (!editorialEval.output || !editorialEval.output.id) {
      throw new AbortTaskRunError("Editorial evaluation output or outline is missing.");
    }
    const editorialOptimizedOutline = await reviseEditorialOutline({
      term,
      outlineToRefine: seoOptimizedOutline.object.outline,
      reviewReport: editorialEval.output,
    });

    // persist to db as a new entry by with their related entities
    const sectionInsertionPayload = editorialOptimizedOutline.object.outline.map((section) =>
      insertSectionSchema.parse({
        ...section,
        entryId: existing?.id,
      }),
    );
    const newSectionIds = await db.insert(sections).values(sectionInsertionPayload).$returningId();

    // associate the keywords with the sections
    const keywordInsertionPayload = [];
    for (let i = 0; i < editorialOptimizedOutline.object.outline?.length; i++) {
      // add the newly inserted section id to our outline
      const section = {
        ...(editorialOptimizedOutline.object.outline[i] as unknown as object),
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

    await db.insert(sectionsToKeywords).values(keywordInsertionPayload);

    // associate the content types with the sections
    const contentTypesInsertionPayload = editorialOptimizedOutline.object.outline.flatMap(
      (section, index) =>
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

export const reviewSchema = z.object({
  evaluation: z.string(),
  missing: z.string().optional(),
  rating: z.number().min(0).max(10),
});

// Schema for initial outline: array of sections, each with content types and keywords
const finalOutlineSchema = z.object({
  outline: z.array(
    insertSectionSchema.omit({ entryId: true }).extend({
      citedSources: z.string().url(),
      contentTypes: z.array(insertSectionContentTypeSchema.omit({ sectionId: true })),
      keywords: z.array(selectKeywordsSchema.pick({ keyword: true })),
    }),
  ),
});
// the keywords are associated later
const initialOutlineSchema = finalOutlineSchema.extend({
  outline: z.array(finalOutlineSchema.shape.outline.element.omit({ keywords: true })),
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

async function reviseSEOOutline({
  term,
  outlineToRefine,
  reviewReport,
  seoKeywordsToAllocate,
}: {
  term: string;
  outlineToRefine: z.infer<typeof initialOutlineSchema>["outline"];
  reviewReport: TaskOutput<typeof performSEOEvalTask>;
  seoKeywordsToAllocate: Array<SelectKeywords>;
}) {
  const seoRevisionSystem = `
   You are a **Senior SEO Strategist & Technical Content Specialist** with over 10 years of experience in optimizing content for API development and computer science domains.

   Task:
   - Refine the outline you're given based on the review report and guidelines
   - Allocate the provided keyworeds to the provided outline items

   **Guidelines for Revised Outline:**
   1. Make each header unique and descriptive
   2. Include relevant keywords in headers (use only provided keywords)
   3. Keep headers concise (ideally under 60 characters)
   4. Make headers compelling and engaging
   5. Optimize headers for featured snippets
   6. Avoid keyword stuffing in headers
   7. Use long-tail keywords where appropriate
   8. Ensure headers effectively break up the text
   9. Allocate keywords from the provided list to each section (ie outline item) in the 'keywords' field as an object with the following structure: { keyword: string }
   10. Allocate each keyword only once across all sections
   11. Ensure the keyword allocation makes sense for each section's content
   12. If a keyword doesn't fit any section, leave it unallocated

   **Additional Considerations:**
   - Headers should read technically and logically
   - Headers should explain the content of their respective sections
   - Headers should be distinct from each other
   - Optimize for SEO without sacrificing readability
   - Write for API developers, not general internet users
   - Maintain a technical tone appropriate for the audience

   You have the ability to add, modify, or merge sections in the outline as needed to create the most effective and SEO-optimized structure.
   `;

  const seoRevisionPrompt = `
   Review the following outline for the term "${term}":

   Outline to refine:
   ${JSON.stringify(outlineToRefine)}

   Review report:
   ${JSON.stringify(reviewReport)}

   Provided keywords:
  Related Searches: ${JSON.stringify(
    seoKeywordsToAllocate
      .filter((k) => k.source === "related_searches")
      .map((k) => k.keyword)
      .join(", "),
  )}
  Auto Suggest: ${JSON.stringify(
    seoKeywordsToAllocate
      .filter((k) => k.source === "auto_suggest")
      .map((k) => k.keyword)
      .join(", "),
  )}
   `;

  return await generateObject({
    model: openai("gpt-4o-mini"),
    system: seoRevisionSystem,
    prompt: seoRevisionPrompt,
    schema: finalOutlineSchema,
  });
}

async function reviseEditorialOutline({
  term,
  outlineToRefine,
  reviewReport,
}: {
  term: string;
  outlineToRefine: z.infer<typeof initialOutlineSchema>["outline"];
  reviewReport: TaskOutput<typeof performEditorialEvalTask>;
}) {
  const editorialRevisionSystem = `
  You are a **Senior Editor & Content Strategist** with extensive experience in creating engaging and accurate technical content for API development and computer science audiences.

  Task:
  - Refine the provided outline based on the editorial review report and guidelines.
  - Ensure the content flows logically, is engaging, and meets high editorial standards.

  **Guidelines for Revised Outline:**
  1. Clarity and Conciseness: Ensure each section heading and description is clear, concise, and easy to understand.
  2. Accuracy: Verify that the information presented is factually correct and up-to-date.
  3. Engagement: Make headers and descriptions compelling to maintain reader interest.
  4. Tone and Style: Maintain a professional and technical tone suitable for API developers and computer scientists.
  5. Completeness: Ensure the outline comprehensively covers the topic without being redundant.
  6. Flow and Structure: Organize sections logically for a smooth reading experience.
  7. Actionability: Where appropriate, ensure the content provides actionable insights or information.
  8. Uniqueness: Each section should offer unique value and avoid repetition.

  You have the ability to add, modify, or merge sections in the outline as needed to create the most effective and editorially sound structure.
  Focus on the quality of the content, its organization, and its appeal to the target audience.
  `;

  const editorialRevisionPrompt = `
  Review the following outline for the term "${term}":

  Outline to refine:
  ${JSON.stringify(outlineToRefine)}

  Editorial Review Report:
  ${JSON.stringify(reviewReport)}

  Please refine the outline according to the guidelines and the review report to produce a polished, publish-ready structure.
  `;

  return await generateObject({
    model: openai("gpt-4o-mini"),
    system: editorialRevisionSystem,
    prompt: editorialRevisionPrompt,
    schema: finalOutlineSchema,
  });
}
