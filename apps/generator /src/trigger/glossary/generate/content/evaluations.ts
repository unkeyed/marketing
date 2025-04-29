import { z } from "zod";
import { task } from "@trigger.dev/sdk/v3";

// Input schema for evaluation tasks
const evaluationInputSchema = z.object({
  content: z.string(),
  term: z.string(),
});

// Unified evaluation schema that combines both approaches
const evaluationResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(10), // Using 0-10 scale like contentReviewSchema for consistency
  feedback: z.array(z.object({
    category: z.string(),
    message: z.string(),
    severity: z.enum(["error", "warning", "info", "success"]),
    improvement: z.string().optional(), // From contentReviewSchema's improvements
  })),
  reasoning: z.string(), // From contentReviewSchema, but making it required
  metadata: z.record(z.any()).optional(),
});

type EvaluationInput = z.infer<typeof evaluationInputSchema>;
type EvaluationResult = z.infer<typeof evaluationResultSchema>;

// Temporary placeholder for the technical review task
// This will be fully implemented in step 2
export const technicalReviewTask = task({
  id: "technical-review",
  run: async ({ content, term }: EvaluationInput): Promise<EvaluationResult> => {
    throw new Error("Not implemented yet");
  },
});

export { evaluationResultSchema }; 