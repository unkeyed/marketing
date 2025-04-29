import { z } from "zod";
import { type TestCase, createTestRunner, errorResultSchema, okResultSchema } from "@/lib/test";
import { evaluationResultSchema, technicalReviewSchema, technicalReviewTask } from "./evaluations";

// Sample content for testing evaluations
const sampleGlossaryContent = {
  term: "HATEOAS",
  content: "HATEOAS (Hypermedia as the Engine of Application State) is a fundamental constraint of REST architecture...",
};

// Schema for combined evaluation results
const combinedEvaluationSchema = z.object({
  technical: technicalReviewSchema,
  seo: evaluationResultSchema,
  passed: z.boolean(),
  summary: z.string(),
});

const testCases: TestCase<typeof technicalReviewTask>[] = [
  {
    name: "combinedEvaluationTest",
    input: {
      content: sampleGlossaryContent.content,
      term: sampleGlossaryContent.term,
    },
    validate(result) {
      const validation = okResultSchema.safeParse(result);
      if (!validation.success) {
        console.info(
          `Test '${this.name}' failed. Expected a valid result, but got: ${JSON.stringify(result)}`,
        );
        console.info(validation.error.errors.map((e) => e.message).join("\n"));
        return false;
      }

      const outputValidation = combinedEvaluationSchema.safeParse(validation.data.output);
      if (!outputValidation.success) {
        console.warn(
          `Test '${this.name}' failed. Expected a valid combined evaluation result, but got: ${JSON.stringify(
            validation.data.output,
          )}`,
        );
        console.warn(outputValidation.error.errors.map((e) => e.message).join("\n"));
        return false;
      }

      // Validate that both technical and SEO evaluations were performed
      const { technical, seo } = outputValidation.data;
      if (!technical.feedback.length || !seo.feedback.length) {
        console.warn(
          `Test '${this.name}' failed. Both technical and SEO evaluations should provide feedback.`,
        );
        return false;
      }

      console.info(`Test '${this.name}' passed. ✔︎`);
      return true;
    },
  },
  {
    name: "invalidContentTest",
    input: {
      content: "",
      term: sampleGlossaryContent.term,
    },
    validate(result) {
      const validation = errorResultSchema.safeParse(result);
      if (!validation.success) {
        console.info(
          `Test '${this.name}' failed. Expected an error result, but got: ${JSON.stringify(result)}`,
        );
        return false;
      }

      console.info(`Test '${this.name}' passed. ✔︎`);
      return true;
    },
  },
];

// Create and export the test runner
export const evaluationTests = {
  id: "evaluations",
  task: technicalReviewTask,
  testCases,
};

export const runEvaluationTests = createTestRunner(evaluationTests); 