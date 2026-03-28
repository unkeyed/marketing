import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { generateBlogPost } from "./blog/generate-blog-post";
import { generateGlossaryEntry } from "./glossary/generate-glossary-entry";
import { audienceLevels } from "./lib/types";

const app = new Hono();

const generateRequestSchema = z.object({
  term: z.string().min(1, "term is required"),
  onCacheHit: z.enum(["stale", "revalidate"]).optional().default("stale"),
});

// Health check
app.all("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

// Generate a glossary entry
app.post("/api/glossary/generate", async (c) => {
  const body = await c.req.json();
  const parsed = generateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { term, onCacheHit } = parsed.data;

  try {
    console.info(`[API] Starting glossary generation for term: "${term}" (cache: ${onCacheHit})`);
    const result = await generateGlossaryEntry({ term, onCacheHit });
    console.info(`[API] Glossary generation completed for term: "${term}"`);

    return c.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error(`[API] Glossary generation failed for term: "${term}"`, error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Regenerate (force revalidate) a glossary entry
app.post("/api/glossary/regenerate", async (c) => {
  const body = await c.req.json();
  const parsed = z.object({ term: z.string().min(1) }).safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { term } = parsed.data;

  try {
    console.info(`[API] Starting glossary regeneration for term: "${term}"`);
    const result = await generateGlossaryEntry({ term, onCacheHit: "revalidate" });
    console.info(`[API] Glossary regeneration completed for term: "${term}"`);

    return c.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error(`[API] Glossary regeneration failed for term: "${term}"`, error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Blog post generation
const blogRequestSchema = z.object({
  keyTerms: z.array(z.string().min(1)).min(1, "at least one key term is required"),
  audienceLevel: z.enum(audienceLevels).default("intermediate"),
  onCacheHit: z.enum(["stale", "revalidate"]).optional().default("stale"),
});

app.post("/api/blog/generate", async (c) => {
  const body = await c.req.json();
  const parsed = blogRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { keyTerms, audienceLevel, onCacheHit } = parsed.data;

  try {
    console.info(
      `[API] Starting blog generation for terms: [${keyTerms.join(", ")}] (audience: ${audienceLevel}, cache: ${onCacheHit})`,
    );
    const result = await generateBlogPost({ keyTerms, audienceLevel, onCacheHit });
    console.info(`[API] Blog generation completed for terms: [${keyTerms.join(", ")}]`);

    return c.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error(`[API] Blog generation failed for terms: [${keyTerms.join(", ")}]`, error);
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

const port = Number(process.env.PORT) || 3069;

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.info(`Generator server listening on http://0.0.0.0:${info.port}`);
  },
);
