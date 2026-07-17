import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Raw telemetry captured from the phone or entered by the user.
 *
 * `type` taxonomy:
 *  - "mood_checkin"  — user mood check-in (may include thoughtText)
 *  - "thought_entry" — explicit journal / thought entry
 *  - "shared_text"   — text shared into the app via the Android share sheet
 *  - "notification"  — text captured from a notification (NotificationListenerService)
 *  - "app_usage"     — app foreground/usage event (UsageStatsManager)
 *  - "browser"       — browser activity snippet
 *
 * `source` is the origin: an Android package name (e.g. "com.whatsapp"),
 * "manual", "share_sheet", etc.
 *
 * `processedAt` is set once the cognitive engine has extracted automatic
 * thoughts from this event, so analysis never reprocesses the same row.
 */
export const telemetryEventsTable = pgTable(
  "telemetry_events",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    mood: text("mood"),
    thoughtText: text("thought_text"),
    source: text("source"),
    metadata: jsonb("metadata"),
    externalId: text("external_id"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("telemetry_processed_idx").on(table.processedAt),
    index("telemetry_created_idx").on(table.createdAt),
    uniqueIndex("telemetry_external_id_idx").on(table.externalId),
  ],
);

export const insertTelemetryEventSchema = createInsertSchema(
  telemetryEventsTable,
).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});
export type InsertTelemetryEvent = z.infer<typeof insertTelemetryEventSchema>;
export type TelemetryEvent = typeof telemetryEventsTable.$inferSelect;
