import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { entries } from "./entries";
import { keywords } from "./keywords";

export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id")
    .notNull()
    .references(() => entries.id),
  heading: text("heading").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  markdown: text("markdown"),
  citedSources: text("cited_sources"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  entry: one(entries, {
    fields: [sections.entryId],
    references: [entries.id],
  }),
  contentTypes: many(sectionContentTypes),
  sectionsToKeywords: many(sectionsToKeywords),
}));

export const insertSectionSchema = createInsertSchema(sections).omit({ id: true });
export const selectSectionSchema = createSelectSchema(sections);
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type SelectSection = typeof sections.$inferSelect;
const contentTypes = [
  "listicle",
  "table",
  "image",
  "code",
  "infographic",
  "timeline",
  "other",
  "text",
  "video",
] as const;

export const contentTypeEnum = pgEnum("type", contentTypes);

export const sectionContentTypes = pgTable("section_content_types", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull(),
  type: contentTypeEnum("type").notNull(),
  description: text("description").notNull(),
  whyToUse: text("why_to_use").notNull(),
});

export const sectionContentTypesRelations = relations(sectionContentTypes, ({ one }) => ({
  section: one(sections, {
    fields: [sectionContentTypes.sectionId],
    references: [sections.id],
  }),
}));

export const insertSectionContentTypeSchema = createInsertSchema(sectionContentTypes)
  .extend({})
  .omit({ id: true });
export const selectSectionContentTypeSchema = createSelectSchema(sectionContentTypes);

export type InsertSectionContentType = z.infer<typeof insertSectionContentTypeSchema>;
export type SelectSectionContentType = typeof sectionContentTypes.$inferSelect;

export const sectionsToKeywords = pgTable(
  "sections_to_keywords",
  {
    sectionId: integer("section_id").notNull(),
    keywordId: integer("keyword_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).$default(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$default(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sectionId, t.keywordId] }),
  }),
);

export const selectSectionsToKeywordsSchema = createSelectSchema(sectionsToKeywords);
export const insertSectionsToKeywordsSchema = createInsertSchema(sectionsToKeywords).extend({});

export type InsertSectionsToKeywords = z.infer<typeof insertSectionsToKeywordsSchema>;
export type SelectSectionsToKeywords = typeof sectionsToKeywords.$inferSelect;

export const sectionsToKeywordsRelations = relations(sectionsToKeywords, ({ one }) => ({
  section: one(sections, {
    fields: [sectionsToKeywords.sectionId],
    references: [sections.id],
  }),
  keyword: one(keywords, {
    fields: [sectionsToKeywords.keywordId],
    references: [keywords.id],
  }),
}));
