import { domainCategories } from "@/trigger/glossary/research/technical/exa-domain-search";
import { AbortTaskRunError } from "@trigger.dev/sdk/v3";
import Exa, { ContentsOptions, RegularSearchOptions } from "exa-js";

export const composeSearchOptions = (props: {numResults: number, domain: string}) => {
    const {numResults, domain} = props;
    return {
        numResults,
        type: "keyword",
        // we only include summary (not text) so that we fetch the content for the results after the Gemini evaluation
        summary: {
            query: "Exhaustive summary what the web page is about",
        },
        // we unpack the array in a new array because out domainCategories returns `readonly`
        includeDomains: [...(domainCategories.find((c) => c.name === domain)?.domains || [])],
    } satisfies RegularSearchOptions & ContentsOptions;
};
const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
    throw new AbortTaskRunError("EXA_API_KEY environment variable is not set");
  }    
export const exa = new Exa(apiKey);