import { insertSectionContentTypeSchema, insertSectionSchema } from "@/lib/db-marketing/schemas";
import { openai } from "@ai-sdk/openai";
import { type TaskOutput, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { z } from "zod";
import type { CacheStrategy } from "../_generate-glossary-entry";
import type { performTechnicalEvalTask } from "../evaluate/evals";

// Schema for the revised outline
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
  reviewReport: TaskOutput<typeof performTechnicalEvalTask>;
  technicalContext: string;
  onCacheHit?: CacheStrategy;
};

export const reviseTechnicalOutlineTask = task({
  id: "revise_technical_outline",
  retry: {
    maxAttempts: 5,
  },
  run: async ({ term, outlineToRefine, reviewReport, technicalContext }: TaskInput) => {
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

    // Parse ratings and recommendations if they are strings
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
          // First check if JSON appears complete
          const trimmedText = res.text.trim();
          const lastChars = trimmedText.slice(-20);
          const hasProperEnding = trimmedText.endsWith("}]}") || trimmedText.endsWith("}]\n}");

          if (!hasProperEnding) {
            console.error("[revise_technical_outline] ❌ Response appears truncated");
            console.error("Expected ending: }]} or }]\n}");
            console.error("Actual ending:", lastChars);
            console.error("Full length:", trimmedText.length, "characters");

            // Check bracket balance as additional validation
            const openBrackets = (trimmedText.match(/[{\[]/g) || []).length;
            const closeBrackets = (trimmedText.match(/[}\]]/g) || []).length;
            console.error(
              "Bracket balance: { [ opened:",
              openBrackets,
              "} ] closed:",
              closeBrackets,
            );

            throw new Error(
              "Response was truncated. The outline is incomplete. Try reducing the number of sections or description length.",
            );
          }

          // Try to parse as JSON
          let parsed: any;
          try {
            parsed = JSON.parse(res.text);
          } catch (e) {
            console.error("[revise_technical_outline] ❌ JSON parse failed despite proper ending");
            console.error("Parse error:", e);
            console.error("Raw text (last 200 chars):", res.text.slice(-200));
            throw new Error("Invalid JSON format. Please try again.");
          }

          // First check what validation errors we have
          const initialParseResult = technicalOutlineSchema.safeParse(parsed);
          if (!initialParseResult.success) {
            console.error("[revise_technical_outline] ❌ Initial Zod validation errors:");
            initialParseResult.error.issues.forEach((issue, index) => {
              console.error(`  ${index + 1}. Path: ${issue.path.join(".")}`);
              console.error(`     Error: ${issue.message}`);
              console.error(`     Type: ${issue.code}`);
              if (issue.code === "invalid_type") {
                console.error(`     Expected: ${issue.expected}, Received: ${issue.received}`);
              }
            });
          }

          // Ensure it has an outline array
          if (!parsed.outline) {
            parsed = { outline: Array.isArray(parsed) ? parsed : [parsed] };
          }

          // Fix each section in the outline
          if (Array.isArray(parsed.outline)) {
            parsed.outline = parsed.outline.map((section: any, index: number) => {
              const fixes: string[] = [];

              // Add missing required fields with defaults
              const fixed: any = { ...section };

              if (!section.heading) {
                fixed.heading = `Section ${index + 1}`;
                fixes.push("heading");
              }
              if (!section.description) {
                fixed.description = "Description pending.";
                fixes.push("description");
              }
              if (!section.order) {
                fixed.order = index + 1;
                fixes.push("order");
              }
              if (!section.citedSources) {
                fixed.citedSources = "https://developer.mozilla.org/";
                fixes.push("citedSources");
              }
              if (!Array.isArray(section.contentTypes)) {
                fixed.contentTypes = [
                  {
                    type: "text",
                    description: "Default content type",
                    whyToUse: "Placeholder for missing content type",
                  },
                ];
                fixes.push("contentTypes");
              }

              // Validate contentTypes have required fields
              fixed.contentTypes = fixed.contentTypes.map((ct: any) => ({
                type: ct.type || "text",
                description: ct.description || "Content description",
                whyToUse: ct.whyToUse || "Reason for using this content type",
              }));

              if (fixes.length > 0) {
                console.info(
                  `[revise_technical_outline] Applied fixes to section ${index + 1}: ${fixes.join(", ")}`,
                );
              }

              return fixed;
            });
          }

          // Try parsing with our schema again
          const finalParseResult = technicalOutlineSchema.safeParse(parsed);
          if (finalParseResult.success) {
            return JSON.stringify(parsed);
          }
          console.error(
            "[revise_technical_outline] ❌ Schema validation still failing after repair:",
          );
          finalParseResult.error.issues.forEach((issue, index) => {
            console.error(`  ${index + 1}. Path: ${issue.path.join(".")}`);
            console.error(`     Error: ${issue.message}`);
          });
          throw new Error("Could not repair the response to match schema");
        } catch (error) {
          console.error("[revise_technical_outline] 💥 Repair failed:", error);
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
  },
});
