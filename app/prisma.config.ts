import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct URL for migrations (bypasses PgBouncer)
    url: process.env["DIRECT_URL"]!,
  },
});
