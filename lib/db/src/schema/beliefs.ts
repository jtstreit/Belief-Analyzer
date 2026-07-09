import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// REBT belief types
// catastrophizing: treating events as catastrophic or unbearable
// awfulizing: rating things as more than 100% bad
// low_frustration_tolerance: believing you cannot tolerate discomfort
// global_rating: rating entire self/others from a single event
// should_statements: rigid musts, shoulds, have-tos
export const beliefsTable = pgTable("beliefs", {
  id: serial("id").primaryKey(),
  beliefText: text("belief_text").notNull(),
  beliefType: text("belief_type").notNull(), // "catastrophizing" | "awfulizing" | "low_frustration_tolerance" | "global_rating" | "should_statements" | "other"
  triggerSituation: text("trigger_situation"),
  emotionalConsequence: text("emotional_consequence"),
  status: text("status").notNull().default("active"), // "active" | "challenged" | "resolved"
  conversationId: integer("conversation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBeliefSchema = createInsertSchema(beliefsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBelief = z.infer<typeof insertBeliefSchema>;
export type Belief = typeof beliefsTable.$inferSelect;
