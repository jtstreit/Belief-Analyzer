import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Core schemas inferred from recurring intermediate beliefs — Layer 3
 * (deepest layer) of the Beck cognitive conceptualization.
 *
 * domain: "helpless" | "unlovable" | "worthless" | "other"
 * confidence: 0–100 — rises with each analysis run that reinforces the schema.
 * evidenceCount: count of analysis runs that confirmed this schema.
 */
export const coreSchemasTable = pgTable(
  "core_schemas",
  {
    id: serial("id").primaryKey(),
    schemaText: text("schema_text").notNull(),
    domain: text("domain").notNull().default("other"), // "helpless" | "unlovable" | "worthless" | "other"
    confidence: integer("confidence").notNull().default(15), // 0–100
    evidenceCount: integer("evidence_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("core_schema_domain_idx").on(table.domain),
    index("core_schema_confidence_idx").on(table.confidence),
  ],
);

export const insertCoreSchemaSchema = createInsertSchema(coreSchemasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCoreSchema = z.infer<typeof insertCoreSchemaSchema>;
export type CoreSchema = typeof coreSchemasTable.$inferSelect;
