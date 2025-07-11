import { z } from "zod";

export const env = () =>
  z
    .object({
      NEXT_PUBLIC_BASE_URL: z.string().url().default("https://unkey.com"),
      NEXT_PUBLIC_C15T_MODE: z.string().url().nullable(),
    })
    .parse(process.env);
