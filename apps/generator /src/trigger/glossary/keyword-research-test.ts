import { type TestCase, createTestRunner, errorResultSchema } from "@/lib/test";
import { keywordResearchTask } from "./keyword-research";

const regressionTestCases: TestCase<typeof keywordResearchTask>[] = [
  {
    name: "keywordResearchTask_RESTfulAPI_regression",
    input: {
      term: "RESTful API",
    },
    validate(result) {
      // Expecting an error result for now (should be updated to expect success after fix)
      const validation = errorResultSchema.safeParse(result);
      if (!validation.success) {
        console.info(
          `Test '${this.name}' failed. Expected an error result, but got: ${JSON.stringify(result)}`,
        );
        return false;
      }
      // Optionally, check for specific error message
      const error = validation.data.error;
      if (typeof error !== "object" || !error || !("message" in error)) {
        console.warn(
          `Test '${this.name}' failed. Expected error to have a message property, but got: ${JSON.stringify(error)}`,
        );
        return false;
      }
      const message = (error as { message: unknown }).message;
      if (typeof message !== "string" || !message.includes("Keyword research failed")) {
        console.warn(
          `Test '${this.name}' failed. Expected error message to include 'Keyword research failed', but got: ${message}`,
        );
        return false;
      }
      console.info(`Test '${this.name}' passed. ✔︎`);
      return true;
    },
  },
];

export const keywordResearchRegressionTest = createTestRunner({
  id: "keyword_research_regression_test",
  task: keywordResearchTask,
  testCases: regressionTestCases,
});

export default keywordResearchRegressionTest; 