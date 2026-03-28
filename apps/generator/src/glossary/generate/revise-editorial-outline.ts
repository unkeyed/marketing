import {
  insertSectionContentTypeSchema,
  insertSectionSchema,
  selectKeywordsSchema,
} from "@/lib/db-marketing/schemas";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { EvalResult } from "../evaluate/evals";

const editorialOutlineSchema = z.object({
  outline: z.array(
    insertSectionSchema.omit({ entryId: true }).extend({
      citedSources: z.string().url(),
      contentTypes: z.array(insertSectionContentTypeSchema.omit({ sectionId: true })),
      keywords: z.array(selectKeywordsSchema.pick({ keyword: true })).optional(),
    }),
  ),
});

type TaskInput = {
  term: string;
  outlineToRefine: z.infer<typeof editorialOutlineSchema>["outline"];
  reviewReport: EvalResult;
};

export async function reviseEditorialOutline({ term, outlineToRefine, reviewReport }: TaskInput) {
  return withRetry(
    async () => {
      console.info(`[task=revise_editorial_outline] Starting editorial revision for term: ${term}`);

      const editorialRevisionSystem = `
You are a **Senior Editor & Content Strategist** with extensive experience in creating engaging and accurate technical content for API development and computer science audiences.

Task:
- Refine the provided outline based on the editorial review report and guidelines
- Ensure the content flows logically, is engaging, and meets high editorial standards
- Maintain the keywords allocated in the previous SEO revision step

**CRITICAL SCHEMA REQUIREMENTS:**
You must return a JSON object with an "outline" array. Each section must have:
- heading: string (required, clear and engaging, under 70 characters)
- description: string (required, comprehensive explanation)
- order: number (required, sequential starting from 1)
- citedSources: string URL (required, must be a valid URL)
- contentTypes: array of objects with:
  - type: one of ["listicle", "table", "image", "code", "infographic", "timeline", "other", "text", "video"]
  - description: string
  - whyToUse: string

NOTE: Keywords are managed separately and not included in this revision.

**Guidelines for Revised Outline:**
1. **Clarity and Conciseness**: Ensure each section heading and description is clear, concise, and easy to understand
2. **Accuracy**: Verify that the information presented is factually correct and up-to-date
3. **Engagement**: Make headers and descriptions compelling to maintain reader interest
4. **Tone and Style**: Maintain a professional and technical tone suitable for API developers and computer scientists
5. **Completeness**: Ensure the outline comprehensively covers the topic without being redundant
6. **Flow and Structure**: Organize sections logically for a smooth reading experience
7. **Actionability**: Where appropriate, ensure the content provides actionable insights or information
8. **Uniqueness**: Each section should offer unique value and avoid repetition
9. **Keywords**: CRITICAL - Preserve the keywords array exactly as provided

**Additional Considerations:**
- Focus on the quality of the content, its organization, and its appeal to the target audience
- Ensure smooth transitions between sections
- Consider the reader's journey from introduction to advanced concepts
- Maintain consistency in terminology and style
- Balance technical depth with accessibility

You have the ability to modify or merge sections in the outline as needed to create the most effective and editorially sound structure. However, preserve the keyword allocations from the SEO revision.
`;

      const ratings =
        typeof reviewReport.ratings === "string"
          ? JSON.parse(reviewReport.ratings)
          : reviewReport.ratings;
      const recommendations =
        typeof reviewReport.recommendations === "string"
          ? JSON.parse(reviewReport.recommendations)
          : reviewReport.recommendations;

      const editorialRevisionPrompt = `
Review and polish the outline for "${term}" from an editorial perspective.

Current sections (${outlineToRefine.length} total):
${outlineToRefine.map((s, i) => `${i + 1}. ${s.heading}`).join("\n")}

Editorial Review Feedback:
- Accuracy: ${ratings?.accuracy || "N/A"}/10
- Completeness: ${ratings?.completeness || "N/A"}/10
- Clarity: ${ratings?.clarity || "N/A"}/10

Editorial Recommendations:
${recommendations?.map((r: any) => `- ${r.type}: ${r.description}`).join("\n") || "No specific recommendations"}

Refine the outline for clarity, flow, and engagement while maintaining technical accuracy.

Your focus should ONLY be on:
- Improving section headings for clarity and engagement
- Enhancing descriptions to be more comprehensive
- Ensuring logical flow between sections
- Making content more actionable where appropriate
- Adjusting contentTypes if needed

BUT NEVER touch the keywords array - copy it exactly as is!
`;

      const result = await generateObject({
        model: openai("gpt-4o-mini"),
        system: editorialRevisionSystem,
        prompt: editorialRevisionPrompt,
        schema: editorialOutlineSchema,
        experimental_repairText: async (res) => {
          console.warn("[revise_editorial_outline] Schema mismatch, attempting repair");

          try {
            const trimmedText = res.text.trim();
            const hasProperEnding = trimmedText.endsWith("}]}") || trimmedText.endsWith("}]\n}");

            if (!hasProperEnding) {
              throw new Error(
                "Response was truncated. Try reducing sections or using shorter descriptions.",
              );
            }

            let parsed: any;
            try {
              parsed = JSON.parse(res.text);
            } catch (_e) {
              throw new Error("Invalid JSON format.");
            }

            if (!parsed.outline) {
              parsed = { outline: Array.isArray(parsed) ? parsed : [parsed] };
            }

            if (Array.isArray(parsed.outline)) {
              parsed.outline = parsed.outline.map((section: any, index: number) => {
                const fixed: any = { ...section };
                if (!section.heading) {
                  fixed.heading = `Section ${index + 1}`;
                }
                if (!section.description) {
                  fixed.description = "Description pending.";
                }
                if (!section.order) {
                  fixed.order = index + 1;
                }
                if (!section.citedSources) {
                  fixed.citedSources = "https://www.w3.org/TR/trace-context/";
                }
                if (!Array.isArray(section.keywords)) {
                  fixed.keywords = [];
                }
                if (!Array.isArray(section.contentTypes)) {
                  fixed.contentTypes = [
                    { type: "text", description: "Default content", whyToUse: "Default reason" },
                  ];
                } else {
                  fixed.contentTypes = section.contentTypes.map((ct: any) => ({
                    type: ct.type || "text",
                    description: ct.description || "Content description",
                    whyToUse: ct.whyToUse || "Reason for content type",
                  }));
                }
                return fixed;
              });
            }

            const finalParseResult = editorialOutlineSchema.safeParse(parsed);
            if (finalParseResult.success) {
              return JSON.stringify(parsed);
            }
            throw new Error("Could not repair the response");
          } catch (error) {
            console.error("[revise_editorial_outline] Repair failed:", error);
            throw error;
          }
        },
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
    { maxAttempts: 5, label: "reviseEditorialOutline" },
  );
}
