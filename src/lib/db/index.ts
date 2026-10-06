import "server-only"; // comment out temporarily for `npm run auth:generate`, then restore
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL!, {
  schema,
  casing: "snake_case",
});