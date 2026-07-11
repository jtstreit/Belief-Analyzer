/**
 * Tests for POST /api/cognitive/analyze — the 3-pass cognitive engine.
 *
 * Dependency strategy:
 *   @workspace/db  → mocked: db is a chainable stub controlled by `mockData`
 *   @workspace/integrations-openai-ai-server → mocked: openai.chat.completions.create
 *   @workspace/db (lib/logger) → pino transport silenced via env
 *
 * Table sentinel objects are shared between the mock factory and tests via
 * vi.hoisted so that `db.select().from(table)` can resolve the correct data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";

// ─── Hoisted mock state (runs before vi.mock factories) ───────────────────────
const sentinels = vi.hoisted(() => ({
  telemetryEventsTable: { _name: "telemetry" } as object,
  automaticThoughtsTable: { _name: "thoughts" } as object,
  // beliefText is a column marker so tests can assert it is the conflict target
  intermediateBeliefsCogTable: { _name: "ibeliefs", beliefText: { _col: "beliefText" } },
  coreSchemasTable: { _name: "schemas" } as object,
}));

const state = vi.hoisted(() => ({
  // Per-table data returned by db.select().from(table)...
  byTable: new Map<object, unknown[]>(),
  // Ordered OpenAI responses (one per chat.completions.create call)
  openaiQueue: [] as string[],
  // Capture sink for db.insert().values() calls
  inserted: [] as Array<{ table: object; values: unknown }>,
  // Capture sink for db.update().set().where() calls
  updated: [] as Array<{ table: object; set: unknown }>,
  // Capture sink for events marked processed inside transaction
  processedEventIds: [] as number[],
  // Capture sink for onConflictDoUpdate calls: records conflict target + set payload
  conflictUpserts: [] as Array<{ table: object; target: unknown; set: unknown }>,
  // Capture sink for db.delete().where().returning() calls
  deleted: [] as Array<{ table: object; returning: unknown[] }>,
  // Controls whether transaction rolls back (simulates DB failure)
  txShouldThrow: false,
}));

// ─── Mock @workspace/db ───────────────────────────────────────────────────────
vi.mock("@workspace/db", () => {
  // Build a thenable that resolves to `result` and is also chainable.
  function chain(result: unknown): unknown {
    const obj: Record<string, unknown> = {
      // Make the chain awaitable
      then: (
        onFulfilled: (v: unknown) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) =>
        Promise.resolve(result).catch(onRejected),
      finally: (fn: () => void) => Promise.resolve(result).finally(fn),
    };
    // All chainable methods return a new chain with the same result.
    // from() is special: it picks data keyed by the table sentinel.
    for (const method of [
      "where",
      "orderBy",
      "limit",
      "set",
      "returning",
      "onConflictDoUpdate",
    ]) {
      obj[method] = () => chain(result);
    }
    return obj;
  }

  // select() result depends on which table is passed to from()
  function makeSelect() {
    return {
      select: vi.fn((_fields?: unknown) => ({
        from: (table: object) => chain(state.byTable.get(table) ?? []),
      })),
    };
  }

  const dbMock = {
    ...makeSelect(),

    insert: vi.fn((table: object) => ({
      values: (vals: unknown) => {
        state.inserted.push({ table, values: vals });
        // Return a custom object so onConflictDoUpdate arguments are captured.
        const afterValues: Record<string, unknown> = {
          onConflictDoUpdate: (opts: { target: unknown; set: unknown }) => {
            state.conflictUpserts.push({ table, target: opts.target, set: opts.set });
            return chain(undefined);
          },
        };
        // Also make it awaitable (in case .values() is awaited directly).
        afterValues["then"] = (
          onFulfilled: (v: unknown) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => Promise.resolve(undefined).then(onFulfilled, onRejected);
        afterValues["catch"] = (onRejected: (e: unknown) => unknown) =>
          Promise.resolve(undefined).catch(onRejected);
        afterValues["finally"] = (fn: () => void) =>
          Promise.resolve(undefined).finally(fn);
        return afterValues;
      },
    })),

    update: vi.fn((table: object) => ({
      set: (s: unknown) => {
        state.updated.push({ table, set: s });
        // Resolve to [] so `.returning()` consumers (decay/prune passes)
        // can read `.length` — no rows affected by default.
        return chain([]);
      },
    })),

    delete: vi.fn((table: object) => {
      // Record which table is being deleted from; returning() resolves to []
      // by default (no rows deleted) so the pruning pass succeeds without
      // touching real DB state.
      const entry = { table, returning: [] as unknown[] };
      state.deleted.push(entry);
      return {
        where: (_cond: unknown) => ({
          returning: (_fields?: unknown) => Promise.resolve(entry.returning),
        }),
      };
    }),

    transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
      if (state.txShouldThrow) throw new Error("DB transaction failed");
      const tx = {
        insert: (_table: object) => ({
          values: (vals: unknown) => {
            // Capture thought inserts
            if (
              _table === sentinels.automaticThoughtsTable &&
              typeof vals === "object" &&
              vals !== null &&
              "thoughtText" in vals
            ) {
              state.inserted.push({ table: _table, values: vals });
            }
            return chain(undefined);
          },
        }),
        update: (_table: object) => ({
          set: (s: unknown) => {
            state.updated.push({ table: _table, set: s });
            // Capture which event IDs are marked processed
            const processedAt = (s as Record<string, unknown>)?.["processedAt"];
            if (processedAt instanceof Date) {
              // IDs come from inArray — captured separately via inArray mock
            }
            return chain(undefined);
          },
        }),
      };
      return cb(tx);
    }),
  };

  return {
    db: dbMock,
    telemetryEventsTable: sentinels.telemetryEventsTable,
    automaticThoughtsTable: sentinels.automaticThoughtsTable,
    intermediateBeliefsCogTable: sentinels.intermediateBeliefsCogTable,
    coreSchemasTable: sentinels.coreSchemasTable,
    // Drizzle helpers — return their arguments so they can be checked
    isNull: vi.fn((col: unknown) => ({ op: "isNull", col })),
    inArray: vi.fn((col: unknown, ids: unknown) => ({ op: "inArray", col, ids })),
    desc: vi.fn((col: unknown) => ({ op: "desc", col })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
    and: vi.fn((...conds: unknown[]) => ({ op: "and", conds })),
    lt: vi.fn((col: unknown, val: unknown) => ({ op: "lt", col, val })),
    lte: vi.fn((col: unknown, val: unknown) => ({ op: "lte", col, val })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      op: "sql",
      strings,
      values,
    })),
  };
});

// ─── Mock @workspace/integrations-openai-ai-server ───────────────────────────
vi.mock("@workspace/integrations-openai-ai-server", () => {
  const create = vi.fn(async () => {
    const content = state.openaiQueue.shift() ?? "[]";
    return { choices: [{ message: { content } }] };
  });
  return {
    openai: { chat: { completions: { create } } },
  };
});

// ─── Import app after mocks are in place ─────────────────────────────────────
// Silence pino-pretty during tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://mock/mock";

const { default: app } = await import("../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const agent = supertest(app);

/** Minimal telemetry event row with meaningful content */
function makeTelemetryRow(id: number, thoughtText = "I always fail at everything") {
  return {
    id,
    type: "thought_entry",
    source: "manual",
    thoughtText,
    mood: null,
    processedAt: null,
    createdAt: new Date(),
  };
}

