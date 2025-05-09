import { batch, task } from "@trigger.dev/sdk/v3";
import Exa from "exa-js";
import { evaluateSearchResults } from "./evaluate-search-results";
import { domainCategories, exaDomainSearchTask } from "./exa-domain-search";
import type { ExaCosts } from "./types";
import { db } from "@/lib/db-marketing/client";
import { entries, TechnicalResearch } from "@/lib/db-marketing/schemas/entries";
import { eq } from "drizzle-orm";
import { CacheStrategy } from "../../_generate-glossary-entry";

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

    const existing = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, inputTerm),
      columns: {
        technicalResearch: true,
      },
    });

    if (
      existing?.technicalResearch?.included &&
      existing?.technicalResearch?.included.length > 0 &&
      onCacheHit === "stale"
    ) {
      console.info("✓ Technical research already exists in DB, returning cached results");
      return existing.technicalResearch;
    }

    // we perform a search for each search category in parallel:
    const { runs } = await batch.triggerByTaskAndWait(
      domainCategories.map((domainCategory) => ({
        task: exaDomainSearchTask,
        payload: {
          inputTerm,
          onCacheHit: process.env.NODE_ENV === "production" ? onCacheHit : "stale",
          numResults: 10,
          domain: domainCategory.name,
        },
      })),
    );
    const failedResults = runs.filter((result) => !result.ok).map((result) => result.error);
    if (failedResults.length > 0) {
      console.warn("⚠️ Failed to run some search categories:", failedResults);
    }
    // Filter out failed searches and combine results
    const searchResults = runs.filter((result) => result.ok).flatMap((result) => result.output);

    // dedupe the results based on `url`:
    const dedupedResults = searchResults.filter(
      (result, index, self) => index === self.findIndex((t) => t.url === result.url),
    );

    // Step 2: Evaluate the search results
    const evaluationRun = await evaluateSearchResults.triggerAndWait({
      searchResults: dedupedResults,
      inputTerm,
    });

    if (!evaluationRun.ok) {
      throw new Error("Failed to evaluate search results");
    }

    const evaluationResults = evaluationRun.output;
    

    // Step 3: Scrape the content of the results
    const exa = new Exa(process.env.EXA_API_KEY || "");
    const contentResults = await exa.getContents(
      evaluationResults.included.flatMap((result) => result.url),
    );
    

    // log the costs for the exa responses:
    const scrapingCosts = (contentResults as unknown as typeof contentResults & ExaCosts)
      .costDollars;
    console.info(`💰 Exa API costs for Content Scraping:
      Total: $${scrapingCosts.total}
      Summaries: $${scrapingCosts.contents?.text} texts @ $0.001/text
    `);

    const output = {
      inputTerm,
      summary: evaluationResults.evaluationSummary,
      included: contentResults.results.map((result) => ({
        ...result,
        ...searchResults.find((c) => c.url === result.url),
      })),
      excluded: evaluationResults.excluded.map((result) => ({
        ...result,
        ...searchResults.find((c) => c.url === result.url),
      })),
    };

    // Persist technical research output to db
    await db.update(entries)
      .set({ technicalResearch: output as unknown as TechnicalResearch })
      .where(eq(entries.inputTerm, inputTerm));
    console.info("✓ Technical research completed and persisted");

    const updatedEntry = await db.query.entries.findFirst({
      columns: {
        technicalResearch: true,
      },
      where: eq(entries.inputTerm, inputTerm),
    });

    return updatedEntry?.technicalResearch;
  },
});
