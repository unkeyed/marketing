import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { searchQueries } from "./searchQuery";
import { sections } from "./sections";
import type { Takeaways } from "./takeaways-schema";
import { exaScrapedResults, technicalResearch } from "./technical-research";
import type { TechnicalResearch } from "./technical-research";

export const entryStatus = ["ARCHIVED", "PUBLISHED"] as const;
export type EntryStatus = (typeof entryStatus)[number];
export const faqSchema = z.array(
  z.object({
    question: z.string(),
    answer: z.string(),
  }),
);

export type FAQ = z.infer<typeof faqSchema>;

export const entryStatusEnum = pgEnum("status", entryStatus);

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    inputTerm: varchar("input_term", { length: 767 }).notNull(),
    githubPrUrl: text("github_pr_url"),
    dynamicSectionsContent: text("dynamic_sections_content"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    metaH1: text("meta_h1"),
    categories: jsonb("linking_categories").$type<string[]>().default([]),
    status: entryStatusEnum("status"),
    takeaways: jsonb("content_takeaways").$type<Takeaways>(),
    faq: jsonb("content_faq").$type<FAQ>(),
    technicalResearch: jsonb("technical_research").$type<TechnicalResearch>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    inputTermHashIdx: index("entries_input_term_idx").on(table.inputTerm),
  }),
);

export const entriesRelations = relations(entries, ({ many, one }) => ({
  dynamicSections: many(sections),
  searchQuery: one(searchQueries, {
    fields: [entries.inputTerm],
    references: [searchQueries.inputTerm],
  }),
  technicalResearches: many(technicalResearch),
  exaScrapedResults: many(exaScrapedResults),
}));

export const insertEntrySchema = createInsertSchema(entries).extend({}).omit({ id: true });
export const selectEntrySchema = createSelectSchema(entries);

export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type SelectEntry = typeof entries.$inferSelect;
