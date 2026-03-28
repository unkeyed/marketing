import { domainCategories } from "@/lib/constants/domain-categories";
import { db } from "@/lib/db-marketing/client";
import { exaScrapedResults } from "@/lib/db-marketing/schemas";
import { eq } from "drizzle-orm";
import type { CacheStrategy } from "../generate-glossary-entry";
import { evaluateSearchResultsStep } from "./evaluate-search-results";
import { exaDomainSearch } from "./exa-domain-search";
import { scrapeSearchResultsStep } from "./exa-scrape-results";

export async function technicalResearchStep({
  inputTerm,
  onCacheHit = "stale" as CacheStrategy,
}: {
  inputTerm: string;
  onCacheHit: CacheStrategy;
}) {
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
      `Cache hit for technical research for term "${inputTerm}" with ${existingScrapedResults.length} results, returning cached results`,
    );
    return existingScrapedResults;
  }

  // Perform domain searches in parallel (replacing batch.triggerByTaskAndWait)
  let onCacheHitDevOrProd = onCacheHit;
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[DEVELOPMENT] Setting onCacheHit to "stale" for technical research for term "${inputTerm}"`,
    );
    onCacheHitDevOrProd = "stale";
  }

  const searchResults = await Promise.allSettled(
    domainCategories.map((domainCategory) =>
      exaDomainSearch({
        inputTerm,
        onCacheHit: onCacheHitDevOrProd,
        numResults: 10,
        domain: domainCategory.name,
      }),
    ),
  );
  const failedResults = searchResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);
  if (failedResults.length > 0) {
    console.warn("Failed to run some search categories:", failedResults);
  }

  // Step 2: Evaluate the search results
  const evaluationResult = await evaluateSearchResultsStep({
    inputTerm,
  });

  // Step 3: Scrape the content of the results
  await scrapeSearchResultsStep({
    inputTerm,
    includedSearchResults: evaluationResult.flatMap(
      (domainResearchEvaluation) =>
        domainResearchEvaluation.searchEvaluation?.included.map((included) => ({
          url: included.url,
          domainCategory: domainResearchEvaluation.domainCategory,
        })) ?? [],
    ),
    onCacheHit,
  });

  console.info("Technical research completed and persisted");

  const research = await db.query.exaScrapedResults.findMany({
    where: eq(exaScrapedResults.inputTerm, inputTerm),
  });

  return research;
}
