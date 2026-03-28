import { db } from "@/lib/db-marketing/client";
import { entries } from "@/lib/db-marketing/schemas";
import {
  type EvalType,
  evals,
  ratingsSchema,
  recommendationsSchema,
} from "@/lib/db-marketing/schemas/evals";
import { withRetry } from "@/lib/utils/retry";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";
import type { CacheStrategy } from "../generate-glossary-entry";

type TaskInput = {
  input: string;
  onCacheHit?: CacheStrategy;
};

type RatingOptions = {
  type: EvalType;
  content: string;
};

type EvalOptions = {
  content: string;
};

export type EvalResult = NonNullable<Awaited<ReturnType<typeof getOrCreateRatings>>>;

export async function getOrCreateRatings({ input, onCacheHit = "stale", ...options }: TaskInput & RatingOptions) {
  console.info(`Getting/Creating ${options.type} ratings for term: ${input}`);

  const entry = await db.query.entries.findFirst({
    where: eq(entries.inputTerm, input),
    orderBy: (entries, { desc }) => [desc(entries.createdAt)],
  });

  if (!entry) {
    throw new Error(`Entry not found for term: ${input}`);
  }

  const existing = await db.query.evals.findFirst({
    where: and(eq(evals.entryId, entry.id), eq(evals.type, options.type)),
  });

  if (existing?.ratings && existing.ratings?.length > 0 && onCacheHit === "stale") {
    console.info(`Cache hit. Found existing ${options.type} ratings for term: '${input}'`);
    return existing;
  }

  console.info(`Generating new ${options.type} ratings for term: ${input}`);

  const systemPrompt = `You are a Senior Technical Content Evaluator with expertise in API development and technical documentation.

Your task is to evaluate the ${options.type} aspects of the content provided. Rate each aspect from 0-10:

- Accuracy (0-10): How factually correct and technically precise is the content?
- Completeness (0-10): How well does it cover all necessary aspects of the topic?
- Clarity (0-10): How clear and understandable is the content for the target audience?

Guidelines:
- Be strict but fair in your evaluation
- Consider the technical accuracy especially for API-related content
- Focus on developer experience and understanding
- Provide whole numbers only
- Ensure all ratings have clear justification`;

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    prompt: `Review this content and provide numerical ratings:\n${options.content}`,
    schema: ratingsSchema,
  });
  if (!result.object) {
    throw new Error(`There's a data integrity issue here, this shouldn't happen`);
  }
  if (existing?.id) {
    await db
      .update(evals)
      .set({
        ratings: JSON.stringify(result.object),
      })
      .where(eq(evals.id, existing.id));
    const ratingEval = await db.query.evals.findFirst({
      where: eq(evals.id, existing.id),
    });
    if (!ratingEval?.id) {
      throw new Error(`There's a data integrity issue here, this shouldn't happen`);
    }
    return ratingEval;
  }
  const [inserted] = await db
    .insert(evals)
    .values({
      entryId: entry.id,
      type: options.type,
      ratings: JSON.stringify(result.object),
    })
    .returning({ id: evals.id });
  if (!inserted.id) {
    throw new Error(`There's a data integrity issue here, this shouldn't happen`);
  }
  const ratingEval = await db.query.evals.findFirst({
    where: eq(evals.id, inserted.id),
  });
  if (!ratingEval?.id) {
    throw new Error(`There's a data integrity issue here, this shouldn't happen`);
  }
  return ratingEval;
}

export async function getOrCreateRecommendations({ input, onCacheHit = "stale", ...options }: TaskInput & RatingOptions) {
  console.info(`Getting/Creating ${options.type} recommendations for term: ${input}`);

  const entry = await db.query.entries.findFirst({
    where: eq(entries.inputTerm, input),
    orderBy: (entries, { desc }) => [desc(entries.createdAt)],
  });

  if (!entry) {
    throw new Error(`Entry not found for term: ${input}`);
  }

  const existing = await db.query.evals.findFirst({
    where: and(eq(evals.entryId, entry.id), eq(evals.type, options.type)),
  });
  if (!existing?.id) {
    throw new Error(
      `The recommendations task for performed for term '${input}' but the previous rating hasn't been performed yet`,
    );
  }

  if (
    existing?.recommendations &&
    existing.recommendations?.length > 0 &&
    onCacheHit === "stale"
  ) {
    return existing;
  }

  console.info(`Generating new ${options.type} recommendations for term: ${input}`);

  const systemPrompt = `You are a Senior Technical Content Strategist specializing in API documentation.

Your task is to provide specific, actionable recommendations for improving the ${options.type} aspects of the content.

For each recommendation:
1. Identify the type of change needed (add/modify/merge/remove)
2. Provide a clear description of what needs to be changed
3. Give a specific suggestion for implementation

Guidelines:
- Focus on technical accuracy and completeness
- Consider the developer experience
- Be specific and actionable
- Avoid vague suggestions
- Ensure recommendations are practical and implementable
- Return between 2-5 recommendations`;

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    prompt: `Review this content and provide recommendations:\n${options.content}`,
    schema: recommendationsSchema,
  });

  await db
    .update(evals)
    .set({
      recommendations: JSON.stringify(result.object.recommendations),
    })
    .where(eq(evals.id, existing.id));
  const updated = await db.query.evals.findFirst({
    where: eq(evals.id, existing.id),
  });

  if (!updated?.id && !updated?.recommendations?.length) {
    throw new Error(
      `There's a data integrity issue for eval with id ${existing.id}: Recommendations are missing`,
    );
  }
  return updated;
}

