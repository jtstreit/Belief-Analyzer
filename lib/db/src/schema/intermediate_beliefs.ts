import { pgTable, serial, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Intermediate beliefs (rules, assumptions, attitudes) synthesized from
 * recurring automatic thoughts — Layer 2 of the Beck cognitive
 * conceptualization.
 *
 * category: "rule" | "assumption" | "attitude"
 * confidence: 0–100 — rises as more evidence accumulates across sessions.
 * evidenceCount: count of analysis runs that confirmed this belief.
 *
 * Named `intermediate_beliefs_cog` to avoid collision with the existing
 * `beliefs` table which stores REBT irrational beliefs.
 */
export const intermediateBeliefsCogTable = pgTable(
  "intermediate_beliefs_cog",
  {
    id: serial("id").primaryKey(),
    beliefText: text("belief_text").notNull(),
    category: text("category").notNull().default("rule"), // "rule" | "assumption" | "attitude"
    confidence: integer("confidence").notNull().default(20), // 0–100
    evidenceCount: integer("evidence_count").notNull().default(1),
    // "active" | "dismissed" — dismissed rows are kept (not deleted) so
    // re-analysis cannot resurrect a pruned or manually dismissed belief.
    status: text("status").notNull().default("active"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("int_belief_text_unique_idx").on(table.beliefText),
    index("int_belief_confidence_idx").on(table.confidence),
  ],
);

export const insertIntermediateBeliefSchema = createInsertSchema(intermediateBeliefsCogTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntermediateBelief = z.infer<typeof insertIntermediateBeliefSchema>;
export type IntermediateBelief = typeof intermediateBeliefsCogTable.$inferSelect;
