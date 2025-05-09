import { relations } from "drizzle-orm";
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { searchQueries } from "./searchQuery";
import { sections } from "./sections";
import type { Takeaways } from "./takeaways-schema";
import type { domainCategories } from "@/trigger/glossary/research/technical/exa-domain-search";
import type Exa from "exa-js";
import { composeSearchOptions } from "@/lib/exa";
import type { TaskOutput } from "@trigger.dev/sdk/v3";
import type { evaluateSearchResults } from "@/trigger/glossary/research/technical/evaluate-search-results";

export const entryStatus = ["ARCHIVED", "PUBLISHED"] as const;
export type EntryStatus = (typeof entryStatus)[number];
export const faqSchema = z.array(
  z.object({
    question: z.string(),
    answer: z.string(),
  }),
);

export type FAQ = z.infer<typeof faqSchema>;

export type TechnicalResearch = {
  inputTerm: string;
  summary: TaskOutput<typeof evaluateSearchResults>["evaluationSummary"];
  included: Array<
  Awaited<ReturnType<typeof Exa.prototype.getContents>>["results"][number] & {
    // custom types appended to exa's types:
    category: (typeof domainCategories)[number]; // our custom domainCategories
  }>;
  excluded: Array<
  Awaited<ReturnType<typeof Exa.prototype.searchAndContents<ReturnType<typeof composeSearchOptions>>>>["results"][number] & {
    category: (typeof domainCategories)[number]; // our custom domainCategories
  }>;
  [key: string]: any;
};

export const entries = mysqlTable(
  "entries",
  {
    id: int("id").primaryKey().autoincrement(),
    inputTerm: varchar("input_term", { length: 767 }).notNull(),
    githubPrUrl: text("github_pr_url"),
    dynamicSectionsContent: text("dynamic_sections_content"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    metaH1: text("meta_h1"),
    categories: json("linking_categories").$type<string[]>().default([]),
    status: mysqlEnum("status", entryStatus),
    takeaways: json("content_takeaways").$type<Takeaways>(),
    faq: json("content_faq").$type<FAQ>(),
    technicalResearch: json("technical_research").$type<TechnicalResearch>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    inputTermHashIdx: index("input_term_idx").on(table.inputTerm),
  }),
);

export const entriesRelations = relations(entries, ({ many, one }) => ({
  dynamicSections: many(sections),
  searchQuery: one(searchQueries, {
    fields: [entries.inputTerm],
    references: [searchQueries.inputTerm],
  }),
}));

export const insertEntrySchema = createInsertSchema(entries).extend({}).omit({ id: true });
export const selectEntrySchema = createSelectSchema(entries);

export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type SelectEntry = typeof entries.$inferSelect;
