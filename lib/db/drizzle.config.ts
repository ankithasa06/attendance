import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:../../artifacts/sqlite.db",
  },
});
