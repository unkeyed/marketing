import { entries, TechnicalResearch, type SelectEntry } from "@/lib/db-marketing/schemas";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";
import Exa, { type ContentsOptions, type RegularSearchOptions } from "exa-js";
import type { ExaCosts } from "./types";
import { CacheStrategy } from "../../_generate-glossary-entry";
import { db } from "@/lib/db-marketing/client";
import { eq } from "drizzle-orm";
import { composeSearchOptions, exa } from "@/lib/exa";

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
    domain: (typeof domainCategories)[number]["name"];
  }): Promise<TechnicalResearch["included"]> => {
    

    const existing = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, inputTerm),
      columns: {
        technicalResearch: true,
      },
    });

    if (existing?.technicalResearch?.included && existing?.technicalResearch?.included.length > 0 && onCacheHit === "stale") {
      console.info("✓ Technical research already exists in DB, returning cached results");
      return existing.technicalResearch.included.filter((result) => result.category.name === domain);
    }

    
    const domainCategory = domainCategories.find((c) => c.name === domain);

    // Initial search with only summaries
    const searchOptions= composeSearchOptions({numResults, domain})

    console.info("🔍 Starting Exa search with summaries only:", {
      query: inputTerm,
      category: domainCategory?.name,
    });
    const searchResult = await exa.searchAndContents(inputTerm, searchOptions);
    console.info(`💰 Exa API costs for the "${domain}" domain search:
      Total: $${searchResult.costDollars?.total} 
      Search: $${searchResult.costDollars?.search?.neural || searchResult.costDollars?.search?.keyword} (@$0.0025/request)
      Summaries: $${searchResult.costDollars?.contents?.summary} (@$0.001/summary for ${searchResult.results.length} results)
      `);
      await db.update(entries)
      .set({ technicalResearch: {
        included: searchResult.results.map((result) => ({
          ...result,
          category: domainCategory!,
        })),
      } as unknown as TechnicalResearch })
      .where(eq(entries.inputTerm, inputTerm));

      const updatedEntry = await db.query.entries.findFirst({
        where: eq(entries.inputTerm, inputTerm),
        columns: {
          technicalResearch: true,
        },
      });

      if (!updatedEntry?.technicalResearch?.included) {
        throw new AbortTaskRunError("Technical research performed but not persisted to DB");
      }

      return updatedEntry.technicalResearch.included.filter((result) => result.category.name === domain);
  },
});
