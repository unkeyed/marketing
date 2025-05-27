import { db } from "@/lib/db-marketing/client";
import { entries } from "@/lib/db-marketing/schemas";
import {
  type EvalType,
  evals,
  ratingsSchema,
  recommendationsSchema,
} from "@/lib/db-marketing/schemas/evals";
import { openai } from "@ai-sdk/openai";
import { AbortTaskRunError, task } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";
import type { CacheStrategy } from "./_generate-glossary-entry";

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

// Base task for getting or creating ratings
export const getOrCreateRatingsTask = task({
  id: "get_or_create_ratings",
  run: async ({ input, onCacheHit = "stale", ...options }: TaskInput & RatingOptions) => {
    console.info(`Getting/Creating ${options.type} ratings for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new AbortTaskRunError(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, options.type)),
    });

    if (existing?.ratings && existing.ratings?.length > 0 && onCacheHit === "stale") {
      console.info(`⏩︎ Cache hit. Found existing ${options.type} ratings for term: '${input}'`);
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
      throw new AbortTaskRunError(`There's a data integrity issue here, this shouldn't happen`);
    }
    // update the existing eval if it exists
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
        throw new AbortTaskRunError(`There's a data integrity issue here, this shouldn't happen`);
      }
      return ratingEval;
    }
    // create a new eval if it doesn't exist
    const [inserted] = await db
      .insert(evals)
      .values({
        entryId: entry.id,
        type: options.type,
        ratings: JSON.stringify(result.object),
      })
      .$returningId();
    if (!inserted.id) {
      throw new AbortTaskRunError(`There's a data integrity issue here, this shouldn't happen`);
    }
    const ratingEval = await db.query.evals.findFirst({
      where: eq(evals.id, inserted.id),
    });
    if (!ratingEval?.id) {
      throw new AbortTaskRunError(`There's a data integrity issue here, this shouldn't happen`);
    }
    return ratingEval;
  },
});

// Base task for getting or creating recommendations
export const getOrCreateRecommendationsTask = task({
  id: "get_or_create_recommendations",
  run: async ({ input, onCacheHit = "stale", ...options }: TaskInput & RatingOptions) => {
    console.info(`Getting/Creating ${options.type} recommendations for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new AbortTaskRunError(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, options.type)),
    });
    if (!existing?.id) {
      throw new AbortTaskRunError(
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

    // persist the recommendations to our DB:
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
      throw new AbortTaskRunError(
        `There's a  data integrity issue for eval with id ${existing.id}: Recommendations are missing`,
      );
    }
    return updated;
  },
});

// Technical Review Task
export const performTechnicalEvalTask = task({
  id: "perform_technical_eval",
  run: async ({ input, onCacheHit = "stale", ...options }: TaskInput & EvalOptions) => {
    console.info(`Starting technical evaluation for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new AbortTaskRunError(`Entry not found for term: ${input}`);
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

    // perform rating first
    const ratingsResult = await getOrCreateRatingsTask.triggerAndWait({
      input,
      type: "technical",
      content: options.content,
      onCacheHit,
    });

    if (!ratingsResult.ok) {
      throw new AbortTaskRunError("Failed to perform technical ratings task");
    }
    if (!ratingsResult.output?.id) {
      throw new AbortTaskRunError(
        `The ratings for technical task didn't return an eval id. This shouldn't happen.`,
      );
    }
    console.info(`Generated technical ratings for term: ${input}`, ratingsResult.output);

    const recommendationsResult = await getOrCreateRecommendationsTask.triggerAndWait({
      input,
      type: "technical",
      content: options.content,
      onCacheHit,
    });

    if (!recommendationsResult.ok) {
      throw new AbortTaskRunError("Failed to get recommendations");
    }
    console.info(
      `Generated technical recommendations for term: ${input}`,
      recommendationsResult.output,
    );

    // return the new eval with the ratings and recommendations
    const newEval = await db.query.evals.findFirst({
      where: eq(evals.id, ratingsResult.output?.id),
    });
    if (!newEval?.id) {
      throw new AbortTaskRunError(
        `There's a data integrity issue with the eval of type "technical" with id '${ratingsResult.output?.id}': The eval is missing`,
      );
    }

    return newEval;
  },
});

