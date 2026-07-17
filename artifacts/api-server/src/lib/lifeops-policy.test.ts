import { describe, expect, it } from "vitest";
import { applyLifeOpsPolicy, normalizeLifeOpsEvent } from "./lifeops-policy";

const baseEvent = {
  id: "evt-100",
  timestamp: "2026-07-17T12:00:00.000Z",
  source: "screen_text",
  title: "Messages",
  content:
    "I keep thinking that if I make one mistake, everything will fall apart.",
  capturedAtEpochMillis: 1784299200000,
  packageName: "com.example.messages",
  metadata: { rawWindowTree: "must never be retained" },
};

describe("LifeOps PHI policy", () => {
  it("accepts nonclinical screen text using the actual LifeOps field shape", () => {
    const result = applyLifeOpsPolicy({ logs: [baseEvent] });

    expect(result.received).toBe(1);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({
      type: "screen_text",
      thoughtText: `${baseEvent.title}\n${baseEvent.content}`,
      source: "lifeops::com.example.messages",
      metadata: { origin: "lifeops", sourceType: "screen_text" },
    });
    expect(JSON.stringify(result.accepted[0])).not.toContain("rawWindowTree");
  });

  it("drops clinical screen content before it can be stored", () => {
    const result = applyLifeOpsPolicy({
      logs: [
        {
          ...baseEvent,
          packageName: "com.android.chrome",
          content: "Credible client service note sign and submit",
        },
      ],
    });

    expect(result.accepted).toHaveLength(0);
    expect(result.filteredClinical).toBe(1);
  });

  it("accepts app usage context while still dropping location", () => {
    const result = applyLifeOpsPolicy({
      logs: [
        { ...baseEvent, id: "location", source: "location" },
        {
          ...baseEvent,
          id: "usage",
          source: "app_usage",
          title: "App usage: YouTube",
          content: "20 minutes foreground",
          packageName: "com.google.android.youtube",
        },
      ],
    });

    expect(result.accepted).toHaveLength(1);
    expect(result.filteredLocation).toBe(1);
    expect(result.accepted[0]).toMatchObject({
      type: "app_usage",
      thoughtText: "App usage: YouTube\n20 minutes foreground",
    });
  });

  it("accepts future LifeOps source types instead of silently narrowing the feed", () => {
    const result = applyLifeOpsPolicy({
      logs: [{ ...baseEvent, source: "accessibility_text" }],
    });

    expect(result.accepted[0]?.type).toBe("accessibility_text");
    expect(result.filteredUnsupported).toBe(0);
  });

  it("builds a deterministic hashed deduplication id", () => {
    const first = normalizeLifeOpsEvent(baseEvent).event;
    const second = normalizeLifeOpsEvent({ ...baseEvent }).event;

    expect(first?.externalId).toBe(second?.externalId);
    expect(first?.externalId).toMatch(/^lifeops::[a-f0-9]{40}$/);
    expect(first?.externalId).not.toContain(baseEvent.id);
  });

  it("rejects unexpected upstream envelopes", () => {
    expect(() => applyLifeOpsPolicy({ events: [baseEvent] })).toThrow(
      "invalid telemetry envelope",
    );
  });
});
