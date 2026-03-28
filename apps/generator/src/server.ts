import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { generateGlossaryEntry, type CacheStrategy } from "./glossary/generate-glossary-entry";

const app = new Hono();

const generateRequestSchema = z.object({
  term: z.string().min(1, "term is required"),
  onCacheHit: z.enum(["stale", "revalidate"]).optional().default("stale"),
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
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

const port = Number(process.env.PORT) || 3069;

console.info(`Generator server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
