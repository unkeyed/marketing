import { google } from "@/lib/google";
import { AbortTaskRunError, metadata, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Schema for technical content review results
 * Validates the structure and types of the technical review output
 */
export const technicalReviewSchema = z.object({
  markdown: z.string().min(1),
  rating: z.number().min(0).max(10),
  improvements: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
});

/**
 * General-purpose schema for evaluation results (e.g., SEO, readability)
 */
export const evaluationResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(10),
  feedback: z.array(
    z.object({
      category: z.string(),
      message: z.string(),
      severity: z.enum(["error", "warning", "info", "success"]),
      improvement: z.string().optional(),
    })
  ),
  reasoning: z.string(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Task that performs a technical review of generated content
 * 
 * This task evaluates the content for:
 * - Technical accuracy and clarity
 * - Code example quality and best practices
 * - Structure and organization
 * - API development focus
 * - Comprehensiveness and relevance
 * 
 * @param term - The glossary term being reviewed
 * @param content - The markdown content to review
 * @returns Object containing improved content, rating, improvements list, and reasoning
 */
export const technicalReviewTask = task({
  id: "technical_review",
  onStart: async ({ term, content }: { term: string; content: string }) => {
    // Initialize metadata
    metadata.replace({
      term,
      status: "running",
      startedAt: new Date().toISOString(),
      contentLength: content.length,
      progress: 0,
    });
  },
  onSuccess: async () => {
    // Update metadata for successful completion
    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());
    metadata.set("progress", 1);
  },
  run: async ({ term, content }: { term: string; content: string }) => {
    const system = `You are a senior technical editor with expertise in API development documentation.
    Your task is to review, rate, and improve the content for a glossary entry on "${term}".`;

    const prompt = `
    Review and improve the following content for a glossary entry on "${term}":
    
    ${content}
    
    Guidelines for your review:
    1. Ensure technical accuracy and clarity.
    2. Improve the structure and flow if needed.
    3. Check that code examples follow best practices and use TypeScript syntax with ESM.
    4. Ensure the content is valuable for API developers (primarily backend developers).
    5. Remove any fluff or redundant information.
    6. Fix any grammatical or stylistic issues.
    7. Ensure the content is comprehensive but focused.
    
    In your response, include:
    - markdown: The improved content in markdown format
    - rating: A rating from 0-10 on the quality of the original content (10 being excellent)
    - improvements: A list of specific improvements you made
    - reasoning: Brief explanation of your rating and key improvements
    `;

    // Update metadata to show we're reviewing content
    metadata.set("progress", 0.5);
    metadata.set("status", "reviewing");

    try {
      const result = await generateObject({
        model: google("gemini-2.0-flash-lite-preview-02-05") as any,
        schema: technicalReviewSchema,
        prompt,
        system,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "technical_review",
        },
      });

      // Update metadata with token usage if available
      if (result.usage) {
        metadata.set("tokenUsage", {
          total: result.usage.totalTokens,
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
        });
      }

      // Update review-specific metadata before onSuccess is called
      metadata.set("rating", result.object.rating);
      metadata.set("improvementsCount", result.object.improvements?.length || 0);
      metadata.set("revisedContentLength", result.object.markdown.length);

      return result.object;
    } catch (error) {
      console.error("Error reviewing content:", error);

      // Update metadata for failure
      metadata.set("status", "failed");
      metadata.set("error", typeof error === "object" ? JSON.stringify(error) : String(error));
      metadata.set("completedAt", new Date().toISOString());

      throw new AbortTaskRunError(`Content review failed for term: ${term}`);
    }
  },
}); 