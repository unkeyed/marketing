import { type TestCase, createTestRunner } from "@/lib/test";
import { keywordResearchTask } from "./keyword-research";

const regressionTestCases: TestCase<typeof keywordResearchTask>[] = [
  {
    name: "keywordResearchTask_RESTfulAPI_regression",
    input: {
      term: "RESTful API",
    },
    validate(result) {
      if (!result.ok) {
        console.warn(
          `Test '${this.name}' failed. Expected a successful result, but got: ${JSON.stringify(result)}`,
        );
        return false;
      }
      if (
        !result.output ||
        !Array.isArray(result.output.keywords) ||
        result.output.keywords.length === 0
      ) {
        console.warn(
          `Test '${this.name}' failed. Expected non-empty keywords array, but got: ${JSON.stringify(result.output)}`,
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
