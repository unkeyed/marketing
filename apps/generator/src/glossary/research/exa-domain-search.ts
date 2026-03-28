import { createHash } from "node:crypto";
import { type DomainCategory, domainCategories } from "@/lib/constants/domain-categories";
import { db } from "@/lib/db-marketing/client";
import {
  type SelectEntry,
  type TechnicalResearch,
  technicalResearch,
} from "@/lib/db-marketing/schemas";
import { composeSearchOptionsWithoutScraping, exa } from "@/lib/exa";
import { and, eq, isNotNull } from "drizzle-orm";
import type { CacheStrategy } from "../generate-glossary-entry";

export async function exaDomainSearch({
  inputTerm,
  onCacheHit = "stale" as CacheStrategy,
  numResults = 10,
  domain,
}: {
  inputTerm: SelectEntry["inputTerm"];
  onCacheHit: CacheStrategy;
  numResults?: number;
  domain: DomainCategory;
}): Promise<
  Omit<TechnicalResearch, "exaSearchResponseWithoutContent"> &
    NonNullable<Pick<TechnicalResearch, "exaSearchResponseWithoutContent">>
> {
  const domainCategory = domainCategories.find((c) => c.name === domain);
  if (!domainCategory) {
    throw new Error(`Domain category not found: ${domain}`);
  }

  const existingSearchResponse = await db.query.technicalResearch.findFirst({
    where: and(
      eq(technicalResearch.domainCategory, domainCategory.name),
      eq(technicalResearch.inputTerm, inputTerm),
      isNotNull(technicalResearch.hashedExaSearchResponseWithoutContent),
    ),
  });

  if (existingSearchResponse?.exaSearchResponseWithoutContent && onCacheHit === "stale") {
    console.info(
      `Cache hit for "${domain}"-technical research for term "${inputTerm}", returning cached results`,
    );
    return existingSearchResponse;
  }

  const withoutScrapingOpts = composeSearchOptionsWithoutScraping({
    numResults,
    domain,
  });

  console.info("Starting Exa search without content scraping:", {
    query: inputTerm,
    category: domainCategory?.name,
    includeDomains: withoutScrapingOpts.includeDomains,
  });
  const searchResultWithoutContent = (await exa.searchAndContents(
    inputTerm,
    withoutScrapingOpts,
  )) as any;
  console.info(`Exa API costs for the "${domain}" domain search:
      Total: $${searchResultWithoutContent.costDollars?.total}
      Search: $${searchResultWithoutContent.costDollars?.search?.neural || searchResultWithoutContent.costDollars?.search?.keyword} (@$0.0025/request)
      `);

  if (!searchResultWithoutContent.results.length) {
    throw new Error(`No results found for "${inputTerm}" in "${domainCategory.name}" domain`);
  }

  if (existingSearchResponse?.id) {
    await db
      .update(technicalResearch)
      .set({
        exaSearchResponseWithoutContent: searchResultWithoutContent,
        hashedExaSearchResponseWithoutContent: createHash("sha256")
          .update(JSON.stringify(searchResultWithoutContent))
          .digest("hex"),
      })
      .where(eq(technicalResearch.id, existingSearchResponse.id));

    const updatedSearchResponse = await db.query.technicalResearch.findFirst({
      where: eq(technicalResearch.id, existingSearchResponse.id),
    });
    if (!updatedSearchResponse?.exaSearchResponseWithoutContent) {
      throw new Error("Technical research performed but not persisted to DB");
    }
    return updatedSearchResponse;
  }

  const [newSearchResponse] = await db
    .insert(technicalResearch)
    .values({
      inputTerm,
      domainCategory: domainCategory.name,
      exaSearchResponseWithoutContent: searchResultWithoutContent,
      hashedExaSearchResponseWithoutContent: createHash("sha256")
        .update(JSON.stringify(searchResultWithoutContent))
        .digest("hex"),
    })
    .returning({ id: technicalResearch.id });

  const createdSearchResponse = await db.query.technicalResearch.findFirst({
    where: eq(technicalResearch.id, newSearchResponse.id),
  });

  if (!createdSearchResponse?.exaSearchResponseWithoutContent) {
    throw new Error("Technical research performed but not persisted to DB");
  }

  return createdSearchResponse;
}
