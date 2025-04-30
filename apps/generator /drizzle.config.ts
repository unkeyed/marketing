import { defineConfig } from "drizzle-kit";

console.log(`the env vars: ${process.env.MARKETING_DATABASE_HOST} ${process.env.MARKETING_DATABASE_USERNAME} ${process.env.MARKETING_DATABASE_PASSWORD?.slice(0, 4)}***** ${process.env.MARKETING_DATABASE_NAME}`);

export default defineConfig({
  verbose: true,
  schema: "./src/lib/db-marketing/schemas/*.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: `mysql://${process.env.MARKETING_DATABASE_USERNAME}:${process.env.MARKETING_DATABASE_PASSWORD}@${process.env.MARKETING_DATABASE_HOST}/marketing`,
  },
});