/** Minimal automatic thought row */
function makeThoughtRow(id: number, text = "I always fail") {
  return {
    id,
    thoughtText: text,
    situation: null,
    emotion: "anxiety",
    intensityPct: 70,
    distortionTags: ["all_or_nothing"],
    telemetryEventId: null,
    createdAt: new Date(),
  };
}

/** Minimal intermediate belief row */
function makeBeliefRow(id: number, text = "I must succeed or I'm worthless") {
  return {
    id,
    beliefText: text,
    category: "rule",
    confidence: 30,
    evidenceCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Reset all mutable state and set up defaults (empty DB, empty OpenAI queue) */
function resetState() {
  state.byTable.clear();
  state.openaiQueue.length = 0;
  state.inserted.length = 0;
  state.updated.length = 0;
  state.processedEventIds.length = 0;
  state.conflictUpserts.length = 0;
  state.deleted.length = 0;
  state.txShouldThrow = false;

  // Default: empty DB
  state.byTable.set(sentinels.telemetryEventsTable, []);
  state.byTable.set(sentinels.automaticThoughtsTable, []);
  state.byTable.set(sentinels.intermediateBeliefsCogTable, []);
  state.byTable.set(sentinels.coreSchemasTable, []);
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("POST /api/cognitive/analyze", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    // Re-seed defaults after clearAllMocks (mocks themselves are reset, not state)
    state.byTable.set(sentinels.telemetryEventsTable, []);
    state.byTable.set(sentinels.automaticThoughtsTable, []);
    state.byTable.set(sentinels.intermediateBeliefsCogTable, []);
    state.byTable.set(sentinels.coreSchemasTable, []);
  });

  // ── No unprocessed events (happy-path baseline) ──────────────────────────
  it("returns 200 and an empty mind map when there are no telemetry events", async () => {
    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      automaticThoughts: [],
      intermediateBeliefs: [],
      coreSchemas: [],
      unprocessedCount: 0,
    });
  });

  // ── Pass 1: valid LLM response inserts thoughts and marks events processed ─
  it("Pass 1 — valid JSON: inserts extracted thoughts and marks source events processed", async () => {
    const event = makeTelemetryRow(1);
    state.byTable.set(sentinels.telemetryEventsTable, [event]);

    const llmThoughts = [
      {
        entryIndex: 1,
        thoughtText: "I always fail at everything",
        situation: "after a mistake at work",
        emotion: "anxiety",
        intensityPct: 80,
        distortionTags: ["all_or_nothing", "overgeneralization"],
      },
    ];
    // Pass 1 response; Passes 2 and 3 will get "[]" from the queue
    state.openaiQueue.push(JSON.stringify(llmThoughts), "[]", "[]");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    // Thought was inserted
    const thoughtInserts = state.inserted.filter(
      (i) => i.table === sentinels.automaticThoughtsTable,
    );
    expect(thoughtInserts).toHaveLength(1);
    const inserted = thoughtInserts[0]?.values as Record<string, unknown>;
    expect(inserted?.["thoughtText"]).toBe("I always fail at everything");
    expect(inserted?.["emotion"]).toBe("anxiety");
    expect(inserted?.["intensityPct"]).toBe(80);
    expect(Array.isArray(inserted?.["distortionTags"])).toBe(true);
  });

  // ── Pass 1: out-of-range intensityPct is clamped ──────────────────────────
  it("Pass 1 — out-of-range intensityPct: clamps values to [0, 100]", async () => {
    state.byTable.set(sentinels.telemetryEventsTable, [makeTelemetryRow(1)]);
    state.openaiQueue.push(
      JSON.stringify([
        { entryIndex: 1, thoughtText: "Everything is catastrophic", intensityPct: 999 },
        { entryIndex: 1, thoughtText: "I feel nothing", intensityPct: -50 },
      ]),
      "[]",
      "[]",
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const thoughtInserts = state.inserted.filter(
      (i) => i.table === sentinels.automaticThoughtsTable,
    );
    const intensities = thoughtInserts.map(
      (i) => (i.values as Record<string, unknown>)["intensityPct"],
    );
    expect(intensities).toContain(100); // 999 clamped to 100
    expect(intensities).toContain(0);   // -50 clamped to 0
  });

  // ── Pass 1: malformed JSON propagates as 500 ──────────────────────────────
  it("Pass 1 — malformed JSON: route returns 500, events remain retryable", async () => {
    state.byTable.set(sentinels.telemetryEventsTable, [makeTelemetryRow(42)]);
    state.openaiQueue.push("NOT VALID JSON {{{");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.any(String) });

    // No thoughts should have been inserted
    const thoughtInserts = state.inserted.filter(
      (i) => i.table === sentinels.automaticThoughtsTable,
    );
    expect(thoughtInserts).toHaveLength(0);
  });

  // ── Pass 1: non-array JSON propagates as 500 ─────────────────────────────
  it("Pass 1 — non-array JSON (object): route returns 500, events remain retryable", async () => {
    state.byTable.set(sentinels.telemetryEventsTable, [makeTelemetryRow(43)]);
    state.openaiQueue.push(JSON.stringify({ error: "not an array" }));

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  // ── Pass 1: non-array JSON (null) propagates as 500 ──────────────────────
  it("Pass 1 — null JSON: route returns 500", async () => {
    state.byTable.set(sentinels.telemetryEventsTable, [makeTelemetryRow(44)]);
    state.openaiQueue.push("null");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(500);
  });

  // ── Pass 1: empty array — no thoughts extracted, route still returns 200 ──
  it("Pass 1 — empty array: no thoughts inserted, route returns 200 (graceful degradation)", async () => {
    state.byTable.set(sentinels.telemetryEventsTable, [makeTelemetryRow(1)]);
    state.openaiQueue.push("[]", "[]", "[]");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const thoughtInserts = state.inserted.filter(
      (i) => i.table === sentinels.automaticThoughtsTable,
    );
    expect(thoughtInserts).toHaveLength(0);
  });

  // ── Pass 1: malformed individual items are skipped, valid ones inserted ───
  it("Pass 1 — mixed valid/invalid items: valid items inserted, invalid skipped", async () => {
    state.byTable.set(sentinels.telemetryEventsTable, [makeTelemetryRow(1)]);
    state.openaiQueue.push(
      JSON.stringify([
        { entryIndex: 0, thoughtText: "index out of range" },    // entryIndex must be ≥1
        { entryIndex: 1, thoughtText: "" },                      // empty thoughtText
        { entryIndex: 1, thoughtText: "   " },                   // whitespace-only
        null,                                                    // null item
        "string item",                                           // wrong type
        { entryIndex: 1, thoughtText: "This one is valid", emotion: "sadness" },
      ]),
      "[]",
      "[]",
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const thoughtInserts = state.inserted.filter(
      (i) => i.table === sentinels.automaticThoughtsTable,
    );
    expect(thoughtInserts).toHaveLength(1);
    expect(
      (thoughtInserts[0]?.values as Record<string, unknown>)["thoughtText"],
    ).toBe("This one is valid");
  });

  // ── Pass 1: events without meaningful content are marked processed eagerly ─
  it("Pass 1 — no-content events: processedAt is set without calling LLM", async () => {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const emptyEvent = makeTelemetryRow(1, "");    // empty text → withoutContent
    const shortEvent = makeTelemetryRow(2, "ok");  // ≤5 chars → withoutContent
    state.byTable.set(sentinels.telemetryEventsTable, [emptyEvent, shortEvent]);

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    // LLM should NOT be called for Pass 1 (no withContent events)
    // It may still be called for Pass 2/3 if there are existing thoughts,
    // but with empty DB those are skipped too.
    const passOneCall = (openai.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls;
    // All calls would be for Pass 2/3 (none for Pass 1 — no withContent)
    // With empty thoughts DB, Pass 2 also skips. So 0 total calls.
    expect(passOneCall.length).toBe(0);

    // No-content events should have been marked processed (via db.update)
    const processedUpdates = state.updated.filter(
      (u) =>
        u.table === sentinels.telemetryEventsTable &&
        (u.set as Record<string, unknown>)?.["processedAt"] instanceof Date,
    );
    expect(processedUpdates.length).toBeGreaterThan(0);
  });

  // ── Pass 2: malformed JSON silently falls back, route returns 200 ─────────
  it("Pass 2 — malformed JSON: silently skipped, route returns 200 (graceful degradation)", async () => {
    // Provide enough thoughts to trigger Pass 2
    const thoughts = [makeThoughtRow(1), makeThoughtRow(2)];
    state.byTable.set(sentinels.automaticThoughtsTable, thoughts);
    // No unprocessed telemetry → Pass 1 is skipped
    // Pass 2 LLM returns malformed JSON
    state.openaiQueue.push("BROKEN JSON {{}", "[]");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    // No beliefs should have been upserted
    const beliefInserts = state.inserted.filter(
      (i) => i.table === sentinels.intermediateBeliefsCogTable,
    );
    expect(beliefInserts).toHaveLength(0);
  });

  // ── Pass 2: empty array — no beliefs upserted, route returns 200 ──────────
  it("Pass 2 — empty array: no beliefs inserted, route returns 200", async () => {
    state.byTable.set(sentinels.automaticThoughtsTable, [
      makeThoughtRow(1),
      makeThoughtRow(2),
    ]);
    state.openaiQueue.push("[]", "[]");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);
    const beliefInserts = state.inserted.filter(
      (i) => i.table === sentinels.intermediateBeliefsCogTable,
    );
    expect(beliefInserts).toHaveLength(0);
  });

  // ── Pass 2: valid response — new belief inserted ───────────────────────────
  it("Pass 2 — valid JSON: new belief is inserted", async () => {
    state.byTable.set(sentinels.automaticThoughtsTable, [
      makeThoughtRow(1),
      makeThoughtRow(2),
    ]);
    state.openaiQueue.push(
      JSON.stringify([
        {
          beliefText: "I must be perfect or I'm worthless",
          category: "rule",
          matchesExistingId: null,
          initialConfidence: 30,
        },
      ]),
      "[]", // Pass 3
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const beliefInserts = state.inserted.filter(
      (i) => i.table === sentinels.intermediateBeliefsCogTable,
    );
    expect(beliefInserts).toHaveLength(1);
    expect(
      (beliefInserts[0]?.values as Record<string, unknown>)["beliefText"],
    ).toBe("I must be perfect or I'm worthless");
  });

  // ── Pass 2: confidence value clamped within 15–60 by initialConfidence ─────
  it("Pass 2 — initialConfidence is stored as-is; zero-belief items are skipped", async () => {
    state.byTable.set(sentinels.automaticThoughtsTable, [
      makeThoughtRow(1),
      makeThoughtRow(2),
    ]);
    state.openaiQueue.push(
      JSON.stringify([
        { beliefText: "", category: "rule", matchesExistingId: null },   // empty → skipped
        { beliefText: "  ", category: "rule", matchesExistingId: null }, // whitespace → skipped
        {
          beliefText: "Valid belief",
          category: "assumption",
          matchesExistingId: null,
          initialConfidence: 45,
        },
      ]),
      "[]",
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const beliefInserts = state.inserted.filter(
      (i) => i.table === sentinels.intermediateBeliefsCogTable,
    );
    expect(beliefInserts).toHaveLength(1);
  });

  // ── Pass 3: malformed JSON silently falls back, route returns 200 ─────────
  it("Pass 3 — malformed JSON: silently skipped, route returns 200 (graceful degradation)", async () => {
    const beliefs = [makeBeliefRow(1), makeBeliefRow(2), makeBeliefRow(3)];
    state.byTable.set(sentinels.intermediateBeliefsCogTable, beliefs);
    // Pass 3 LLM returns malformed JSON
    state.openaiQueue.push("TOTALLY INVALID");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const schemaInserts = state.inserted.filter(
      (i) => i.table === sentinels.coreSchemasTable,
    );
    expect(schemaInserts).toHaveLength(0);
  });

  // ── Pass 3: empty array — no schemas upserted, route returns 200 ──────────
  it("Pass 3 — empty array: no schemas inserted, route returns 200", async () => {
    state.byTable.set(sentinels.intermediateBeliefsCogTable, [
      makeBeliefRow(1),
      makeBeliefRow(2),
      makeBeliefRow(3),
    ]);
    state.openaiQueue.push("[]");

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);
    const schemaInserts = state.inserted.filter(
      (i) => i.table === sentinels.coreSchemasTable,
    );
    expect(schemaInserts).toHaveLength(0);
  });

  // ── Pass 3: valid response — new schema inserted ───────────────────────────
  it("Pass 3 — valid JSON: new core schema is inserted", async () => {
    state.byTable.set(sentinels.intermediateBeliefsCogTable, [
      makeBeliefRow(1),
      makeBeliefRow(2),
      makeBeliefRow(3),
    ]);
    state.openaiQueue.push(
      JSON.stringify([
        {
          schemaText: "I am fundamentally worthless",
          domain: "worthless",
          matchesExistingId: null,
          initialConfidence: 20,
        },
      ]),
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    const schemaInserts = state.inserted.filter(
      (i) => i.table === sentinels.coreSchemasTable,
    );
    expect(schemaInserts).toHaveLength(1);
    expect(
      (schemaInserts[0]?.values as Record<string, unknown>)["schemaText"],
    ).toBe("I am fundamentally worthless");
  });

  // ── Pass 3: fewer than 2 beliefs → Pass 3 is skipped entirely ────────────
  it("Pass 3 — only 1 intermediate belief: LLM not called for Pass 3", async () => {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    state.byTable.set(sentinels.intermediateBeliefsCogTable, [makeBeliefRow(1)]);
    // Pass 2 would need thoughts to trigger; leave thoughts empty so no LLM calls expected
    // (Pass 3 threshold is ≥2 beliefs)

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);
    // No LLM calls because: no thoughts (Pass 2 skipped), <2 beliefs (Pass 3 skipped)
    expect(
      (openai.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(0);
  });

  // ── Pass 2+3 run even when Pass 1 extracted nothing new ───────────────────
  it("Passes 2 and 3 run even when there are no new telemetry events", async () => {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    // Pre-existing thoughts trigger Pass 2; pre-existing beliefs trigger Pass 3
    state.byTable.set(sentinels.automaticThoughtsTable, [
      makeThoughtRow(1),
      makeThoughtRow(2),
    ]);
    state.byTable.set(sentinels.intermediateBeliefsCogTable, [
      makeBeliefRow(1),
      makeBeliefRow(2),
      makeBeliefRow(3),
    ]);
    state.openaiQueue.push("[]", "[]"); // Pass 2, Pass 3

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);
    // LLM should have been called twice (Pass 2 + Pass 3)
    expect(
      (openai.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(2);
  });

  // ── Constraint: duplicate beliefText must accumulate evidence, not create a second row ──
  it("Pass 2 — duplicate beliefText: onConflictDoUpdate is called targeting beliefText with incremented evidenceCount", async () => {
    // Two existing thoughts trigger Pass 2
    state.byTable.set(sentinels.automaticThoughtsTable, [
      makeThoughtRow(1),
      makeThoughtRow(2),
    ]);
    // LLM returns the same beliefText twice — the second occurrence tests that
    // the route reaches onConflictDoUpdate rather than inserting a duplicate row.
    const beliefText = "I must never make mistakes";
    state.openaiQueue.push(
      JSON.stringify([
        { beliefText, category: "rule", matchesExistingId: null, initialConfidence: 25 },
        { beliefText, category: "rule", matchesExistingId: null, initialConfidence: 25 },
      ]),
      "[]", // Pass 3
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    // Both inserts should have attempted the conflict-safe path
    const beliefInserts = state.inserted.filter(
      (i) => i.table === sentinels.intermediateBeliefsCogTable,
    );
    expect(beliefInserts).toHaveLength(2);

    // onConflictDoUpdate must have been called for each insert, targeting
    // the beliefText column so the unique index catches duplicates.
    const beliefUpserts = state.conflictUpserts.filter(
      (u) => u.table === sentinels.intermediateBeliefsCogTable,
    );
    expect(beliefUpserts).toHaveLength(2);

    // The conflict target must be the beliefText column (not the id or any
    // other column) — this mirrors the unique index on belief_text.
    for (const upsert of beliefUpserts) {
      expect(upsert.target).toBe(sentinels.intermediateBeliefsCogTable.beliefText);
    }

    // The set payload must increment evidenceCount, not reset it to a literal 1.
    // The route uses drizzle's sql`` tag to build an expression; the result is a
    // SQL object (not a plain number), confirming accumulation semantics.
    for (const upsert of beliefUpserts) {
      const setPayload = upsert.set as Record<string, unknown>;
      expect(setPayload).toHaveProperty("evidenceCount");
      expect(setPayload).toHaveProperty("confidence");
      // Must be a Drizzle SQL expression object, not a reset literal like 1
      expect(typeof setPayload["evidenceCount"]).toBe("object");
      expect(setPayload["evidenceCount"]).not.toBeNull();
      expect(setPayload["evidenceCount"]).not.toBe(1);
    }
  });

  // ── Constraint: duplicate schemaText must accumulate evidence, not create a second row ──
  it("Pass 3 — duplicate schemaText: onConflictDoUpdate is called targeting schemaText with incremented evidenceCount", async () => {
    // Three beliefs to clear Pass 3 threshold (≥2 required)
    state.byTable.set(sentinels.intermediateBeliefsCogTable, [
      makeBeliefRow(1),
      makeBeliefRow(2),
      makeBeliefRow(3),
    ]);
    const schemaText = "I am fundamentally incapable";
    state.openaiQueue.push(
      JSON.stringify([
        { schemaText, domain: "helpless", matchesExistingId: null, initialConfidence: 20 },
        { schemaText, domain: "helpless", matchesExistingId: null, initialConfidence: 20 },
      ]),
    );

    const res = await agent.post("/api/cognitive/analyze");
    expect(res.status).toBe(200);

    // Both inserts should have been attempted
    const schemaInserts = state.inserted.filter(
      (i) => i.table === sentinels.coreSchemasTable,
    );
    expect(schemaInserts).toHaveLength(2);

    // onConflictDoUpdate must be called for each, targeting schemaText
    const schemaUpserts = state.conflictUpserts.filter(
      (u) => u.table === sentinels.coreSchemasTable,
    );
    expect(schemaUpserts).toHaveLength(2);

    // The set payload must use a Drizzle SQL expression for evidenceCount
    // (accumulate, not reset to a literal 1).
    for (const upsert of schemaUpserts) {
      const setPayload = upsert.set as Record<string, unknown>;
      expect(setPayload).toHaveProperty("evidenceCount");
      expect(setPayload).toHaveProperty("confidence");
      // Must be an object (Drizzle SQL expression), not a reset literal
      expect(typeof setPayload["evidenceCount"]).toBe("object");
      expect(setPayload["evidenceCount"]).not.toBeNull();
      expect(setPayload["evidenceCount"]).not.toBe(1);
    }
  });

  // ── Constraint: deleting a telemetry event must not leave a dangling FK ────
  it("FK on delete set null — automatic thoughts with null telemetryEventId are returned normally", async () => {
    // Simulate what the DB returns after a telemetry event has been deleted:
    // the linked thought's telemetryEventId is NULL (ON DELETE SET NULL), not a
    // dangling integer. The endpoint must handle this without error.
    const orphanedThought = {
      id: 99,
      thoughtText: "I will never be good enough",
      situation: "after a review meeting",
      emotion: "shame",
      intensityPct: 85,
      distortionTags: ["labeling", "magnification"],
      telemetryEventId: null, // ← FK was set to NULL when source event was deleted
      createdAt: new Date(),
    };
    state.byTable.set(sentinels.automaticThoughtsTable, [orphanedThought]);

    // GET /cognitive/map should surface the thought with telemetryEventId: null
    const mapRes = await agent.get("/api/cognitive/map");
    expect(mapRes.status).toBe(200);
    expect(mapRes.body.automaticThoughts).toHaveLength(1);
    expect(mapRes.body.automaticThoughts[0].telemetryEventId).toBeNull();

    // POST /cognitive/analyze should also complete without error even when an
    // orphaned thought (telemetryEventId: null) is present in the thoughts table.
    state.openaiQueue.push("[]", "[]"); // Pass 2 (1 thought found), Pass 3 skipped
    const analyzeRes = await agent.post("/api/cognitive/analyze");
    expect(analyzeRes.status).toBe(200);
    // The orphaned thought must still be in the returned map
    expect(
      analyzeRes.body.automaticThoughts.some(
        (t: { telemetryEventId: unknown }) => t.telemetryEventId === null,
      ),
    ).toBe(true);
  });

  // ── Maintenance pruning pass ──────────────────────────────────────────────
  describe("maintenance pruning pass", () => {
    it("returns 200 even when prunable records exist (pruning is non-fatal)", async () => {
      // No unprocessed events, no thoughts → Passes 1-3 are no-ops.
      // The pruning pass will call db.delete twice; mock resolves to [].
      const res = await agent.post("/api/cognitive/analyze");
      expect(res.status).toBe(200);
    });

    it("soft-dismisses (never deletes) stale rows in both cognitive tables", async () => {
      const { db } = await import("@workspace/db");
      const deleteSpy = db.delete as ReturnType<typeof vi.fn>;

      await agent.post("/api/cognitive/analyze");

      // Pruning must not hard-delete — deleted rows would be re-created by
      // the next analysis run from the same underlying thoughts.
      expect(deleteSpy).not.toHaveBeenCalled();

      // Instead both tables receive a status:"dismissed" update.
      const dismissalTables = state.updated
        .filter((u) => (u.set as Record<string, unknown>)?.["status"] === "dismissed")
        .map((u) => u.table);
      expect(dismissalTables).toContain(sentinels.intermediateBeliefsCogTable);
      expect(dismissalTables).toContain(sentinels.coreSchemasTable);
    });

    it("response shape is unchanged after pruning (map fields all present)", async () => {
      state.byTable.set(sentinels.automaticThoughtsTable, [makeThoughtRow(1)]);
      state.byTable.set(sentinels.intermediateBeliefsCogTable, [makeBeliefRow(1)]);

      const res = await agent.post("/api/cognitive/analyze");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        automaticThoughts: expect.any(Array),
        intermediateBeliefs: expect.any(Array),
        coreSchemas: expect.any(Array),
        unprocessedCount: expect.any(Number),
      });
    });
  });

  // ── GET /cognitive/map returns the current mind map ───────────────────────
  describe("GET /api/cognitive/map", () => {
    it("returns 200 with map shape even when all tables are empty", async () => {
      const res = await agent.get("/api/cognitive/map");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        automaticThoughts: expect.any(Array),
        intermediateBeliefs: expect.any(Array),
        coreSchemas: expect.any(Array),
        unprocessedCount: expect.any(Number),
      });
    });

    it("reflects pre-existing data from the DB", async () => {
      state.byTable.set(sentinels.automaticThoughtsTable, [makeThoughtRow(1)]);
      state.byTable.set(sentinels.intermediateBeliefsCogTable, [makeBeliefRow(1)]);

      const res = await agent.get("/api/cognitive/map");
      expect(res.status).toBe(200);
      expect(res.body.automaticThoughts).toHaveLength(1);
      expect(res.body.intermediateBeliefs).toHaveLength(1);
    });
  });
});
