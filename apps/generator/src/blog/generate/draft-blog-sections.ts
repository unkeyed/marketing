import { db } from "@/lib/db-marketing/client";
import { blogPosts, type BlogOutlineSection } from "@/lib/db-marketing/schemas/blog-posts";
import { exaScrapedResults, keywords } from "@/lib/db-marketing/schemas";
import type { AudienceLevel, CacheStrategy } from "@/lib/types";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { eq, inArray } from "drizzle-orm";

export async function draftBlogSectionsStep({
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
  return withRetry(async () => {
    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, blogPostId),
    });

    if (existing?.content && onCacheHit === "stale") {
      console.info(`[blog-draft] Cache hit for blog post ${blogPostId}`);
      return existing.content;
    }

    if (!existing?.outline || existing.outline.length === 0) {
      throw new Error(`Blog post ${blogPostId} has no outline. Run outline generation first.`);
    }

    // Gather research context
    const research = await db.query.exaScrapedResults.findMany({
      columns: { url: true, summary: true, text: true },
      where: inArray(exaScrapedResults.inputTerm, keyTerms),
    });

    const relatedKeywords = await db.query.keywords.findMany({
      where: inArray(keywords.inputTerm, keyTerms),
    });

    const audienceGuidance = {
      beginner: `Write for developers new to these topics. Define all technical terms on first use. Use analogies. Include beginner-friendly code examples with comments explaining each line.`,
      intermediate: `Write for developers with working knowledge. Skip basic definitions but explain nuanced details. Include practical code examples that demonstrate real-world usage patterns.`,
      advanced: `Write for senior developers. Focus on edge cases, performance implications, and architectural decisions. Include advanced code examples showing optimizations and trade-offs.`,
    }[audienceLevel];

    const outline = existing.outline as BlogOutlineSection[];

    // Draft the full blog post
    const draftResult = await generateText({
      model: openai("gpt-4-turbo"),
      system: `You are an expert technical writer creating blog posts for API developers.
${audienceGuidance}

Guidelines:
1. Write in markdown format
2. Use "##" for section headings (they match the outline)
3. Start with an engaging introduction paragraph before the first heading
4. Do NOT include a title/H1 — it will be provided separately
5. Write cohesive, flowing content — not just definitions
6. Include code examples in TypeScript using ESM syntax where appropriate
7. Ensure each section adds unique value and connects to the next
8. Be concise but informative — no fluff
9. Include practical examples and real-world scenarios
10. End with a conclusion that ties everything together`,
      prompt: `Write a complete blog post based on this outline:

Key terms: ${keyTerms.join(", ")}
Audience: ${audienceLevel}

Outline:
${outline.map((s) => `## ${s.heading}\n${s.description}\nContent type: ${s.contentType}`).join("\n\n")}

Research context:
${research.slice(0, 10).map((r) => `Source: ${r.url}\nSummary: ${r.summary}`).join("\n\n")}

Keywords to naturally incorporate:
${relatedKeywords.slice(0, 20).map((k) => k.keyword).join(", ")}`,
    });

    // Review the content
    const reviewResult = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are a senior technical editor. Review this blog post for:
1. Factual accuracy
2. Technical correctness of code examples
3. Logical flow between sections
4. Engagement and readability for ${audienceLevel}-level developers
5. No AI-sounding phrases or filler content

If the content is good, return it with minor improvements. If there are issues, rewrite the problematic sections.`,
      prompt: `Review and improve this blog post:\n\n${draftResult.text}`,
    });

    // Strip any leading H1 if present
    const finalContent = reviewResult.text.replace(/^#\s+[^\n]+\n/, "");

    await db
      .update(blogPosts)
      .set({ content: finalContent })
      .where(eq(blogPosts.id, blogPostId));

    console.info(`[blog-draft] Drafted ${finalContent.length} chars for blog post ${blogPostId}`);
    return finalContent;
  }, { maxAttempts: 5, label: "draftBlogSections" });
}
