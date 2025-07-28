import { openai } from "@ai-sdk/openai";
import { task, type TaskOutput } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { z } from "zod";
import type { CacheStrategy } from "../_generate-glossary-entry";
import type { performSEOEvalTask } from "../evaluate/evals";
import {
  insertSectionContentTypeSchema,
  insertSectionSchema,
  selectKeywordsSchema,
  type SelectKeywords,
} from "@/lib/db-marketing/schemas";

// Schema for the SEO revised outline (includes keywords)
const seoOutlineSchema = z.object({
  outline: z.array(
    insertSectionSchema.omit({ entryId: true }).extend({
      citedSources: z.string().url(),
      contentTypes: z.array(insertSectionContentTypeSchema.omit({ sectionId: true })),
      keywords: z.array(selectKeywordsSchema.pick({ keyword: true })),
    }),
  ),
});

type TaskInput = {
  term: string;
  outlineToRefine: z.infer<typeof seoOutlineSchema>["outline"];
  reviewReport: TaskOutput<typeof performSEOEvalTask>;
  seoKeywordsToAllocate: Array<SelectKeywords>;
  onCacheHit?: CacheStrategy;
};

export const reviseSEOOutlineTask = task({
  id: "revise_seo_outline",
  retry: {
    maxAttempts: 5,
  },
  run: async ({ term, outlineToRefine, reviewReport, seoKeywordsToAllocate }: TaskInput) => {
    console.info(`[task=revise_seo_outline] Starting SEO revision for term: ${term}`);

    const seoRevisionSystem = `
You are a **Senior SEO Strategist & Technical Content Specialist** with over 10 years of experience in optimizing content for API development and computer science domains.

Task:
- Refine the outline you're given based on the review report and guidelines
- Allocate the provided keywords to the provided outline items

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
- Headers should read naturally and logically
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
${JSON.stringify(outlineToRefine, null, 2)}

Review report:
${JSON.stringify(reviewReport, null, 2)}

Provided keywords:
Related Searches: ${seoKeywordsToAllocate
  .filter((k) => k.source === "related_searches")
  .map((k) => k.keyword)
  .join(", ")}
Auto Suggest: ${seoKeywordsToAllocate
  .filter((k) => k.source === "auto_suggest")
  .map((k) => k.keyword)
  .join(", ")}
`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: seoRevisionSystem,
      prompt: seoRevisionPrompt,
      schema: seoOutlineSchema,
      experimental_telemetry: {
        functionId: "reviseSEOOutline",
        recordInputs: true,
        recordOutputs: true,
      },
    });

    console.info(`[task=revise_seo_outline] Completed SEO revision for term: ${term}`);

    return result.object;
  },
});