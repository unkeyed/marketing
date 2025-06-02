import { relations } from "drizzle-orm";
// import { domainCategories } from "@/trigger/glossary/research/technical/exa-domain-search";
import {
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { searchQueries } from "./searchQuery";

import { entries } from "./entries";

import type { SearchResponse } from "exa-js";
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

// Evaluation schema for content quality and relevance
const evaluationSchema = z.object({
  rating: z.number().min(1).max(10),
  justification: z.string(),
});

export const technicalResearchSearchResultEvaluationSchema = z.object({
  url: z.string(),
  evaluation: evaluationSchema,
  domainCategory: z.enum(
    domainCategories.map((c) => c.name) as [DomainCategory, ...DomainCategory[]],
  ),
});

// Add the metadata type
export type SearchEvaluationMetadata = {
  evaluatedAt: Date;
  stats: {
    included: number;
    excluded: number;
  };
};

// Define the complete search evaluation type
export type SearchEvaluation = {
  metadata: SearchEvaluationMetadata;
  included: Array<z.infer<typeof technicalResearchSearchResultEvaluationSchema>>;
} | null;

export const technicalResearch = mysqlTable(
  "technical_researches",
  {
    id: int("id").primaryKey().autoincrement(),
    inputTerm: varchar("input_term", { length: 767 }).notNull(),
    domainCategory: mysqlEnum(
      "domain_category",
      domainCategories.map((c) => c.name) as [DomainCategory, ...DomainCategory[]],
    ).notNull(),
    hashedExaSearchResponseWithoutContent: varchar("hashed_exa_search_response_without_content", {
      length: 64,
    }).notNull(), // SHA-256 hash
    exaSearchResponseWithoutContent: json("exa_search_response_without_content")
      .$type<SearchResponse<{ [k: string]: never }>>()
      .notNull(),
    exaSearchResponseWithContent: json("exa_search_response_with_content")
      .$type<SearchResponse<{ summary: true; text: true }> | null>()
      .default(null),
    searchEvaluation: json("search_evaluation").$type<SearchEvaluation>().default(null),
    exaScrapedContent: json("exa_scraped_content")
      .$type<SearchResponse<{
        summary: {
          query: string;
        };
        text: {
          includeHtmlTags: false;
        };
      }> | null>()
      .default(null),
  },
  (table) => [
    index("input_term_idx").on(table.inputTerm),
    unique("hashed_exa_search_response_without_content_idx").on(
      table.hashedExaSearchResponseWithoutContent,
    ),
  ],
);

export const technicalResearchRelations = relations(technicalResearch, ({ one }) => ({
  searchQuery: one(searchQueries, {
    fields: [technicalResearch.inputTerm],
    references: [searchQueries.inputTerm],
  }),
  entry: one(entries, {
    fields: [technicalResearch.inputTerm],
    references: [entries.inputTerm],
  }),
}));

export const insertTechnicalResearchSchema = createInsertSchema(technicalResearch)
  .extend({})
  .omit({ id: true });
export type NewTechnicalResearch = z.infer<typeof insertTechnicalResearchSchema>;
export type TechnicalResearch = typeof technicalResearch.$inferSelect;

export const exaScrapedResults = mysqlTable(
  "exa_scraped_results",
  {
    id: int("id").primaryKey().autoincrement(),
    inputTerm: varchar("input_term", { length: 767 }).notNull(),
    url: varchar("url", { length: 767 }).notNull(),
    summary: longtext("summary").notNull(),
    text: longtext("text").notNull(),
    domainCategory: mysqlEnum(
      "domain_category",
      domainCategories.map((c) => c.name) as [DomainCategory, ...DomainCategory[]],
    ).notNull(),
  },
  (table) => [index("input_term_idx").on(table.inputTerm), unique("url_unique").on(table.url)],
);

export const exaScrapedResultsRelations = relations(exaScrapedResults, ({ one }) => ({
  entry: one(entries, {
    fields: [exaScrapedResults.inputTerm],
    references: [entries.inputTerm],
  }),
}));

export const insertExaScrapedResultsSchema = createInsertSchema(exaScrapedResults)
  .extend({})
  .omit({ id: true });
export type NewExaScrapedResults = z.infer<typeof insertExaScrapedResultsSchema>;
export type ExaScrapedResults = typeof exaScrapedResults.$inferSelect;
