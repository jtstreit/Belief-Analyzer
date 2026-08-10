import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { telemetryEventsTable } from "./telemetry_events";

/**
 * Automatic thoughts extracted from telemetry events — Layer 1 of the
 * Beck cognitive conceptualization.
 *
 * distortionTags: subset of Burns' ten cognitive distortions:
 *   all_or_nothing | overgeneralization | mental_filter | discounting_positive |
 *   mind_reading | fortune_telling | magnification | minimization |
 *   emotional_reasoning | should_statements | labeling | personalization
 *
 * telemetryEventId has a FK to telemetry_events with ON DELETE SET NULL so
 * deleting a source event leaves the extracted thought intact but unlinked.
 */
export const automaticThoughtsTable = pgTable(
  "automatic_thoughts",
  {
    id: serial("id").primaryKey(),
    situation: text("situation"),
    thoughtText: text("thought_text").notNull(),
    emotion: text("emotion"),
    intensityPct: integer("intensity_pct"), // 0–100
    distortionTags: jsonb("distortion_tags")
      .$type<string[]>()
      .notNull()
      .default([]),
    telemetryEventId: integer("telemetry_event_id"),
    reviewStatus: text("review_status")
      .$type<"unreviewed" | "endorsed" | "rejected" | "irrelevant">()
      .notNull()
      .default("unreviewed"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auto_thought_created_idx").on(table.createdAt),
    index("auto_thought_telemetry_idx").on(table.telemetryEventId),
    foreignKey({
      columns: [table.telemetryEventId],
      foreignColumns: [telemetryEventsTable.id],
      name: "auto_thought_telemetry_fk",
    }).onDelete("set null"),
  ],
);

export const insertAutomaticThoughtSchema = createInsertSchema(
  automaticThoughtsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertAutomaticThought = z.infer<
  typeof insertAutomaticThoughtSchema
>;
export type AutomaticThought = typeof automaticThoughtsTable.$inferSelect;
