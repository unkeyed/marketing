import { defineConfig } from "drizzle-kit";

export default defineConfig({
  verbose: true,
  schema: "./src/lib/db-marketing/schemas/*.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: `mysql://${process.env.MARKETING_DATABASE_USERNAME}:${process.env.MARKETING_DATABASE_PASSWORD}@${process.env.MARKETING_DATABASE_HOST}/marketing`,
  },
});
