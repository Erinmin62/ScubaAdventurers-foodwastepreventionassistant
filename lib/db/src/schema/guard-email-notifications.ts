import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { guardWorkspace } from "./guard-workspace";

/** Separate outbox: the email worker never updates the workspace document. */
export const guardEmailNotifications = pgTable("guard_email_notifications", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => guardWorkspace.id, { onDelete: "cascade" }),
  recipientHash: text("recipient_hash").notNull(),
  kind: text("kind").notNull(),
  eventKey: text("event_key").notNull(),
  relatedIds: jsonb("related_ids").$type<string[]>().notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("queued"),
  message: jsonb("message").$type<{ subject: string; text: string }>().notNull(),
  attempts: integer("attempts").notNull().default(0),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  providerMessageId: text("provider_message_id"),
  errorCode: text("error_code"),
  errorDetail: text("error_detail"),
}, table => [index("guard_email_workspace_status_idx").on(table.workspaceId, table.status)]);
