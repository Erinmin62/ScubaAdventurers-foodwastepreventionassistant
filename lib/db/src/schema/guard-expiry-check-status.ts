import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** One latest expiry scan outcome per owner; kept separate from inventory and email delivery records. */
export const guardExpiryCheckStatus = pgTable("guard_expiry_check_status", {
  workspaceId: text("workspace_id").primaryKey(),
  lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }).notNull(),
  outcome: text("outcome").notNull(),
});
