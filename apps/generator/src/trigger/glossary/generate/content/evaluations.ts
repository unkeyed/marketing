import { google } from "@/lib/google";
import { openai } from "@/lib/openai";
import { AbortTaskRunError, batch, metadata, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { z } from "zod";
import { researchKeywords } from "../../research/keywords/_research-keywords";

/**
 * Unified improvement object for all evaluations
 */
export const improvementSchema = z.object({
  category: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning", "info", "success"]),
  improvement: z.string(),
});

/**
 * Unified evaluation result schema for all evaluation types
 */
export const evaluationResultSchema = z.object({
  score: z.number().min(0).max(10),
  passed: z.boolean(),
  summary: z.string().max(200),
  reasoning: z.string().max(500).optional(),
  improvements: z.array(improvementSchema),
  metadata: z.record(z.any()).optional(),
  markdown: z.string().optional(),
});

/**
 * Task that runs both technical and SEO evaluations in parallel and returns a combined result.
 *
 * @param term - The glossary term being reviewed
 * @param content - The markdown content to review
 * @returns Object containing both technical and SEO evaluation results, pass/fail, and summary
 */
export const reviewGenerationTask = task({
  id: "review_generation",
  onStart: async (params) => {
    const { term, content } = params.payload;
    metadata.replace({
      term,
      status: "running",
      startedAt: new Date().toISOString(),
      contentLength: content.length,
      progress: 0,
    });
  },
  onSuccess: async () => {
    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());
    metadata.set("progress", 1);
  },
  run: async ({ term, content }: { term: string; content: string }) => {
    // if term or content is empty throw an AbortTaskRunError
    if (!term || !content) {
      throw new AbortTaskRunError("Term or content is empty");
    }
    metadata.set("progress", 0.1);
    metadata.set("status", "evaluating");
    // Run both tasks in parallel
    const [technical, seo] = (
      await batch.triggerByTaskAndWait([
        { task: technicalReviewTask, payload: { term, content } },
        { task: seoReviewTask, payload: { term, content } },
      ])
    ).runs.map((r) => {
      if (!r.ok) {
        console.warn(`Error in task run ${r.taskIdentifier}:`, r.error);
        return null;
      }
      return r.output;
    }).filter(Boolean);

    const passed = (seo?.passed ?? false) && (technical?.passed ?? false);
    const summary = `
      ${seo?.passed ? "SEO passed." : "SEO did not pass."}
      ${technical?.passed ? "Technical review passed." : "Technical review did not pass."}
    `.trim().replace(/\s+/g, " ");

    metadata.set("progress", 0.9);
    metadata.set("status", "combining");
    return {
      technical,
      seo,
      passed,
      summary: summary.trim(),
    };
  },
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
  onStart: async (params) => {
    const { term, content } = params.payload;
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
Your task is to review, rate, and improve the content for a glossary entry on "${term}".

IMPORTANT FORMATTING RULES:
- Keep all responses extremely concise and avoid any repetition
- The 'reasoning' field MUST be exactly 1-2 short sentences (max 500 characters)
- The 'summary' field MUST be exactly 1 sentence (max 200 characters)
- Each improvement MUST be a single, actionable item
- Never repeat the same point multiple times

Example response format:
{
  "score": 7.5,
  "passed": true,
  "summary": "Good technical explanation but needs code examples.",
  "reasoning": "Content explains the concept well but lacks practical implementation details.",
  "improvements": [
    {
      "category": "code examples",
      "message": "No TypeScript examples provided",
      "severity": "error",
      "improvement": "Add a TypeScript code example showing HATEOAS implementation"
    }
  ]
}`;

    const prompt = `Review and improve the following content:

${content}

Guidelines:
1. Check technical accuracy and clarity
2. Verify structure and flow
3. Ensure code examples use TypeScript/ESM
4. Focus on API developer value
5. Remove redundant information
6. Fix any grammar issues
7. Keep content focused but complete

Response must include:
- score: (0-10)
- passed: (true/false)
- summary: (1 sentence only)
- reasoning: (1-2 sentences max)
- improvements: (array of improvement objects)
- markdown: (improved content if needed)`;

    // Update metadata to show we're reviewing content
    metadata.set("progress", 0.5);
    metadata.set("status", "reviewing");

    try {
      const result = await generateObject({
        model: google("gemini-2.5-pro-exp-03-25") as any,
        schema: evaluationResultSchema,
        prompt,
        system,
        temperature: 0.3,
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
      metadata.set("score", result.object.score);
      metadata.set("improvementsCount", result.object.improvements?.length || 0);
      if (result.object.markdown) {
        metadata.set("revisedContentLength", result.object.markdown.length);
      }

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

export const seoReviewTask = task({
  id: "seo_review",
  onStart: async (params) => {
    const { term, content } = params.payload;
    metadata.replace({
      term,
      status: "running",
      startedAt: new Date().toISOString(),
      contentLength: content.length,
      progress: 0,
    });
  },
  onSuccess: async () => {
    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());
    metadata.set("progress", 1);
  },
  run: async ({ term, content }: { term: string; content: string }) => {
    // Step 1: Get relevant keywords for the term
    const kwResult = await researchKeywords.triggerAndWait({ inputTerm: term });
    const keywords: string[] = kwResult.ok
      ? kwResult.output.keywords.map((k: any) => `${k.keyword} (${k.volume})`)
      : [];
    // Step 2: Compose the SEO review prompt with keywords
    const system = `You are an expert SEO specialist for technical and API documentation.
Your task is to review the following glossary entry content for SEO best practices, discoverability, and clarity for search engines.

IMPORTANT FORMATTING RULES:
- Keep all responses extremely concise and avoid any repetition
- The 'reasoning' field MUST be exactly 1-2 short sentences (max 500 characters)
- The 'summary' field MUST be exactly 1 sentence (max 200 characters)
- Each improvement MUST be a single, actionable item
- Never repeat the same point multiple times

Example response format:
{
  "score": 7.5,
  "passed": true,
  "summary": "Good keyword usage but needs more practical examples.",
  "reasoning": "Content covers core concepts well but lacks depth in implementation details.",
  "improvements": [
    {
      "category": "keyword usage",
      "message": "Missing important keyword 'REST API'",
      "severity": "warning",
      "improvement": "Add 'REST API' in the first paragraph"
    }
  ]
}`;

    const prompt = `Review the following content for SEO:

${content}

Relevant keywords for this term: ${keywords.join("\n")}

Guidelines:
1. Check keyword usage (including "${term}")
2. Evaluate readability and clarity
3. Check content structure and depth

Response must include:
- score: (0-10)
- passed: (true/false)
- summary: (1 sentence only)
- reasoning: (1-2 sentences max)
- improvements: (array of improvement objects)
- metadata: (optional SEO info)`;
    metadata.set("progress", 0.5);
    metadata.set("status", "reviewing");
    try {
      const result = await generateObject({
        model: google("gemini-2.5-pro-exp-03-25") as any,
        schema: evaluationResultSchema,
        prompt,
        system,
        temperature: 0.3,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "seo_review",
        },
      });
      if (result.usage) {
        metadata.set("tokenUsage", {
          total: result.usage.totalTokens,
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
        });
      }
      metadata.set("score", result.object.score);
      metadata.set("passed", result.object.passed);
      return result.object;
    } catch (error) {
      console.error("Error in SEO review:", error);
      // Save the failed response text to disk if available
      if (process.env.NODE_ENV === "development") {
        if (error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "message" in error.cause) {
          const message = String(error.cause.message);
          const match = message.match(/Text: ([\s\S]*)$/);
          if (match && match[1]) {
            const fs = await import("fs/promises");
            await fs.writeFile("./failed-seo-response.txt", match[1], "utf8");
            console.info("Saved failed SEO response to ./failed-seo-response.txt");
          }
        }
      }
      metadata.set("status", "failed");
      metadata.set("error", typeof error === "object" ? JSON.stringify(error) : String(error));
      metadata.set("completedAt", new Date().toISOString());
      throw new AbortTaskRunError(`SEO review failed for term: ${term}`);
    }
  },
}); 