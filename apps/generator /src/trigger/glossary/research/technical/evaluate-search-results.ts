import { domainCategories } from "@/lib/constants/domain-categories";
import { db } from "@/lib/db-marketing/client";
import {
  type TechnicalResearch,
  technicalResearch,
  technicalResearchSearchResultEvaluationSchema,
} from "@/lib/db-marketing/schemas/technical-research";
import { google } from "@/lib/google";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";

export const evaluateSearchResults = task({
  id: "evaluate-search-results",
  run: async ({ inputTerm }: Pick<TechnicalResearch, "inputTerm">) => {
    const existing = await db.query.technicalResearch.findMany({
      where: eq(technicalResearch.inputTerm, inputTerm),
      columns: {
        searchEvaluation: true,
        exaSearchResponseWithoutContent: true,
        domainCategory: true,
      },
    });
    const missingDomainCategories = domainCategories.filter(
      (searches) => !existing.some((search) => search.domainCategory === searches.name),
    );
    if (missingDomainCategories.length > 0) {
      console.warn("Technical reserach incomplete");
      throw new AbortTaskRunError(
        `Technical research evaluation called but not all domain searches returned results: ${missingDomainCategories.map((c) => c.name).join(", ")}`,
      );
    }

    const searchResults = existing.flatMap((search) =>
      search.exaSearchResponseWithoutContent.results.map((result) => ({
        ...result,
        domainCategory: search.domainCategory,
      })),
    );

    const geminiResponse = await generateObject({
      model: google("gemini-2.0-flash-lite-preview-02-05") as any,
      schema: technicalResearchSearchResultEvaluationSchema,
      output: "array",
      prompt: `
        Evaluate these search results for relevance to: "${inputTerm}"
        
        For each result below, return an evaluation with:
        - resultId: The ID number shown in brackets
        - evaluation:
          - rating: 1-10 scale (10 = highly relevant, 1 = irrelevant)
          - justification: Brief explanation why, including noting if content is outdated
        
        GUIDANCE ON EVALUATING CONTENT:
        - Generally prioritize content from recent years (2020-present)
        - Be cautious with older content (pre-2020), unless it's from a "Official", "Community" or "Neutral" category
        - If the is from a "Official", "Community" or "Neutral" category assign a slightly higher rating compared to sources from "Google"
        - The ideal content is both highly relevant AND reasonably current
        - Exclude implementation examples, e.g. if the inputTerm is "SDK" and there are GitHub results for examplatory SDKs, don't include them in the included results. 
        - Include urls likely being objective and authoritative informational content about the term "${inputTerm}"
        
        Here are the results:
        
        ${searchResults
          .map(
            (r) => `[Result ID: ${r.id}]
        Title: ${r.title}
        URL: ${r.url}
        Published: ${r.publishedDate || "Unknown date"}
        Research Category: ${r.domainCategory}
        `,
          )
          .join("\n\n")}
        
        IMPORTANT: You must return evaluations for ALL ${searchResults.length} results.
        CRITICAL: Return a flat array of objects, not an array of arrays.
      `,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "evaluate-search-results",
      },
    });

    const costs = {
      input: geminiResponse.usage.promptTokens * (0.075 / 1000000),
      output: geminiResponse.usage.completionTokens * (0.3 / 1000000),
      total:
        geminiResponse.usage.promptTokens * (0.075 / 1000000) +
        geminiResponse.usage.completionTokens * (0.3 / 1000000),
    };

    // Log token usage
    console.info(`💸 Token usage: ${geminiResponse.usage.totalTokens} tokens
      INPUT: $${costs.input}
      OUTPUT: $${costs.output}
      TOTAL: $${costs.total}
      `);

    const evaluations = geminiResponse.object;
    if (!Array.isArray(evaluations)) {
      throw new Error("Invalid evaluation response from Gemini: Not an array");
    }
    if (evaluations.length === 0) {
      throw new Error("No evaluations returned from Gemini");
    }

    // upsert the technicalResearch.searchEvaluation for the given inputTerm, domainCategory:
    await db.transaction(async (tx) => {
      for (const domainCategory of domainCategories) {
        const domainEvaluations = evaluations.filter(
          (evaluation) => evaluation.domainCategory === domainCategory.name,
        );

        await tx
          .update(technicalResearch)
          .set({
            searchEvaluation: {
              metadata: {
                evaluatedAt: new Date(),
                stats: {
                  included: domainEvaluations.filter(
                    (evaluation) =>
                      evaluation.evaluation?.rating && evaluation.evaluation?.rating >= 7,
                  ).length,
                  excluded: domainEvaluations.filter(
                    (evaluation) =>
                      evaluation.evaluation?.rating && evaluation.evaluation?.rating < 7,
                  ).length,
                },
              },
              included: domainEvaluations.filter(
                (evaluation) => evaluation.evaluation?.rating && evaluation.evaluation?.rating >= 7,
              ),
            },
          })
          .where(
            and(
              eq(technicalResearch.inputTerm, inputTerm),
              eq(technicalResearch.domainCategory, domainCategory.name),
            ),
          );
      }
    });

    const updatedEntries = await db.query.technicalResearch.findMany({
      where: eq(technicalResearch.inputTerm, inputTerm),
      columns: {
        searchEvaluation: true,
        domainCategory: true,
      },
    });
    if (!updatedEntries.length) {
      throw new AbortTaskRunError(
        `Technical research evaluation not found in DB for term "${inputTerm}". Run the _technical-research task first.`,
      );
    }
    console.info(
      `✅︎ Evaluated search results for term "${inputTerm}" with stats: ${JSON.stringify(updatedEntries.map((entry) => entry.searchEvaluation?.metadata.stats))}`,
    );
    return updatedEntries;
  },
});
