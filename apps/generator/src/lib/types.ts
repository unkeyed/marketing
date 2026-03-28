export type CacheStrategy = "revalidate" | "stale";

export const audienceLevels = ["beginner", "intermediate", "advanced"] as const;
export type AudienceLevel = (typeof audienceLevels)[number];
