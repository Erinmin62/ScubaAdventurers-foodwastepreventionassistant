import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const guardWorkspace = pgTable("guard_workspace", {
  id: text("id").primaryKey(),
  // Follow-ups are independent records within the locked workspace document,
  // not children of regenerated date-keyed recommendations. Existing documents
  // without followUps or inventory measurement dates are read as empty/unknown.
  data: jsonb("data").notNull(),
});
export const insertGuardWorkspaceSchema = createInsertSchema(guardWorkspace);
