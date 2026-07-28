import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import path from "path";

const dbPath = path.resolve(__dirname, "../../sqlite.db");
export const sqlite = createClient({ url: `file:${dbPath}` });
export const db = drizzle(sqlite, { schema });

export * from "./schema";
