import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telemetryEventsTable = pgTable("telemetry_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "mood_checkin" | "thought_entry" | "app_usage" | "activity"
  mood: text("mood"), // "great" | "good" | "neutral" | "bad" | "terrible"
  thoughtText: text("thought_text"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTelemetryEventSchema = createInsertSchema(telemetryEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTelemetryEvent = z.infer<typeof insertTelemetryEventSchema>;
export type TelemetryEvent = typeof telemetryEventsTable.$inferSelect;
