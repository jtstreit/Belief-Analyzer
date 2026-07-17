import { db, telemetryEventsTable } from "@workspace/db";
import { applyLifeOpsPolicy } from "./lifeops-policy";
import { logger } from "./logger";

const DEFAULT_URL = "https://sentinel-lifeops-api.onrender.com/api/telemetry";

export interface LifeOpsSyncResult {
  received: number;
  eligible: number;
  ingested: number;
  skippedDuplicates: number;
  filteredClinical: number;
  filteredLocation: number;
  filteredUnsupported: number;
  filteredNoContent: number;
  filteredInvalid: number;
  syncedAt: string;
}

let lastSyncAt: string | null = null;
let lastSyncCount = 0;
let lastSyncError: string | null = null;
let activeSync: Promise<LifeOpsSyncResult> | null = null;

function getUpstreamUrl(): string {
  return process.env["LIFEOPS_TELEMETRY_URL"] ?? DEFAULT_URL;
}

function getToken(): string | undefined {
  return process.env["SENTINEL_INGEST_TOKEN"]?.trim() || undefined;
}

async function runSync(): Promise<LifeOpsSyncResult> {
  const token = getToken();
  if (!token) throw new Error("LifeOps sync is not configured");

  const response = await fetch(getUpstreamUrl(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "BeliefAnalyzer-LifeOps/2.0",
      "X-Sentinel-Ingest-Token": token,
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`LifeOps sync failed with HTTP ${response.status}`);
  }

  const policy = applyLifeOpsPolicy(await response.json());
  const inserted =
    policy.accepted.length === 0
      ? []
      : await db
          .insert(telemetryEventsTable)
          .values(
            policy.accepted.map((event) => ({
              type: event.type,
              thoughtText: event.thoughtText,
              source: event.source,
              metadata: event.metadata,
              externalId: event.externalId,
              createdAt: event.createdAt,
            })),
          )
          .onConflictDoNothing({ target: telemetryEventsTable.externalId })
          .returning({ id: telemetryEventsTable.id });

  const syncedAt = new Date().toISOString();
  lastSyncAt = syncedAt;
  lastSyncCount = inserted.length;
  lastSyncError = null;

  const result: LifeOpsSyncResult = {
    received: policy.received,
    eligible: policy.accepted.length,
    ingested: inserted.length,
    skippedDuplicates: policy.accepted.length - inserted.length,
    filteredClinical: policy.filteredClinical,
    filteredLocation: policy.filteredLocation,
    filteredUnsupported: policy.filteredUnsupported,
    filteredNoContent: policy.filteredNoContent,
    filteredInvalid: policy.filteredInvalid,
    syncedAt,
  };
  logger.info(
    {
      received: result.received,
      eligible: result.eligible,
      ingested: result.ingested,
      filteredClinical: result.filteredClinical,
    },
    "LifeOps sync complete",
  );
  return result;
}

export async function syncLifeOps(): Promise<LifeOpsSyncResult> {
  if (activeSync) return activeSync;
  activeSync = runSync()
    .catch((error: unknown) => {
      lastSyncError =
        error instanceof Error ? error.message : "LifeOps sync failed";
      logger.error({ error: lastSyncError }, "LifeOps sync failed");
      throw error;
    })
    .finally(() => {
      activeSync = null;
    });
  return activeSync;
}

export function getLifeOpsStatus() {
  return {
    configured: Boolean(getToken()),
    source: "LifeOps Sentinel",
    model: "claude-opus-4-8",
    clinicalFilterEnabled: true,
    lastSyncAt,
    lastSyncCount,
    lastSyncError,
  };
}
