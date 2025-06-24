import { db } from "@/lib/db-marketing/client";
import { takeawaysSchema } from "@/lib/db-marketing/schemas/takeaways-schema";
import { openai } from "@ai-sdk/openai";
import { task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { entries, exaScrapedResults } from "../../lib/db-marketing/schemas";
import type { CacheStrategy } from "./_generate-glossary-entry";

export const contentTakeawaysTask = task({
  id: "content_takeaways",
  retry: {
    maxAttempts: 3,
  },
  run: async ({
    term,
    onCacheHit = "stale" as CacheStrategy,
  }: {
    term: string;
    onCacheHit?: CacheStrategy;
  }) => {
    const existing = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, term),
      columns: {
        id: true,
        inputTerm: true,
        takeaways: true,
      },
    });

    if (existing?.takeaways && onCacheHit === "stale") {
      return existing;
    }

    // Get scraped content for context
    const scrapedContent = await db.query.exaScrapedResults.findMany({
      where: eq(exaScrapedResults.inputTerm, term),
      columns: {
        text: true,
        summary: true,
        url: true,
        domainCategory: true,
      },
    });

    // group the scrpaedContent by its domainCategory
    const groupedScrapedContent = scrapedContent.reduce(
      (acc, content) => {
        acc[content.domainCategory] = acc[content.domainCategory] || [];
        acc[content.domainCategory].push(content);
        return acc;
      },
      {} as Record<string, typeof scrapedContent>,
    );

    const takeaways = await generateObject({
      model: openai("gpt-4"),
      system: `
        You are an API documentation expert. Create comprehensive takeaways for API-related terms.
        Focus on practical, accurate, and developer-friendly content.
        Each section should be concise but informative.
        For best practices, include only the 3 most critical and widely-adopted practices.
        For usage in APIs, provide a maximum of 3 short, focused sentences highlighting key terms and primary use cases.
      `,
      prompt: `
        Term: "${term}"
        
        ## Scraped Content summaries
        We have ${Object.keys(groupedScrapedContent).length} domain categories with URLs for each.

        ${Object.entries(groupedScrapedContent)
          .map(([domainCategory, contents]) => {
            return `### Domain category: ${domainCategory}\n${contents.map((content) => `- ${content.url}: ${content.summary}`).join("\n\n")}`;
          })
          .join("\n\n")}
        
        Create structured takeaways covering:
        1. TLDR (brief, clear definition)
        2. Definition and structure - follow these rules:
           - Each value must be instantly recognizable (think of it as a memory aid) in one word or short expression
           - Maximum 1-3 words per value
           - Must be instantly understandable without explanation
           - Examples:
             Bad: "An API gateway is a server that acts as an intermediary..."
             Good: "Client-Server Bridge" or "API Request-Response Routing"
           - Focus on core concepts that can be expressed in minimal words
           
        3. Historical context - follow these exact formats:
           Introduced:
           - Use exact year if known: "1995"
           - Use decade if exact year unknown: "Early 1990s"
           - If truly uncertain: "Est. ~YYYY" with best estimate
           - Never use explanatory sentences
           
           Origin:
           - Format must be: "[Original Context] (${term})"
           - Example: "Web Services (${term})" or "Cloud Computing (${term})"
           - Keep [Original Context] to 1-2 words maximum
           - Never include explanations or evolution
           
           Evolution:
           - Format must be: "[Current State] ${term}"
           - Example: "Standardized ${term}" or "Enterprise ${term}"
           - Maximum 2-3 words
           - Focus on current classification/status only
           
        4. Usage in APIs (max 3 concise sentences covering essential terms and main use cases)
        5. Best practices (only the 3 most important and widely-used practices)
        6. Recommended reading
           - Choose 1 key resources each from Domain Categories: "Official", "Community", "Neutral" and "Google"
           - Choose the key resource that's most relevant to an API developer and at the same time the most authoritative and neutral one
           - Do NOT include a URL from other API DevTooling vendors like kong, AWS, Cloudflare etc. If that means we don't provide a key resource for "Google", that's fine. 
             - We don't want to name competitors.
             - Omit the URL if you're in doubt if it's a API DevTooling vendor or not
        7. Interesting fact (did you know)
      `,
      schema: takeawaysSchema,
      temperature: 0.2,
      experimental_telemetry: {
        functionId: "content_takeaways",
        isEnabled: true,
      },
    });

    await db
      .update(entries)
      .set({
        takeaways: takeaways.object,
      })
      .where(eq(entries.inputTerm, term));

    return db.query.entries.findFirst({
      where: eq(entries.inputTerm, term),
    });
  },
});
