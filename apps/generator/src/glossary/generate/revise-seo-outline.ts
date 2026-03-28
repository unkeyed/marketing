import {
  type SelectKeywords,
  insertSectionContentTypeSchema,
  insertSectionSchema,
  selectKeywordsSchema,
} from "@/lib/db-marketing/schemas";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { EvalResult } from "../evaluate/evals";

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
  reviewReport: EvalResult;
  seoKeywordsToAllocate: Array<SelectKeywords>;
};

export async function reviseSEOOutline({
  term,
  outlineToRefine,
  reviewReport,
  seoKeywordsToAllocate,
}: TaskInput) {
  return withRetry(
    async () => {
      console.info(`[task=revise_seo_outline] Starting SEO revision for term: ${term}`);

      const seoRevisionSystem = `
You are a **Senior SEO Strategist & Technical Content Specialist** with over 10 years of experience in optimizing content for API development and computer science domains.

Task:
- Refine the outline you're given based on the review report and guidelines
- Allocate the provided keywords to the provided outline items

**CRITICAL SCHEMA REQUIREMENTS:**
You must return a JSON object with an "outline" array. Each section must have:
- heading: string (required, under 70 characters, SEO-optimized)
- description: string (required, detailed explanation)
- order: number (required, sequential starting from 1)
- citedSources: string URL (required, must be a valid URL)
- contentTypes: array of objects with:
  - type: one of ["listicle", "table", "image", "code", "infographic", "timeline", "other", "text", "video"]
  - description: string
  - whyToUse: string
- keywords: array of objects with structure { keyword: "exact keyword string" }

**Guidelines for Revised Outline:**
1. Make each header unique and descriptive
2. Include relevant keywords in headers (use only provided keywords)
3. Keep headers concise (ideally under 60 characters)
4. Make headers compelling and engaging
5. Optimize headers for featured snippets
6. Avoid keyword stuffing in headers
7. Use long-tail keywords where appropriate
8. Ensure headers effectively break up the text

**CRITICAL KEYWORD RULES:**
9. You MUST ONLY allocate keywords that are in the exact provided list
10. Copy keywords EXACTLY as they appear - no modifications
11. Each keyword can only be used ONCE across all sections
12. If no provided keywords fit a section, leave keywords array empty []
13. NEVER create new keywords or variations
14. NEVER combine or modify existing keywords
15. The keywords field must contain objects like: { "keyword": "exact string from list" }

**Additional Considerations:**
- Headers should read naturally and logically
- Headers should explain the content of their respective sections
- Headers should be distinct from each other
- Optimize for SEO without sacrificing readability
- Write for API developers, not general internet users
- Maintain a technical tone appropriate for the audience

You have the ability to add, modify, or merge sections in the outline as needed to create the most effective and SEO-optimized structure.
`;

      const ratings =
        typeof reviewReport.ratings === "string"
          ? JSON.parse(reviewReport.ratings)
          : reviewReport.ratings;
      const recommendations =
        typeof reviewReport.recommendations === "string"
          ? JSON.parse(reviewReport.recommendations)
          : reviewReport.recommendations;

      const allKeywords = seoKeywordsToAllocate.map((k) => k.keyword);
      const relatedSearchKeywords = seoKeywordsToAllocate
        .filter((k) => k.source === "related_searches")
        .map((k) => k.keyword);
      const autoSuggestKeywords = seoKeywordsToAllocate
        .filter((k) => k.source === "auto_suggest")
        .map((k) => k.keyword);

      const seoRevisionPrompt = `
Review and SEO-optimize the outline for "${term}".

Current outline structure (${outlineToRefine.length} sections):
${outlineToRefine.map((s, i) => `${i + 1}. ${s.heading}`).join("\n")}

SEO Review Feedback:
- Accuracy: ${ratings?.accuracy || "N/A"}/10
- Completeness: ${ratings?.completeness || "N/A"}/10
- Clarity: ${ratings?.clarity || "N/A"}/10

SEO Recommendations:
${recommendations?.map((r: any) => `- ${r.type}: ${r.description}`).join("\n") || "No specific recommendations"}

CRITICAL: You MUST ONLY use keywords from this exact list. DO NOT create new keywords:

ALL AVAILABLE KEYWORDS (${allKeywords.length} total):
${allKeywords.map((k, i) => `${i + 1}. "${k}"`).join("\n")}

Breakdown by source:
- Related Searches (${relatedSearchKeywords.length}): ${relatedSearchKeywords.join(", ")}
- Auto Suggest (${autoSuggestKeywords.length}): ${autoSuggestKeywords.join(", ")}

RULES:
1. ONLY use keywords from the list above - copy them EXACTLY as shown
2. Each keyword can only be used ONCE across all sections
3. If no keywords fit a section, leave that section's keywords array empty
4. DO NOT modify, combine, or create variations of the keywords
5. DO NOT add keywords that aren't in the list above

Example of CORRECT keyword allocation:
"keywords": [
  { "keyword": "${allKeywords[0] || "exact keyword from list"}" }
]

Example of INCORRECT (do not do this):
"keywords": [
  { "keyword": "distributed tracing" }  // Not in the list
  { "keyword": "monitoring and debugging" }  // Modified/combined keywords
]
`;

      const result = await generateObject({
        model: openai("gpt-4o-mini"),
        system: seoRevisionSystem,
        prompt: seoRevisionPrompt,
        schema: seoOutlineSchema,
        experimental_repairText: async (res) => {
          console.warn("[revise_seo_outline] Schema mismatch, attempting repair");

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
                if (Array.isArray(section.keywords)) {
                  fixed.keywords = section.keywords.map((k: any) =>
                    typeof k === "string" ? { keyword: k } : k,
                  );
                } else {
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

            const finalParseResult = seoOutlineSchema.safeParse(parsed);
            if (finalParseResult.success) {
              return JSON.stringify(parsed);
            }
            throw new Error("Could not repair the response");
          } catch (error) {
            console.error("[revise_seo_outline] Repair failed:", error);
            throw error;
          }
        },
        experimental_telemetry: {
          functionId: "reviseSEOOutline",
          recordInputs: true,
          recordOutputs: true,
        },
      });

      console.info(`[task=revise_seo_outline] Completed SEO revision for term: ${term}`);

      return result.object;
    },
    { maxAttempts: 5, label: "reviseSEOOutline" },
  );
}
