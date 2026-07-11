/**
 * Idempotent seed of the exercises catalog table from
 * lib/db/src/seed/exercise-catalog.json.
 *
 * Inserts new rows and updates existing ones by id (upsert), so it is safe
 * to re-run after editing the JSON. Rows edited directly in the DB are
 * overwritten only when this script runs — it is never invoked automatically.
 *
 * Usage: DATABASE_URL=... pnpm --filter @workspace/scripts run seed:exercises
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { db, exercisesTable, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, "../../lib/db/src/seed/exercise-catalog.json");

type CatalogExercise = {
  id: string;
  title: string;
  subtitle: string;
  modality: string;
  category: string;
  targetProcesses: string[];
  issues: string[];
  evidenceBase: string;
  rationale: string;
  estimatedMinutes: number;
  caution?: string;
  icon: string;
  steps: Array<Record<string, unknown>>;
};

const catalog: CatalogExercise[] = JSON.parse(readFileSync(catalogPath, "utf-8"));

let upserted = 0;
for (const [i, ex] of catalog.entries()) {
  await db
    .insert(exercisesTable)
    .values({
      id: ex.id,
      title: ex.title,
      subtitle: ex.subtitle,
      modality: ex.modality,
      category: ex.category,
      targetProcesses: ex.targetProcesses,
      issues: ex.issues,
      evidenceBase: ex.evidenceBase,
      rationale: ex.rationale,
      estimatedMinutes: ex.estimatedMinutes,
      caution: ex.caution ?? null,
      icon: ex.icon,
      steps: ex.steps as never,
      sortOrder: i,
    })
    .onConflictDoUpdate({
      target: exercisesTable.id,
      set: {
        title: ex.title,
        subtitle: ex.subtitle,
        modality: ex.modality,
        category: ex.category,
        targetProcesses: ex.targetProcesses,
        issues: ex.issues,
        evidenceBase: ex.evidenceBase,
        rationale: ex.rationale,
        estimatedMinutes: ex.estimatedMinutes,
        caution: ex.caution ?? null,
        icon: ex.icon,
        steps: ex.steps as never,
        sortOrder: i,
        updatedAt: sql`now()`,
      },
    });
  upserted++;
}

console.log(`Seeded ${upserted} exercises into the exercises table.`);
await pool.end();
