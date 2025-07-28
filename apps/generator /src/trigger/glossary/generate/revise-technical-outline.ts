import { openai } from "@ai-sdk/openai";
import { task, type TaskOutput } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { z } from "zod";
import type { CacheStrategy } from "../_generate-glossary-entry";
import type { performTechnicalEvalTask } from "../evaluate/evals";
import {
  insertSectionContentTypeSchema,
  insertSectionSchema,
  selectKeywordsSchema,
} from "@/lib/db-marketing/schemas";

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

    const technicalRevisionPrompt = `
Review the following outline for the term "${term}":

Outline to refine:
${JSON.stringify(outlineToRefine, null, 2)}

Technical Review Report:
${JSON.stringify(reviewReport, null, 2)}

Technical Research Context:
${technicalContext}

Please refine the outline according to the technical review recommendations, ensuring accuracy and completeness while maintaining clarity for developers.
`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: technicalRevisionSystem,
      prompt: technicalRevisionPrompt,
      schema: technicalOutlineSchema,
      experimental_telemetry: {
        functionId: "reviseTechnicalOutline",
        recordInputs: true,
        recordOutputs: true,
      },
    });

    console.info(
      `[task=revise_technical_outline] Completed technical revision for term: ${term}`,
    );

    return result.object;
  },
});