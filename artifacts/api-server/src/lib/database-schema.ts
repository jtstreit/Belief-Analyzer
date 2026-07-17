import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Keep the deployed single-user database compatible with additive telemetry
 * fields before Express starts accepting requests. Existing rows remain null.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  await pool.query(
    "ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS external_id text",
  );
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS telemetry_external_id_idx ON telemetry_events (external_id)",
  );
  logger.info("Database schema ready");
}
