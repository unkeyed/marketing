import { domainCategories } from "@/lib/constants/domain-categories";
import { AbortTaskRunError } from "@trigger.dev/sdk/v3";
import Exa, { type ContentsOptions, type RegularSearchOptions } from "exa-js";

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
    includeDomains: [
      ...(domainCategories.find(
        (c: { name: string; domains: readonly string[] }) => c.name === domain,
      )?.domains || []),
    ],
    ...filterEmptyResultsOnly,
  } satisfies RegularSearchOptions & {};
};
const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
  throw new AbortTaskRunError("EXA_API_KEY environment variable is not set");
}
export const exa = new Exa(apiKey);
