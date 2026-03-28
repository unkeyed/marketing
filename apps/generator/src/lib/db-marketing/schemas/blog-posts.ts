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
import type { audienceLevels } from "../../types";

export const blogAudienceLevelEnum = pgEnum("blog_audience_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const blogPostStatus = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const blogPostStatusEnum = pgEnum("blog_post_status", blogPostStatus);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: serial("id").primaryKey(),
    title: text("title"),
    slug: varchar("slug", { length: 767 }),
    keyTerms: jsonb("key_terms").$type<string[]>().notNull(),
    audienceLevel: blogAudienceLevelEnum("audience_level").notNull(),
    outline: jsonb("outline").$type<BlogOutlineSection[]>(),
    content: text("content"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    metaH1: text("meta_h1"),
    status: blogPostStatusEnum("status").default("DRAFT"),
    githubPrUrl: text("github_pr_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: index("blog_posts_slug_idx").on(table.slug),
  }),
);

export const blogPostsRelations = relations(blogPosts, () => ({}));

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true });
export const selectBlogPostSchema = createSelectSchema(blogPosts);

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type SelectBlogPost = typeof blogPosts.$inferSelect;

export type BlogOutlineSection = {
  heading: string;
  description: string;
  order: number;
  contentType: "text" | "code" | "listicle" | "table";
};
