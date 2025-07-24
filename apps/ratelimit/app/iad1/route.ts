import { env } from "@/lib/env";
import { Ratelimit as UnkeyRatelimit } from "@unkey/ratelimit";
import { Ratelimit as UpstashRatelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";
import { z } from "zod";

export const runtime = "edge";
export const preferredRegion = ["iad1"];

const UNKEY_RATELIMIT_COOKIE = "UNKEY_RATELIMIT";
const upstashCache = new Map();
const unkeyCache = new Map();
export const POST = async (req: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const { limit, duration } = z
    .object({
      limit: z.number().int(),
      duration: z.enum(["1s", "10s", "60s", "5m"]),
    })
    .parse(await req.json());

  const unkey = new UnkeyRatelimit({
    namespace: "ratelimit-demo",
    rootKey: env().RATELIMIT_DEMO_ROOT_KEY,
    limit,
    duration,
    cache: unkeyCache,
  });

  const upstash = new UpstashRatelimit({
    redis: Redis.fromEnv(),
    limiter: UpstashRatelimit.slidingWindow(limit, duration),
    ephemeralCache: upstashCache,
  });

  let id: string = crypto.randomUUID();
  const c = cookieStore.get(UNKEY_RATELIMIT_COOKIE);
  if (c) {
    id = c.value;
  } else {
    cookieStore.set(UNKEY_RATELIMIT_COOKIE, id, {
      maxAge: 60 * 60 * 24,
    });
  }

  const t1 = performance.now();
  const [unkeyResponse, upstashResponse] = await Promise.all([
    unkey.limit(`${id}-unkey-iad1`).then((res) => ({ ...res, latency: performance.now() - t1 })),
    upstash
      .limit(`${id}-upstash-iad1`)
      .then((res) => ({ ...res, latency: performance.now() - t1 })),
  ]);

  return Response.json({
    time: Date.now(),
    unkey: unkeyResponse,
    upstash: upstashResponse,
  });
};
