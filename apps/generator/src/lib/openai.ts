import { createOpenAI } from "@ai-sdk/openai";

// Call OpenAI for evaluation
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
