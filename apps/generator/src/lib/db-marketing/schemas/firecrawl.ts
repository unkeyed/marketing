import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import { searchQueries } from "./searchQuery";
import { serperOrganicResults } from "./serper";

export const firecrawlResponses = pgTable(
  "firecrawl_responses",
  {
    id: serial("id").primaryKey(),
    success: boolean("success").notNull(),
    scrapeId: text("scrape_id"),
    markdown: text("markdown"),
    sourceUrl: varchar("source_url", { length: 767 }).notNull(),
    statusCode: integer("status_code"),
    title: text("title"),
    description: text("description"),
    language: text("language"),
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogUrl: text("og_url"),
    ogImage: text("og_image"),
    ogSiteName: text("og_site_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
    error: text("error"),
    inputTerm: varchar("input_term", { length: 767 }),
    summary: text("summary"),
  },
  (table) => ({
    sourceUrlIdx: index("firecrawl_responses_source_url_idx").on(table.sourceUrl),
    uniqueSourceUrl: unique("firecrawl_responses_source_url_unique").on(table.sourceUrl),
    inputTermIdx: index("firecrawl_responses_input_term_idx").on(table.inputTerm),
  }),
);

export const firecrawlResponsesRelations = relations(firecrawlResponses, ({ one }) => ({
  serperOrganicResult: one(serperOrganicResults, {
    fields: [firecrawlResponses.sourceUrl],
    references: [serperOrganicResults.link],
  }),
  searchQuery: one(searchQueries, {
    fields: [firecrawlResponses.inputTerm],
    references: [searchQueries.inputTerm],
  }),
}));

export const insertFirecrawlResponseSchema = createInsertSchema(firecrawlResponses)
  .extend({})
  .omit({ id: true });
export type NewFirecrawlResponse = z.infer<typeof insertFirecrawlResponseSchema>;
export type FirecrawlResponse = typeof firecrawlResponses.$inferSelect;
