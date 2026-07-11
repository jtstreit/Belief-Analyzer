import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Guided-exercise definitions — the catalog the Library, exercise runner,
 * and Vera's recommendations draw from. Server-side source of truth;
 * the app's bundled constants remain only as an offline fallback.
 *
 * steps: ordered array of step definitions
 *   { id, title, instruction, type, placeholder?, options?, min?, max?, caution? }
 * type: "text" | "multiline" | "rating" | "suds" | "mood" | "choice" | "info"
 */
export const exercisesTable = pgTable(
  "exercises",
  {
    id: text("id").primaryKey(), // e.g. "rebt-abcde"
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    modality: text("modality").notNull(), // "rebt" | "cbt" | "both"
    category: text("category").notNull(), // "cognitive_restructuring" | "behavioral" | "imagery" | "psychoeducation"
    targetProcesses: jsonb("target_processes").notNull().$type<string[]>(),
    issues: jsonb("issues").notNull().$type<string[]>(),
    evidenceBase: text("evidence_base").notNull(),
    rationale: text("rationale").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    caution: text("caution"),
    icon: text("icon").notNull(),
    steps: jsonb("steps").notNull().$type<
      Array<{
        id: string;
        title: string;
        instruction: string;
        type: string;
        placeholder?: string;
        options?: string[];
        min?: number;
        max?: number;
        caution?: string;
      }>
    >(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("exercises_modality_idx").on(table.modality),
    index("exercises_sort_order_idx").on(table.sortOrder),
  ],
);

export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type ExerciseRow = typeof exercisesTable.$inferSelect;
