import { technicalResearch, type TechnicalResearch, type SelectEntry } from "@/lib/db-marketing/schemas";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";

import { CacheStrategy } from "../../_generate-glossary-entry";
import { db } from "@/lib/db-marketing/client";
import { and, eq, isNotNull } from "drizzle-orm";
import { composeSearchOptionsWithoutScraping, exa } from "@/lib/exa";
import { createHash } from "node:crypto";

export const domainCategories = [
  {
    name: "Official",
    domains: ["tools.ietf.org", "datatracker.ietf.org", "rfc-editor.org", "w3.org", "iso.org"],
    description: "Official standards and specifications sources",
  },
  {
    name: "Community",
    domains: [
      "stackoverflow.com",
      "github.com",
      "wikipedia.org",
      "news.ycombinator.com",
      "stackexchange.com",
    ],
    description: "Community-driven platforms and forums",
  },
  {
    name: "Neutral",
    domains: ["owasp.org", "developer.mozilla.org"],
    description: "Educational and vendor-neutral resources",
  },
  {
    name: "Google",
    domains: [], // Empty domains array to search without domain restrictions
    description: "General search results without domain restrictions",
  },
] as const;

export type DomainCategory = (typeof domainCategories)[number]["name"];
// Define the main search task
export const exaDomainSearchTask = task({
  id: "exa_domain_search",
  run: async ({
    inputTerm,
    onCacheHit = "stale" as CacheStrategy,
    numResults = 10,
    domain,

  }: {
    inputTerm: SelectEntry["inputTerm"];
    onCacheHit: CacheStrategy;
    numResults?: number;
    domain: DomainCategory;
  }): Promise<Omit<TechnicalResearch, "exaSearchResponseWithoutContent"> & NonNullable<Pick<TechnicalResearch, "exaSearchResponseWithoutContent">>> => {
    const domainCategory = domainCategories.find((c) => c.name === domain);
    if (!domainCategory) {
      throw new AbortTaskRunError(`Domain category not found: ${domain}`);
    }


    const existingSearchResponse = await db.query.technicalResearch.findFirst({
      where: and(eq(technicalResearch.domainCategory, domainCategory.name), eq(technicalResearch.inputTerm, inputTerm), isNotNull(technicalResearch.hashedExaSearchResponseWithoutContent)),
    });

    if (existingSearchResponse?.exaSearchResponseWithoutContent && onCacheHit === "stale") {
      console.info(`⏩︎ Cache hit for "${domain}"-technical research for term "${inputTerm}", returning cached results`);
      return existingSearchResponse;
    }
    console.info(`💾 No cache hit for "${domain}"-technical research for term "${inputTerm}".\nReason: ${onCacheHit !== "stale" ? "onCacheHit is not stale" : "no cache found"}`);

    // Initial search without any scraping
    const withoutScrapingOpts = composeSearchOptionsWithoutScraping({
      numResults,
      domain,
    })

    console.info("🔍 Starting Exa search without content scraping:", {
      query: inputTerm,
      category: domainCategory?.name,
      includeDomains: withoutScrapingOpts.includeDomains,
    });
    const searchResultWithoutContent = await exa.searchAndContents(inputTerm, withoutScrapingOpts);
    console.info(`💰 Exa API costs for the "${domain}" domain search:
      Total: $${searchResultWithoutContent.costDollars?.total} 
      Search: $${searchResultWithoutContent.costDollars?.search?.neural || searchResultWithoutContent.costDollars?.search?.keyword} (@$0.0025/request)
      `);
    
    if (!searchResultWithoutContent.results.length) {
      throw new AbortTaskRunError(`No results found for "${inputTerm}" in "${domainCategory.name}" domain`);
    }

    // update the DB with our new search results:
    if (existingSearchResponse?.id) {
      console.info(`🔍 Updating existing technical research id '${existingSearchResponse.id}' (term: '${inputTerm}', domain: '${domainCategory.name}')`);
      await db.update(technicalResearch).set({
        exaSearchResponseWithoutContent: searchResultWithoutContent,
        hashedExaSearchResponseWithoutContent: createHash("sha256").update(JSON.stringify(searchResultWithoutContent)).digest("hex"),
      }).where(
        eq(technicalResearch.id, existingSearchResponse.id)
      );

      const updatedSearchResponse = await db.query.technicalResearch.findFirst({
        where: eq(technicalResearch.id, existingSearchResponse.id),
      });
      if (!updatedSearchResponse?.exaSearchResponseWithoutContent) {
        console.error("Technical research performed but not persisted to DB");
        console.info(JSON.stringify(updatedSearchResponse, null, 2));
        throw new AbortTaskRunError("Technical research performed but not persisted to DB");
      }
      return updatedSearchResponse;
    }

    const [newSearchResponse] = await db.insert(technicalResearch).values({
      inputTerm,
      domainCategory: domainCategory.name,
      exaSearchResponseWithoutContent: searchResultWithoutContent,
      hashedExaSearchResponseWithoutContent: createHash("sha256").update(JSON.stringify(searchResultWithoutContent)).digest("hex"),
    }).$returningId();

    const createdSearchResponse = await db.query.technicalResearch.findFirst({
      where: eq(technicalResearch.id, newSearchResponse.id),
    });

    if (!createdSearchResponse?.exaSearchResponseWithoutContent) {
      throw new AbortTaskRunError("Technical research performed but not persisted to DB");
    }

    return createdSearchResponse;
  },
});
