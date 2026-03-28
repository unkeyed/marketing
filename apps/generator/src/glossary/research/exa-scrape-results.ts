import { createHash } from "node:crypto";
import type { DomainCategory } from "@/lib/constants/domain-categories";
import { db } from "@/lib/db-marketing/client";
import {
  type ExaScrapedResults,
  exaScrapedResults,
} from "@/lib/db-marketing/schemas/technical-research";
import { composeScrapingContentBaseOptions } from "@/lib/exa";
import { withRetry } from "@/lib/utils/retry";
import { eq, sql } from "drizzle-orm";
import Exa from "exa-js";
import type { CacheStrategy } from "../generate-glossary-entry";

export async function scrapeSearchResultsStep(
  input: Pick<ExaScrapedResults, "inputTerm"> & {
    includedSearchResults: { url: string; domainCategory: DomainCategory }[];
    onCacheHit: CacheStrategy;
  },
) {
  return withRetry(async () => {
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

    const uniqueUrls = includedSearchResults.filter(
      (result, index, self) => index === self.findIndex((r) => r.url === result.url),
    );

    const missingUrls = uniqueUrls.filter(
      ({ url }) =>
        !existingResults.some(
          (result) =>
            result.url.toLowerCase().replace(/\/$/, "") === url.toLowerCase().replace(/\/$/, ""),
        ),
    );

    if (onCacheHit === "stale" && missingUrls.length === 0) {
      console.info(
        `Cache hit for all results already scraped for term "${inputTerm}".`,
      );
      return existingResults;
    }

    const urlsToScrape = onCacheHit === "revalidate" ? uniqueUrls : missingUrls;
    const scrapingResults = await exa.getContents(
      urlsToScrape.map(({ url }) => url),
      composeScrapingContentBaseOptions({ summaryQuery }),
    );
    if (!scrapingResults.results.length) {
      throw new Error(`Failed to scrape all results for term "${inputTerm}".`);
    }

    const scrapingCosts = scrapingResults.costDollars;
    console.info(`Exa API costs for Content Scraping:
      Total: $${scrapingCosts?.total}
      Contents:
       - Text:  $${scrapingCosts?.contents?.text}
       - Summaries: $${scrapingCosts?.contents?.summary}
    `);

    const newResults = scrapingResults.results.map((result) => ({
      inputTerm,
      url: result.url,
      summary: result.summary,
      text: result.text,
      domainCategory: urlsToScrape.find(({ url }) => url === result.url)
        ?.domainCategory as DomainCategory,
      hashedInputTermUrl: createHash("sha256").update(`${inputTerm}-${result.url}`).digest("hex"),
    }));

    const validResults = newResults.filter((result) => result.domainCategory !== undefined);
    if (validResults.length !== newResults.length) {
      console.warn(
        `Warning: ${newResults.length - validResults.length} results had undefined domainCategory and were skipped`,
      );
    }

    await db
      .insert(exaScrapedResults)
      .values(newResults)
      .onConflictDoUpdate({
        target: exaScrapedResults.hashedInputTermUrl,
        set: {
          summary: sql`excluded.summary`,
          text: sql`excluded.text`,
          domainCategory: sql`excluded.domain_category`,
          inputTerm: sql`excluded.input_term`,
        },
      });
    const scrapedUrls = await db.query.exaScrapedResults.findMany({
      where: eq(exaScrapedResults.inputTerm, inputTerm),
    });

    const missingUrlsToScrape = urlsToScrape.filter(
      (url) =>
        !scrapedUrls.some(
          (scrapedUrl) =>
            scrapedUrl.url.toLowerCase().replace(/\/$/, "") ===
            url.url.toLowerCase().replace(/\/$/, ""),
        ),
    );
    if (missingUrlsToScrape.length > 0) {
      throw new Error(`Failed to scrape all results for term "${inputTerm}".`);
    }
    return scrapedUrls;
  }, { maxAttempts: 5, label: "scrapeSearchResults" });
}
