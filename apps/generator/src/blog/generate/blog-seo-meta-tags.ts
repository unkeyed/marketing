import { db } from "@/lib/db-marketing/client";
import { blogPosts, type BlogOutlineSection } from "@/lib/db-marketing/schemas/blog-posts";
import { keywords } from "@/lib/db-marketing/schemas";
import type { CacheStrategy } from "@/lib/types";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

export async function blogSeoMetaTagsStep({
  blogPostId,
  keyTerms,
  onCacheHit = "stale",
}: {
  blogPostId: number;
  keyTerms: string[];
  onCacheHit?: CacheStrategy;
}) {
  return withRetry(async () => {
    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, blogPostId),
    });

    if (
      existing?.metaTitle &&
      existing?.metaDescription &&
      existing?.metaH1 &&
      onCacheHit === "stale"
    ) {
      console.info(`[blog-seo] Cache hit for blog post ${blogPostId}`);
      return existing;
    }

    const relatedKeywords = await db.query.keywords.findMany({
      where: inArray(keywords.inputTerm, keyTerms),
    });

    const outline = (existing?.outline as BlogOutlineSection[]) || [];

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: `You are an SEO expert creating meta tags for a technical blog post aimed at API developers.

TITLE (aim for 50-60 chars, max 65):
- Lead with the primary keyword
- Make it compelling and click-worthy
- Include a value proposition

DESCRIPTION (aim for 145-155 chars, max 160):
- Summarize the post's value
- Include 1-2 key terms naturally
- End with a soft call to action

H1 (aim for 40-55 chars, max 70):
- Clear and descriptive
- Slightly different angle from the title
- Should validate the click from the search result`,
      prompt: `Create meta tags for a blog post covering: ${keyTerms.join(", ")}

Content outline:
${outline.map((s) => `- ${s.heading}`).join("\n")}

Related keywords:
${relatedKeywords.slice(0, 15).map((k) => k.keyword).join(", ")}

Generate a title, description, and H1 that form a compelling search-to-page experience.`,
      schema: z.object({
        title: z.string().max(65),
        description: z.string().max(160),
        h1: z.string().max(70),
      }),
      temperature: 0.3,
    });

    await db
      .update(blogPosts)
      .set({
        metaTitle: result.object.title,
        metaDescription: result.object.description,
        metaH1: result.object.h1,
        title: result.object.h1,
      })
      .where(eq(blogPosts.id, blogPostId));

    console.info(`[blog-seo] Generated meta tags for blog post ${blogPostId}`);
    return result.object;
  }, { maxAttempts: 3, label: "blogSeoMetaTags" });
}
