import { db } from "@/lib/db-marketing/client";
import { exaScrapedResults, keywords } from "@/lib/db-marketing/schemas";
import { blogPosts } from "@/lib/db-marketing/schemas/blog-posts";
import type { AudienceLevel, CacheStrategy } from "@/lib/types";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

const blogOutlineSchema = z.object({
  outline: z.array(
    z.object({
      heading: z.string(),
      description: z.string(),
      order: z.number(),
      contentType: z.enum(["text", "code", "listicle", "table"]),
    }),
  ),
});

export async function generateBlogOutlineStep({
  blogPostId,
  keyTerms,
  audienceLevel,
  onCacheHit = "stale",
}: {
  blogPostId: number;
  keyTerms: string[];
  audienceLevel: AudienceLevel;
  onCacheHit?: CacheStrategy;
}) {
  return withRetry(
    async () => {
      const existing = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.id, blogPostId),
      });

      if (existing?.outline && existing.outline.length > 0 && onCacheHit === "stale") {
        console.info(`[blog-outline] Cache hit for blog post ${blogPostId}`);
        return existing.outline;
      }

      // Gather research from all key terms
      const allResearch = await db.query.exaScrapedResults.findMany({
        columns: { url: true, summary: true },
        where: inArray(exaScrapedResults.inputTerm, keyTerms),
      });

      const allKeywords = await db.query.keywords.findMany({
        where: and(
          inArray(keywords.inputTerm, keyTerms),
          or(eq(keywords.source, "headers"), eq(keywords.source, "title")),
        ),
      });

      const audienceGuidance = {
        beginner:
          "Write for developers new to this topic. Explain concepts from first principles, avoid jargon without definition, and use simple analogies.",
        intermediate:
          "Write for developers with working knowledge. Assume familiarity with basic concepts but explain advanced patterns and nuances.",
        advanced:
          "Write for senior developers and architects. Focus on edge cases, performance implications, trade-offs, and advanced patterns.",
      }[audienceLevel];

      const result = await generateObject({
        model: openai("gpt-4o-mini"),
        system: `You are a **Senior Technical Content Strategist** specializing in blog posts for API developers.
Your objective is to create a compelling blog post outline that is informative, engaging, and SEO-optimized.
The blog post should tell a cohesive story across the key terms, not just define them individually.

${audienceGuidance}

**Outline Requirements:**
- Start with a compelling introduction section
- Include 4-8 body sections that build on each other
- End with a conclusion/next-steps section
- Each section should have a clear purpose and flow naturally from the previous one
- Recommend content types (code examples, lists, tables, or text) for each section
- Headers should be engaging and under 70 characters`,
        prompt: `Create a blog post outline covering these key terms: ${keyTerms.join(", ")}

Audience level: ${audienceLevel}

Research summaries from top-ranking content:
${allResearch.map((s) => `${s.url}\n${s.summary}`).join("\n\n")}

Keywords found in existing content:
${allKeywords.map((k) => `- ${k.keyword}`).join("\n")}

Create a cohesive outline that weaves these terms together into a single compelling blog post.`,
        schema: blogOutlineSchema,
        experimental_telemetry: {
          functionId: "generateBlogOutline",
          recordInputs: true,
          recordOutputs: true,
        },
      });

      const outline = result.object.outline;

      await db.update(blogPosts).set({ outline }).where(eq(blogPosts.id, blogPostId));

      console.info(
        `[blog-outline] Generated ${outline.length} sections for blog post ${blogPostId}`,
      );
      return outline;
    },
    { maxAttempts: 5, label: "generateBlogOutline" },
  );
}