// SEO Eval Task
export const performSEOEvalTask = task({
  id: "perform_seo_eval",
  run: async ({ input, onCacheHit = "stale", ...options }: TaskInput & EvalOptions) => {
    console.info(`Starting SEO evaluation for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new AbortTaskRunError(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, "seo")),
    });

    if (
      existing?.recommendations &&
      existing.recommendations?.length > 0 &&
      onCacheHit === "stale"
    ) {
      console.info(`⏩︎ Cache hit. Found existing SEO evaluation for term '${input}'.`);
      return existing;
    }

    console.info(`Performing new SEO evaluation for term: ${input}`);

    const ratingsResult = await getOrCreateRatingsTask.triggerAndWait({
      input,
      type: "seo",
      content: options.content,
      onCacheHit,
    });

    if (!ratingsResult.ok) {
      throw new AbortTaskRunError("Failed to get SEO ratings");
    }
    if (!ratingsResult.output.id) {
      throw new AbortTaskRunError(
        `The ratings for SEO task didn't return an eval id. This shouldn't happen.`,
      );
    }
    console.info(`Generated SEO ratings for term: ${input}`, ratingsResult.output);

    const recommendationsResult = await getOrCreateRecommendationsTask.triggerAndWait({
      input,
      type: "seo",
      content: options.content,
      onCacheHit,
    });

    if (!recommendationsResult.ok) {
      throw new AbortTaskRunError("Failed to get SEO recommendations");
    }
    if (!recommendationsResult.output?.id) {
      throw new AbortTaskRunError(
        `The recommendations for SEO task didn't return an eval id. This shouldn't happen.`,
      );
    }
    const newEval = await db.query.evals.findFirst({
      where: eq(evals.id, ratingsResult.output.id),
    });
    if (!newEval?.id) {
      throw new AbortTaskRunError(`There's a data integrity issue here, this shouldn't happen`);
    }
    return newEval;
  },
});

// Editorial Eval Task
export const performEditorialEvalTask = task({
  id: "perform_editorial_eval",
  run: async ({ input, onCacheHit = "stale", ...options }: TaskInput & EvalOptions) => {
    console.info(`[workflow=glossary] [task=editorial_eval] Starting for term: ${input}`);

    const entry = await db.query.entries.findFirst({
      where: eq(entries.inputTerm, input),
      orderBy: (entries, { desc }) => [desc(entries.createdAt)],
    });

    if (!entry) {
      throw new AbortTaskRunError(`Entry not found for term: ${input}`);
    }

    const existing = await db.query.evals.findFirst({
      where: and(eq(evals.entryId, entry.id), eq(evals.type, "editorial")),
    });

    if (
      existing?.recommendations &&
      existing.recommendations?.length > 0 &&
      onCacheHit === "stale"
    ) {
      console.info(`⏩︎ Cache hit. Found existing editorial evaluation for term: '${input}'.`);
      return existing;
    }

    console.info(`Performing new editorial evaluation for term: ${input}`);

    const ratingsResult = await getOrCreateRatingsTask.triggerAndWait({
      input,
      type: "editorial",
      content: options.content,
      onCacheHit,
    });

    if (!ratingsResult.ok) {
      throw new AbortTaskRunError(
        "[workflow=glossary] [task=editorial_eval] Failed to get editorial ratings",
      );
    }
    if (!ratingsResult.output?.id) {
      throw new AbortTaskRunError(
        `The ratings for editorial task didn't return an eval id. This shouldn't happen.`,
      );
    }
    console.info(`Generated editorial ratings for term: ${input}`, ratingsResult.output);

    const recommendationsResult = await getOrCreateRecommendationsTask.triggerAndWait({
      input,
      type: "editorial",
      content: options.content,
      onCacheHit,
    });

    if (!recommendationsResult.ok) {
      throw new AbortTaskRunError("Failed to get editorial recommendations");
    }
    if (!recommendationsResult.output?.id) {
      throw new AbortTaskRunError(
        `The recommendations for editorial task didn't return an eval id. This shouldn't happen.`,
      );
    }
    console.info(
      `Generated editorial recommendations for term: ${input}`,
      recommendationsResult.output,
    );

    const newEval = await db.query.evals.findFirst({
      where: eq(evals.id, ratingsResult.output.id),
    });
    if (!newEval?.id) {
      throw new AbortTaskRunError(
        `There's a data integrity issue with the eval of type "editorial" with id '${ratingsResult.output.id}': The eval id from the ratings task could not be found.`,
      );
    }

    return newEval;
  },
});
