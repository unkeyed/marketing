import { z } from "zod";

export const env = () =>
  z
    .object({
      UPSTASH_REDIS_REST_URL: z.string(),
      UPSTASH_REDIS_REST_TOKEN: z.string(),
      RATELIMIT_DEMO_ROOT_KEY: z.string(),
    })
    .parse(process.env);
