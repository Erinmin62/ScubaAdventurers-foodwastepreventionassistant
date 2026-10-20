import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const guardWorkspace = pgTable("guard_workspace", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});
export const insertGuardWorkspaceSchema = createInsertSchema(guardWorkspace);
