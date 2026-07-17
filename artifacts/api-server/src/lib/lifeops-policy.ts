import { createHash } from "node:crypto";
import { z } from "zod/v4";

const LifeOpsSourceSchema = z.string().trim().min(1).max(64);

const NullableString = z.union([z.string(), z.number()]).nullish();

const LifeOpsEventSchema = z
  .object({
    id: NullableString,
    timestamp: NullableString,
    source: LifeOpsSourceSchema,
    title: NullableString,
    content: NullableString,
    capturedAtEpochMillis: z.union([z.number(), z.string()]).nullish(),
    packageName: NullableString,
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const LifeOpsEnvelopeSchema = z.object({
  logs: z.array(z.unknown()),
});

const CLINICAL_CONTENT =
  /\b(?:credible(?:bh)?|cbh3|monarch|nctracks|nc-?topps|medicaid|iihs?|providerconnect|tru\s?care|proauth|patient|client\s+record|treatment\s+plan)\b|\bsign\s+and\s+submit\b|\b(?:svc|service|progress|clinical)\s+note\b/i;

const MAX_SIGNAL_LENGTH = 8_000;

export function isClinicalContent(text: string): boolean {
  return CLINICAL_CONTENT.test(text);
}

export type LifeOpsDropReason =
  "invalid" | "clinical" | "location" | "unsupported" | "no_content";

export interface NormalizedLifeOpsEvent {
  type: string;
  thoughtText: string;
  source: string;
  metadata: { origin: "lifeops"; sourceType: string };
  externalId: string;
  createdAt: Date;
}

export interface LifeOpsPolicyResult {
  accepted: NormalizedLifeOpsEvent[];
  received: number;
  filteredClinical: number;
  filteredLocation: number;
  filteredUnsupported: number;
  filteredNoContent: number;
  filteredInvalid: number;
}

function clean(value: string | number | null | undefined): string {
  return value == null ? "" : String(value).trim();
}

function parseTimestamp(
  capturedAtEpochMillis: string | number | null | undefined,
  timestamp: string | number | null | undefined,
): Date {
  const captured = Number(capturedAtEpochMillis);
  if (Number.isFinite(captured) && captured > 0) {
    const parsed = new Date(captured < 1e12 ? captured * 1000 : captured);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const rawTimestamp = clean(timestamp);
  if (rawTimestamp) {
    const numeric = Number(rawTimestamp);
    const parsed =
      Number.isFinite(numeric) && numeric > 0
        ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
        : new Date(rawTimestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
}

function hashedExternalId(parts: unknown): string {
  return `lifeops::${createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 40)}`;
}

export function normalizeLifeOpsEvent(raw: unknown): {
  event: NormalizedLifeOpsEvent | null;
  reason?: LifeOpsDropReason;
} {
  const parsed = LifeOpsEventSchema.safeParse(raw);
  if (!parsed.success) return { event: null, reason: "invalid" };

  const event = parsed.data;
  if (event.source === "location") return { event: null, reason: "location" };

  const title = clean(event.title);
  const content = clean(event.content);
  const packageName = clean(event.packageName);
  const safetyText = [packageName, title, content].filter(Boolean).join("\n");
  if (isClinicalContent(safetyText)) return { event: null, reason: "clinical" };

  const thoughtText = [title, content]
    .filter(
      (part, index, parts) => Boolean(part) && parts.indexOf(part) === index,
    )
    .join("\n")
    .slice(0, MAX_SIGNAL_LENGTH);
  if (thoughtText.length <= 5) return { event: null, reason: "no_content" };

  const createdAt = parseTimestamp(
    event.capturedAtEpochMillis,
    event.timestamp,
  );
  const upstreamId = clean(event.id);
  const externalId = hashedExternalId(
    upstreamId || [
      event.source,
      packageName,
      createdAt.toISOString(),
      thoughtText,
    ],
  );

  return {
    event: {
      type:
        event.source === "user_note"
          ? "thought_entry"
          : event.source.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      thoughtText,
      source: `lifeops::${packageName || event.source}`,
      metadata: { origin: "lifeops", sourceType: event.source },
      externalId,
      createdAt,
    },
  };
}

export function applyLifeOpsPolicy(payload: unknown): LifeOpsPolicyResult {
  const envelope = LifeOpsEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new Error("LifeOps returned an invalid telemetry envelope");
  }

  const result: LifeOpsPolicyResult = {
    accepted: [],
    received: envelope.data.logs.length,
    filteredClinical: 0,
    filteredLocation: 0,
    filteredUnsupported: 0,
    filteredNoContent: 0,
    filteredInvalid: 0,
  };

  for (const raw of envelope.data.logs) {
    const normalized = normalizeLifeOpsEvent(raw);
    if (normalized.event) {
      result.accepted.push(normalized.event);
      continue;
    }

    switch (normalized.reason) {
      case "clinical":
        result.filteredClinical += 1;
        break;
      case "location":
        result.filteredLocation += 1;
        break;
      case "unsupported":
        result.filteredUnsupported += 1;
        break;
      case "no_content":
        result.filteredNoContent += 1;
        break;
      default:
        result.filteredInvalid += 1;
    }
  }

  return result;
}