export async function performTechnicalEval({ input, onCacheHit = "stale", ...options }: TaskInput & EvalOptions) {
  return withRetry(async () => {
    console.info(`Starting technical evaluation for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new Error(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, "technical")),
    });

    if (
      existing?.recommendations &&
      existing.recommendations?.length > 0 &&
      onCacheHit === "stale"
    ) {
      console.info(`Found existing technical evaluation for term: ${input}`);
      return existing;
    }

    console.info(`Performing new technical evaluation for term: ${input}`);

    const ratingsResult = await getOrCreateRatings({
      input,
      type: "technical",
      content: options.content,
      onCacheHit,
    });

    if (!ratingsResult?.id) {
      throw new Error(`The ratings for technical task didn't return an eval id.`);
    }
    console.info(`Generated technical ratings for term: ${input}`);

    const recommendationsResult = await getOrCreateRecommendations({
      input,
      type: "technical",
      content: options.content,
      onCacheHit,
    });

    if (!recommendationsResult?.id) {
      throw new Error("Failed to get recommendations");
    }
    console.info(`Generated technical recommendations for term: ${input}`);

    const newEval = await db.query.evals.findFirst({
      where: eq(evals.id, ratingsResult.id),
    });
    if (!newEval?.id) {
      throw new Error(
        `There's a data integrity issue with the eval of type "technical" with id '${ratingsResult.id}'`,
      );
    }

    return newEval;
  }, { maxAttempts: 5, label: "performTechnicalEval" });
}

export async function performSEOEval({ input, onCacheHit = "stale", ...options }: TaskInput & EvalOptions) {
  return withRetry(async () => {
    console.info(`Starting SEO evaluation for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new Error(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, "seo")),
    });

    if (
      existing?.recommendations &&
      existing.recommendations?.length > 0 &&
      onCacheHit === "stale"
    ) {
      console.info(`Cache hit. Found existing SEO evaluation for term '${input}'.`);
      return existing;
    }

    console.info(`Performing new SEO evaluation for term: ${input}`);

    const ratingsResult = await getOrCreateRatings({
      input,
      type: "seo",
      content: options.content,
      onCacheHit,
    });

    if (!ratingsResult?.id) {
      throw new Error(`The ratings for SEO task didn't return an eval id.`);
    }
    console.info(`Generated SEO ratings for term: ${input}`);

    const recommendationsResult = await getOrCreateRecommendations({
      input,
      type: "seo",
      content: options.content,
      onCacheHit,
    });

    if (!recommendationsResult?.id) {
      throw new Error(`The recommendations for SEO task didn't return an eval id.`);
    }
    const newEval = await db.query.evals.findFirst({
      where: eq(evals.id, ratingsResult.id),
    });
    if (!newEval?.id) {
      throw new Error(`There's a data integrity issue here, this shouldn't happen`);
    }
    return newEval;
  }, { maxAttempts: 5, label: "performSEOEval" });
}

export async function performEditorialEval({ input, onCacheHit = "stale", ...options }: TaskInput & EvalOptions) {
  return withRetry(async () => {
    console.info(`[workflow=glossary] [task=editorial_eval] Starting for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new Error(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, "editorial")),
    });

    if (
      existing?.recommendations &&
      existing.recommendations?.length > 0 &&
      onCacheHit === "stale"
    ) {
      console.info(`Cache hit. Found existing editorial evaluation for term: '${input}'.`);
      return existing;
    }

    console.info(`Performing new editorial evaluation for term: ${input}`);

    const ratingsResult = await getOrCreateRatings({
      input,
      type: "editorial",
      content: options.content,
      onCacheHit,
    });

    if (!ratingsResult?.id) {
      throw new Error(`The ratings for editorial task didn't return an eval id.`);
    }
    console.info(`Generated editorial ratings for term: ${input}`);

    const recommendationsResult = await getOrCreateRecommendations({
      input,
      type: "editorial",
      content: options.content,
      onCacheHit,
    });

    if (!recommendationsResult?.id) {
      throw new Error(`The recommendations for editorial task didn't return an eval id.`);
    }
    console.info(`Generated editorial recommendations for term: ${input}`);

    const newEval = await db.query.evals.findFirst({
      where: eq(evals.id, ratingsResult.id),
    });
    if (!newEval?.id) {
      throw new Error(
        `There's a data integrity issue with the eval of type "editorial" with id '${ratingsResult.id}'`,
      );
    }

    return newEval;
  }, { maxAttempts: 5, label: "performEditorialEval" });
}
