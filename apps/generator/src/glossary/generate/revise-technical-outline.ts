import { insertSectionContentTypeSchema, insertSectionSchema } from "@/lib/db-marketing/schemas";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { CacheStrategy } from "../generate-glossary-entry";
import type { EvalResult } from "../evaluate/evals";

const technicalOutlineSchema = z.object({
  outline: z.array(
    insertSectionSchema.omit({ entryId: true }).extend({
      citedSources: z.string().url(),
      contentTypes: z.array(insertSectionContentTypeSchema.omit({ sectionId: true })),
    }),
  ),
});

type TaskInput = {
  term: string;
  outlineToRefine: z.infer<typeof technicalOutlineSchema>["outline"];
  reviewReport: EvalResult;
  technicalContext: string;
  onCacheHit?: CacheStrategy;
};

export async function reviseTechnicalOutline({ term, outlineToRefine, reviewReport, technicalContext }: TaskInput) {
  return withRetry(async () => {
    console.info(`[task=revise_technical_outline] Starting technical revision for term: ${term}`);

    const technicalRevisionSystem = `
You are a **Senior Technical Architect & API Documentation Expert** with deep expertise in computer science fundamentals and API development.

Task:
- Refine the provided outline based on the technical review report and guidelines
- Ensure technical accuracy and completeness while maintaining accessibility

**CRITICAL SCHEMA REQUIREMENTS:**
You must return a JSON object with an "outline" array. Each section in the outline must have:
- heading: string (required, under 70 characters)
- description: string (required, detailed explanation of section content)
- order: number (required, starting from 1)
- citedSources: string URL (required, must be a valid URL - use the most authoritative source)
- contentTypes: array of objects with:
  - type: one of ["listicle", "table", "image", "code", "infographic", "timeline", "other", "text", "video"]
  - description: string explaining what content to create
  - whyToUse: string explaining why this content type is appropriate

**Guidelines for Technical Revision:**
1. **Accuracy**: Ensure all technical information is correct and up-to-date
2. **Completeness**: Add missing technical details identified in the review
3. **Depth**: Provide appropriate technical depth for API developers
4. **Examples**: Include or plan for code examples where beneficial
5. **Best Practices**: Incorporate industry standards and best practices
6. **Error Handling**: Address edge cases and error scenarios where relevant
7. **Performance**: Include performance considerations where applicable
8. **Security**: Address security implications if relevant to the topic
9. **Architecture**: Ensure proper architectural context is provided
10. **Practical Application**: Focus on real-world implementation details

**Additional Considerations:**
- Maintain balance between theory and practical application
- Use precise technical terminology
- Ensure logical flow from fundamentals to advanced concepts
- Reference authoritative sources where appropriate
- Consider both beginners and experienced developers

You have the ability to add, modify, or merge sections in the outline as needed to create the most technically accurate and comprehensive structure.
`;

    const ratings =
      typeof reviewReport.ratings === "string"
        ? JSON.parse(reviewReport.ratings)
        : reviewReport.ratings;
    const recommendations =
      typeof reviewReport.recommendations === "string"
        ? JSON.parse(reviewReport.recommendations)
        : reviewReport.recommendations;

    const technicalRevisionPrompt = `
Review and refine the outline for the term "${term}".

Current outline has ${outlineToRefine.length} sections:
${outlineToRefine.map((s, i) => `${i + 1}. ${s.heading} - ${s.description.substring(0, 100)}...`).join("\n")}

Technical Review Feedback:
- Accuracy Rating: ${ratings?.accuracy || "N/A"}/10
- Completeness Rating: ${ratings?.completeness || "N/A"}/10
- Clarity Rating: ${ratings?.clarity || "N/A"}/10

Key Recommendations:
${recommendations?.map((r: any) => `- ${r.type}: ${r.description}`).join("\n") || "No specific recommendations"}

Technical Context Summary:
${technicalContext.substring(0, 1000)}...

Please refine the outline based on the review feedback. Apply the recommendations to improve technical accuracy and completeness.

IMPORTANT: Return a JSON object with an "outline" array containing ALL sections. Each section must follow this exact structure:
{
  "heading": "Clear, descriptive heading under 70 characters",
  "description": "Detailed explanation of what this section will cover",
  "order": 1,
  "citedSources": "https://authoritative-source.com/relevant-page",
  "contentTypes": [
    {
      "type": "code",
      "description": "What content will be created",
      "whyToUse": "Why this content type is appropriate"
    }
  ]
}

Notes:
- "order" must be sequential starting from 1
- "citedSources" is REQUIRED - use the most relevant URL from the technical context
- "type" must be one of: listicle, table, image, code, infographic, timeline, other, text, video
- Include multiple contentTypes if appropriate for the section
- Keep descriptions concise (100-200 words) to avoid truncation
- Aim for 6-10 sections total
`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: technicalRevisionSystem,
      prompt: technicalRevisionPrompt,
      schema: technicalOutlineSchema,
      experimental_repairText: async (res) => {
        console.warn("[revise_technical_outline] Schema mismatch, attempting repair");

        try {
          const trimmedText = res.text.trim();
          const lastChars = trimmedText.slice(-20);
          const hasProperEnding = trimmedText.endsWith("}]}") || trimmedText.endsWith("}]\n}");

          if (!hasProperEnding) {
            console.error("[revise_technical_outline] Response appears truncated");
            console.error("Actual ending:", lastChars);
            throw new Error(
              "Response was truncated. The outline is incomplete. Try reducing the number of sections or description length.",
            );
          }

          let parsed: any;
          try {
            parsed = JSON.parse(res.text);
          } catch (e) {
            console.error("[revise_technical_outline] JSON parse failed despite proper ending");
            throw new Error("Invalid JSON format. Please try again.");
          }

          if (!parsed.outline) {
            parsed = { outline: Array.isArray(parsed) ? parsed : [parsed] };
          }

          if (Array.isArray(parsed.outline)) {
            parsed.outline = parsed.outline.map((section: any, index: number) => {
              const fixed: any = { ...section };
              if (!section.heading) fixed.heading = `Section ${index + 1}`;
              if (!section.description) fixed.description = "Description pending.";
              if (!section.order) fixed.order = index + 1;
              if (!section.citedSources) fixed.citedSources = "https://developer.mozilla.org/";
              if (!Array.isArray(section.contentTypes)) {
                fixed.contentTypes = [{ type: "text", description: "Default content type", whyToUse: "Placeholder for missing content type" }];
              }
              fixed.contentTypes = fixed.contentTypes.map((ct: any) => ({
                type: ct.type || "text",
                description: ct.description || "Content description",
                whyToUse: ct.whyToUse || "Reason for using this content type",
              }));
              return fixed;
            });
          }

          const finalParseResult = technicalOutlineSchema.safeParse(parsed);
          if (finalParseResult.success) {
            return JSON.stringify(parsed);
          }
          throw new Error("Could not repair the response to match schema");
        } catch (error) {
          console.error("[revise_technical_outline] Repair failed:", error);
          throw error;
        }
      },
      experimental_telemetry: {
        functionId: "reviseTechnicalOutline",
        recordInputs: true,
        recordOutputs: true,
      },
    });

    console.info(`[task=revise_technical_outline] Completed technical revision for term: ${term}`);

    return result.object;
  }, { maxAttempts: 5, label: "reviseTechnicalOutline" });
}
