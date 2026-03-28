import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { firecrawlResponses } from "./firecrawl";
import { searchQueries } from "./searchQuery";

// Main SearchResponse table
export const serperSearchResponses = pgTable(
  "serper_search_responses",
  {
    id: serial("id").primaryKey(),
    inputTerm: varchar("input_term", { length: 767 }).notNull(),
    searchParameters: jsonb("search_parameters").notNull(),
    answerBox: jsonb("answer_box"),
    knowledgeGraph: jsonb("knowledge_graph"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    inputTermIdx: index("serper_search_responses_input_term_idx").on(table.inputTerm),
  }),
);

export const serperSearchResponsesRelations = relations(serperSearchResponses, ({ one, many }) => ({
  searchQuery: one(searchQueries, {
    fields: [serperSearchResponses.inputTerm],
    references: [searchQueries.inputTerm],
  }),
  serperOrganicResults: many(serperOrganicResults),
  serperTopStories: many(serperTopStories),
  serperPeopleAlsoAsk: many(serperPeopleAlsoAsk),
  serperRelatedSearches: many(serperRelatedSearches),
}));

export const insertSerperSearchResponseSchema = createSelectSchema(serperSearchResponses)
  .extend({})
  .omit({
    id: true,
  });

export type NewSerperSearchResponseParams = z.infer<typeof insertSerperSearchResponseSchema>;

export const serperOrganicResults = pgTable(
  "serper_organic_results",
  {
    id: serial("id").primaryKey(),
    searchResponseId: integer("search_response_id").notNull(),
    firecrawlResponseId: integer("firecrawl_response_id"),
    title: text("title").notNull(),
    link: varchar("link", { length: 767 }).notNull(),
    snippet: text("snippet").notNull(),
    position: integer("position").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    searchResponseIdIdx: index("serper_organic_results_search_response_id_idx").on(table.searchResponseId),
    linkIdx: index("serper_organic_results_link_idx").on(table.link),
  }),
);

export const serperOrganicResultSchema = createSelectSchema(serperOrganicResults);
export type SerperOrganicResult = z.infer<typeof serperOrganicResultSchema>;

export const serperOrganicResultsRelations = relations(serperOrganicResults, ({ one }) => ({
  searchResponse: one(serperSearchResponses, {
    fields: [serperOrganicResults.searchResponseId],
    references: [serperSearchResponses.id],
  }),
  firecrawlResponse: one(firecrawlResponses, {
    fields: [serperOrganicResults.link],
    references: [firecrawlResponses.sourceUrl],
  }),
}));

export const insertOrganicResultSchema = createSelectSchema(serperOrganicResults).extend({}).omit({
  id: true,
});

export type NewOrganicResultParams = z.infer<typeof insertOrganicResultSchema>;

export const serperSitelinks = pgTable(
  "serper_sitelinks",
  {
    id: serial("id").primaryKey(),
    organicResultId: integer("organic_result_id").notNull(),
    title: text("title").notNull(),
    link: varchar("link", { length: 767 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    organicResultIdIdx: index("serper_sitelinks_organic_result_id_idx").on(table.organicResultId),
    linkIdx: index("serper_sitelinks_link_idx").on(table.link),
  }),
);

export const serperSitelinksRelations = relations(serperSitelinks, ({ one }) => ({
  organicResult: one(serperOrganicResults, {
    fields: [serperSitelinks.organicResultId],
    references: [serperOrganicResults.id],
  }),
}));

// Schema for sitelinks - used to validate API requests
export const insertSitelinkSchema = createSelectSchema(serperSitelinks).extend({}).omit({
  id: true,
});

// Type for sitelinks - used to type API request params and within Components
export type NewSitelinkParams = z.infer<typeof insertSitelinkSchema>;

// Top Stories table
export const serperTopStories = pgTable(
  "serper_top_stories",
  {
    id: serial("id").primaryKey(),
    searchResponseId: integer("search_response_id").notNull(),
    title: text("title").notNull(),
    link: varchar("link", { length: 767 }).notNull(),
    source: text("source").notNull(),
    date: text("date").notNull(),
    imageUrl: text("image_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    searchResponseIdIdx: index("serper_top_stories_search_response_id_idx").on(table.searchResponseId),
    linkIdx: index("serper_top_stories_link_idx").on(table.link),
  }),
);
export const serperTopStoriesRelations = relations(serperTopStories, ({ one }) => ({
  searchResponse: one(serperSearchResponses, {
    fields: [serperTopStories.searchResponseId],
    references: [serperSearchResponses.id],
  }),
}));
// Schema for topStories - used to validate API requests
export const insertTopStorySchema = createSelectSchema(serperTopStories).extend({}).omit({
  id: true,
});

// Type for topStories - used to type API request params and within Components
export type NewTopStoryParams = z.infer<typeof insertTopStorySchema>;

// People Also Ask table
export const serperPeopleAlsoAsk = pgTable(
  "serper_people_also_ask",
  {
    id: serial("id").primaryKey(),
    searchResponseId: integer("search_response_id").notNull(),
    question: text("question").notNull(),
    snippet: text("snippet").notNull(),
    title: text("title").notNull(),
    link: varchar("link", { length: 767 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    searchResponseIdIdx: index("serper_people_also_ask_search_response_id_idx").on(table.searchResponseId),
    linkIdx: index("serper_people_also_ask_link_idx").on(table.link),
  }),
);

export const serperPeopleAlsoAskRelations = relations(serperPeopleAlsoAsk, ({ one }) => ({
  searchResponse: one(serperSearchResponses, {
    fields: [serperPeopleAlsoAsk.searchResponseId],
    references: [serperSearchResponses.id],
  }),
}));

// Schema for peopleAlsoAsk - used to validate API requests
export const insertPeopleAlsoAskSchema = createSelectSchema(serperPeopleAlsoAsk).extend({}).omit({
  id: true,
});

// Type for peopleAlsoAsk - used to type API request params and within Components
export type NewPeopleAlsoAskParams = z.infer<typeof insertPeopleAlsoAskSchema>;

// Related Searches table
export const serperRelatedSearches = pgTable(
  "serper_related_searches",
  {
    id: serial("id").primaryKey(),
    searchResponseId: integer("search_response_id").notNull(),
    query: varchar("query", { length: 767 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    searchResponseIdIdx: index("serper_related_searches_search_response_id_idx").on(table.searchResponseId),
    queryIdx: index("serper_related_searches_query_idx").on(table.query),
  }),
);

export const serperRelatedSearchesRelations = relations(serperRelatedSearches, ({ one }) => ({
  searchResponse: one(serperSearchResponses, {
    fields: [serperRelatedSearches.searchResponseId],
    references: [serperSearchResponses.id],
  }),
}));

// Schema for relatedSearches - used to validate API requests
export const insertRelatedSearchSchema = createSelectSchema(serperRelatedSearches).extend({}).omit({
  id: true,
});

// Type for relatedSearches - used to type API request params and within Components
export type NewRelatedSearchParams = z.infer<typeof insertRelatedSearchSchema>;
