import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Minimal verified receipts. No recipient addresses or raw webhook payloads.
 * No outbox FK: a webhook may arrive before its provider receipt is committed.
 */
export const guardEmailDeliveryEvents = pgTable("guard_email_delivery_events", {
  id: text("id").primaryKey(),
  providerMessageId: text("provider_message_id").notNull(),
  type: text("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("guard_email_delivery_message_idx").on(table.providerMessageId)]);
