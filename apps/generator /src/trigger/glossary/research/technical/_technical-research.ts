import { domainCategories } from "@/lib/constants/domain-categories";
import { db } from "@/lib/db-marketing/client";
import { exaScrapedResults } from "@/lib/db-marketing/schemas";
import { AbortTaskRunError, batch, task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import type { CacheStrategy } from "../../_generate-glossary-entry";
import { evaluateSearchResults } from "./evaluate-search-results";
import { exaDomainSearchTask } from "./exa-domain-search";
import { scrapeSearchResults } from "./exa-scrape-results";

export const technicalResearchTask = task({
  id: "technical_research",
  run: async ({
    inputTerm,
    onCacheHit = "stale" as CacheStrategy,
  }: {
    inputTerm: string;
    onCacheHit: CacheStrategy;
  }) => {
    console.info("Starting domain research:", {
      query: inputTerm,
    });

    const existingScrapedResults = await db.query.exaScrapedResults.findMany({
      where: eq(exaScrapedResults.inputTerm, inputTerm),
    });

    const missingDomainCategories = domainCategories.filter(
      (domainCategory) =>
        !existingScrapedResults.some(
          (scrapedResult) => scrapedResult.domainCategory === domainCategory.name,
        ),
    );

    if (missingDomainCategories.length === 0 && onCacheHit === "stale") {
      console.info(
        `⏩︎ Cache hit for technical research for term "${inputTerm}" with ${existingScrapedResults.length} results, returning cached results`,
      );
      return existingScrapedResults;
    }

    // we perform a search for each search category in parallel:
    let onCacheHitDevOrProd = onCacheHit;
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[DEVELOPMENT] Setting onCacheHit to "stale" for technical research for term "${inputTerm}" with ${domainCategories.length} categories`,
      );
      onCacheHitDevOrProd = "stale";
    }
    const { runs } = await batch.triggerByTaskAndWait(
      domainCategories.map((domainCategory) => ({
        task: exaDomainSearchTask,
        payload: {
          inputTerm,
          onCacheHit: onCacheHitDevOrProd,
          numResults: 10,
          domain: domainCategory.name,
        },
      })),
    );
    const failedResults = runs.filter((result) => !result.ok).map((result) => result.error);
    if (failedResults.length > 0) {
      console.warn("⚠️ Failed to run some search categories:", failedResults);
    }

    // Step 2: Evaluate the search results
    const evaluationRun = await evaluateSearchResults.triggerAndWait({
      inputTerm,
    });

    if (!evaluationRun.ok) {
      throw new AbortTaskRunError("Failed to evaluate search results");
    }

    // Step 3: Scrape the content of the results
    const scrapedResults = await scrapeSearchResults.triggerAndWait({
      inputTerm,
      includedSearchResults: evaluationRun.output.flatMap(
        (domainResearchEvaluation) =>
          domainResearchEvaluation.searchEvaluation?.included.map((included) => ({
            url: included.url,
            domainCategory: domainResearchEvaluation.domainCategory,
          })) ?? [],
      ),
      onCacheHit,
    });
    if (!scrapedResults.ok) {
      throw new AbortTaskRunError("Failed to scrape search results");
    }

    console.info("✓ Technical research completed and persisted");

    const research = await db.query.exaScrapedResults.findMany({
      where: eq(exaScrapedResults.inputTerm, inputTerm),
    });

    return research;
  },
});
