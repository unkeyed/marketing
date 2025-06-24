import type { DomainCategory } from "@/lib/constants/domain-categories";
import { db } from "@/lib/db-marketing/client";
import {
  type ExaScrapedResults,
  exaScrapedResults,
} from "@/lib/db-marketing/schemas/technical-research";
import { composeScrapingContentBaseOptions } from "@/lib/exa";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import Exa from "exa-js";
import type { CacheStrategy } from "../../_generate-glossary-entry";

export const scrapeSearchResults = task({
  id: "scrape-search-results",
  run: async (
    input: Pick<ExaScrapedResults, "inputTerm"> & {
      includedSearchResults: { url: string; domainCategory: DomainCategory }[];
      onCacheHit: CacheStrategy;
    },
  ) => {
    const { inputTerm, includedSearchResults, onCacheHit } = input;
    const existingResults = await db.query.exaScrapedResults.findMany({
      where: eq(exaScrapedResults.inputTerm, inputTerm),
    });

    const exa = new Exa(process.env.EXA_API_KEY || "");
    const summaryQuery = `You are the **Chief Technology Officer (CTO)** of a leading API Development Tools Company with extensive experience in API development using programming languages such as Go, TypeScript, and Elixir and other backend languages. You have a PhD in computer science from MIT. Your expertise ensures that the content you summarize is technically accurate, relevant, and aligned with best practices in API development and computer science.

    **Your Task:**
    Accurately and concisely summarize the content from the page for the term "${inputTerm}". Focus on technical details, including how the content is presented (e.g., text, images, tables). Ensure factual correctness and relevance to API development.
    
    **Instructions:**
    - Provide a clear and concise summary of the content.
    - Highlight key technical aspects and insights related to API development.
    - Mention the types of content included, such as images, tables, code snippets, etc.
    - Cite the term the content is ranking for.`;

    // First dedupe any URLs
    const uniqueUrls = includedSearchResults.filter(
      (result, index, self) => index === self.findIndex((r) => r.url === result.url),
    );

    // Then find which ones are missing from our cache using normalized URL comparison
    // (normalize by removing trailing slashes and converting to lowercase)
    const missingUrls = uniqueUrls.filter(
      ({ url }) =>
        !existingResults.some(
          (result) =>
            result.url.toLowerCase().replace(/\/$/, "") === url.toLowerCase().replace(/\/$/, ""),
        ),
    );

    // Only return from cache if:
    // 1. We're in "stale" mode AND
    // 2. We have all URLs already cached
    if (onCacheHit === "stale" && missingUrls.length === 0) {
      console.info(
        `⏩︎ Cache hit for all results already scraped for term "${inputTerm}". Reason: onCacheHit is stale`,
      );
      return existingResults;
    }

    // Otherwise, scrape everything (either missing URLs or revalidating all)
    const urlsToScrape = onCacheHit === "revalidate" ? uniqueUrls : missingUrls;
    const scrapingResults = await exa.getContents(
      urlsToScrape.map(({ url }) => url),
      composeScrapingContentBaseOptions({ summaryQuery }),
    );
    if (!scrapingResults.results.length) {
      throw new AbortTaskRunError(`Failed to scrape all results for term "${inputTerm}".`);
    }

    // log the costs for the exa responses:
    const scrapingCosts = scrapingResults.costDollars;
    console.info(`💰 Exa API costs for Content Scraping:
      Total: $${scrapingCosts?.total}
      Contents:
       - Text:  $${scrapingCosts?.contents?.text}
       - Summaries: $${scrapingCosts?.contents?.summary}
    `);

    // Persist the scraping results
    const newResults = scrapingResults.results.map((result) => ({
      inputTerm,
      url: result.url,
      summary: result.summary,
      text: result.text,
      domainCategory: urlsToScrape.find(({ url }) => url === result.url)
        ?.domainCategory as DomainCategory,
      hashedInputTermUrl: createHash("sha256").update(`${inputTerm}-${result.url}`).digest("hex"),
    }));

    // Filter out any results with undefined domainCategory (necessary as we're type casting above theorietcially)
    const validResults = newResults.filter((result) => result.domainCategory !== undefined);
    if (validResults.length !== newResults.length) {
      console.warn(
        `Warning: ${newResults.length - validResults.length} results had undefined domainCategory and were skipped`,
      );
    }

    newResults.forEach((result) => {
      console.info(`URL: ${result.url}
    Summary length: ${result.summary?.length || 0}
    Text length: ${result.text?.length || 0}
    Total length: ${(result.summary?.length || 0) + (result.text?.length || 0)}`);
    });

    await db
      .insert(exaScrapedResults)
      .values(newResults)
      .onDuplicateKeyUpdate({
        set: {
          summary: sql`VALUES(summary)`,
          text: sql`VALUES(text)`,
          domainCategory: sql`VALUES(domain_category)`,
          inputTerm: sql`VALUES(input_term)`,
        },
      })
      .$returningId();
    const scrapedUrls = await db.query.exaScrapedResults.findMany({
      where: eq(exaScrapedResults.inputTerm, inputTerm),
    });
    // Check for missing URLs using normalized URL comparison
    // (normalize by removing trailing slashes and converting to lowercase)
    const missingUrlsToScrape = urlsToScrape.filter(
      (url) =>
        !scrapedUrls.some(
          (scrapedUrl) =>
            scrapedUrl.url.toLowerCase().replace(/\/$/, "") ===
            url.url.toLowerCase().replace(/\/$/, ""),
        ),
    );
    if (missingUrlsToScrape.length > 0) {
      console.warn(
        `There's some integrity issue here, we might not have scraped all missing Urls properly.\nThere are ${missingUrlsToScrape.length} missing URLs.\nMissing URLs:\n${missingUrlsToScrape.map((r) => r.url).join("\n")}`,
      );
      throw new AbortTaskRunError(`Failed to scrape all results for term "${inputTerm}".`);
    }
    return scrapedUrls;
  },
});
