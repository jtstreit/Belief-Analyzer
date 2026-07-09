import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Records a completed or in-progress guided exercise session
export const exerciseSessions = pgTable("exercise_sessions", {
  id: serial("id").primaryKey(),
  exerciseId: text("exercise_id").notNull(),
  modality: text("modality").notNull().default("rebt"), // "rebt" | "cbt"
  stepData: jsonb("step_data"), // { [stepId: string]: string | number }
  moodBefore: integer("mood_before"), // 1-10
  moodAfter: integer("mood_after"), // 1-10
  sudsRating: integer("suds_rating"), // 0-100 for exposure exercises
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertExerciseSessionSchema = createInsertSchema(exerciseSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExerciseSession = z.infer<typeof insertExerciseSessionSchema>;
export type ExerciseSession = typeof exerciseSessions.$inferSelect;
