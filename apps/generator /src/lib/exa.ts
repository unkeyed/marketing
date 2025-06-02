import type { CacheStrategy } from "@/trigger/glossary/_generate-glossary-entry";
import { domainCategories } from "@/lib/constants/domain-categories";
import { AbortTaskRunError } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import Exa, { type ContentsOptions, type RegularSearchOptions } from "exa-js";
import { db } from "./db-marketing/client";
import { technicalResearch } from "./db-marketing/schemas";
import { tryCatch } from "./utils/try-catch";
export const composeScrapingContentBaseOptions = ({ summaryQuery }: { summaryQuery: string }) => {
  return {
    summary: {
      query: summaryQuery,
    },
    text: {
      includeHtmlTags: false,
    },
  } satisfies ContentsOptions;
};
export const filterEmptyResultsOnly = {
  filterEmptyResults: true,
} satisfies ContentsOptions;
// this helper functions exists so we can ensure exa's return types for TechnicalResearch inside our lib/db-marketing/schemas/entries.ts file.
export const composeSearchOptionsWithoutScraping = (props: {
  numResults: number;
  domain: string;
}) => {
  const { numResults, domain } = props;
  return {
    numResults,
    type: "keyword",
    // we unpack the array in a new array because out domainCategories returns `readonly`
    includeDomains: [...(domainCategories.find((c) => c.name === domain)?.domains || [])],
    ...filterEmptyResultsOnly,
  } satisfies RegularSearchOptions & {};
};
const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
  throw new AbortTaskRunError("EXA_API_KEY environment variable is not set");
}
export const exa = new Exa(apiKey);

export async function getOrCreateSummary({
  url,
  connectTo,
  onCacheHit = "stale" as CacheStrategy,
}: {
  url: string;
  connectTo: { term: string };
  onCacheHit?: CacheStrategy;
}) {
  // Query the stored Technical Research entries
  const queryExistingTechnicalResearches = await tryCatch(
    db.query.technicalResearch.findMany({
      where: eq(technicalResearch.inputTerm, connectTo.term),
      columns: { id: true, exaScrapedContent: true },
    }),
  );
  if (queryExistingTechnicalResearches.error) {
    console.warn(
      `Error querying entry for term ${connectTo.term}:`,
      queryExistingTechnicalResearches.error,
    );
    throw new AbortTaskRunError(
      `Error querying entry for term ${connectTo.term}: ${queryExistingTechnicalResearches.error}`,
    );
  }
  if (!queryExistingTechnicalResearches.data?.some((r) => r.exaScrapedContent)) {
    throw new AbortTaskRunError(
      `No technical research found for term ${connectTo.term}. Run technical research first.`,
    );
  }
  const existingTechnicalResearch = queryExistingTechnicalResearches.data.find((r) =>
    r.exaScrapedContent?.results.find((r) => r.url === url),
  );

  if (existingTechnicalResearch?.exaScrapedContent?.results && onCacheHit === "stale") {
    return existingTechnicalResearch;
  }

  // summary prompt
  const summaryQuery = `You are the **Chief Technology Officer (CTO)** of a leading API Development Tools Company with extensive experience in API development using programming languages such as Go, TypeScript, and Elixir and other backend languages. You have a PhD in computer science from MIT. Your expertise ensures that the content you summarize is technically accurate, relevant, and aligned with best practices in API development and computer science.
  
  **Your Task:**
  Accurately and concisely summarize the content from the page for the term "${connectTo.term}". Focus on technical details, including how the content is presented (e.g., text, images, tables). Ensure factual correctness and relevance to API development.
  
  **Instructions:**
  - Provide a clear and concise summary of the content.
  - Highlight key technical aspects and insights related to API development.
  - Mention the types of content included, such as images, tables, code snippets, etc.
  - Cite the term the content is ranking for.
  
  Summarize the following content for the term "${connectTo.term}".`;

  const summaryResponse = await exa.getContents(url, { summary: { query: summaryQuery } });
  // use all previous results and append .summary to the one for the existing index:
  const results = queryExistingTechnicalResearches.data.exaScrapedContent.results;
  results[existingIndex] = {
    ...results[existingIndex],
    summary: summaryResponse.results[0].summary,
  };

  // Persist the updated technicalResearch JSON to the DB
  await db
    .update(technicalResearch)
    .set({
      exaScrapedContent: {
        ...queryExistingTechnicalResearches.data.exaScrapedContent,
        results,
      },
    })
    .where(eq(technicalResearch.id, queryExistingTechnicalResearches.data.id));

  const _updatedTechnicalResearches = await db.query.technicalResearch.findFirst({
    where: eq(technicalResearch.id, queryExistingTechnicalResearches.data.id),
    columns: { exaScrapedContent: true },
  });
  if (!updatedEntry?.technicalResearch) {
    throw new AbortTaskRunError(
      `No technical research found for term ${connectTo.term}. Run technical research first.`,
    );
  }
  if (!updatedEntry.technicalResearch.search.results[existingIndex]) {
    throw new AbortTaskRunError(
      `No technical research found for term ${connectTo.term}. Run technical research first.`,
    );
  }

  return updatedEntry.technicalResearch.search.results[existingIndex];
}
