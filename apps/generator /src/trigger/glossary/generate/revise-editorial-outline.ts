import { openai } from "@ai-sdk/openai";
import { task, type TaskOutput } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { z } from "zod";
import type { CacheStrategy } from "../_generate-glossary-entry";
import type { performEditorialEvalTask } from "../evaluate/evals";
import {
  insertSectionContentTypeSchema,
  insertSectionSchema,
  selectKeywordsSchema,
} from "@/lib/db-marketing/schemas";

// Schema for the editorial revised outline (includes keywords from SEO)
const editorialOutlineSchema = z.object({
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
  outlineToRefine: z.infer<typeof editorialOutlineSchema>["outline"];
  reviewReport: TaskOutput<typeof performEditorialEvalTask>;
  onCacheHit?: CacheStrategy;
};

export const reviseEditorialOutlineTask = task({
  id: "revise_editorial_outline",
  retry: {
    maxAttempts: 5,
  },
  run: async ({ term, outlineToRefine, reviewReport }: TaskInput) => {
    console.info(`[task=revise_editorial_outline] Starting editorial revision for term: ${term}`);

    const editorialRevisionSystem = `
You are a **Senior Editor & Content Strategist** with extensive experience in creating engaging and accurate technical content for API development and computer science audiences.

Task:
- Refine the provided outline based on the editorial review report and guidelines
- Ensure the content flows logically, is engaging, and meets high editorial standards
- Maintain the keywords allocated in the previous SEO revision step

**Guidelines for Revised Outline:**
1. **Clarity and Conciseness**: Ensure each section heading and description is clear, concise, and easy to understand
2. **Accuracy**: Verify that the information presented is factually correct and up-to-date
3. **Engagement**: Make headers and descriptions compelling to maintain reader interest
4. **Tone and Style**: Maintain a professional and technical tone suitable for API developers and computer scientists
5. **Completeness**: Ensure the outline comprehensively covers the topic without being redundant
6. **Flow and Structure**: Organize sections logically for a smooth reading experience
7. **Actionability**: Where appropriate, ensure the content provides actionable insights or information
8. **Uniqueness**: Each section should offer unique value and avoid repetition
9. **Keywords**: Preserve the keywords allocated in the previous step - do not modify the keywords array

**Additional Considerations:**
- Focus on the quality of the content, its organization, and its appeal to the target audience
- Ensure smooth transitions between sections
- Consider the reader's journey from introduction to advanced concepts
- Maintain consistency in terminology and style
- Balance technical depth with accessibility

You have the ability to modify or merge sections in the outline as needed to create the most effective and editorially sound structure. However, preserve the keyword allocations from the SEO revision.
`;

    const editorialRevisionPrompt = `
Review the following outline for the term "${term}":

Outline to refine:
${JSON.stringify(outlineToRefine, null, 2)}

Editorial Review Report:
${JSON.stringify(reviewReport, null, 2)}

Please refine the outline according to the editorial guidelines and the review report to produce a polished, publish-ready structure. Maintain the keywords that were allocated during the SEO revision step.
`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: editorialRevisionSystem,
      prompt: editorialRevisionPrompt,
      schema: editorialOutlineSchema,
      experimental_telemetry: {
        functionId: "reviseEditorialOutline",
        recordInputs: true,
        recordOutputs: true,
      },
    });

    console.info(
      `[task=revise_editorial_outline] Completed editorial revision for term: ${term}`,
    );

    return result.object;
  },
});