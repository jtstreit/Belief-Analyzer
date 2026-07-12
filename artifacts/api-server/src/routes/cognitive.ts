import { Router } from "express";
import {
  db,
  telemetryEventsTable,
  automaticThoughtsTable,
  intermediateBeliefsCogTable,
  coreSchemasTable,
} from "@workspace/db";
import { isNull, inArray, desc, eq, sql, and, lt, lte } from "drizzle-orm";
import { veraComplete } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ─── Helper: assemble the full four-layer map from DB ──────────────────────

async function buildMindMap() {
  const [thoughts, iBeliefs, cSchemas, unprocessedRows] = await Promise.all([
    db
      .select()
      .from(automaticThoughtsTable)
      .orderBy(desc(automaticThoughtsTable.createdAt))
      .limit(50),
    db
      .select()
      .from(intermediateBeliefsCogTable)
      .where(eq(intermediateBeliefsCogTable.status, "active"))
      .orderBy(desc(intermediateBeliefsCogTable.confidence)),
    db
      .select()
      .from(coreSchemasTable)
      .where(eq(coreSchemasTable.status, "active"))
      .orderBy(desc(coreSchemasTable.confidence)),
    db
      .select({ id: telemetryEventsTable.id })
      .from(telemetryEventsTable)
      .where(isNull(telemetryEventsTable.processedAt)),
  ]);

  const lastThought = thoughts[0];
  return {
    automaticThoughts: thoughts,
    intermediateBeliefs: iBeliefs,
    coreSchemas: cSchemas,
    unprocessedCount: unprocessedRows.length,
    lastAnalyzedAt: lastThought ? lastThought.createdAt.toISOString() : null,
  };
}

// ─── GET /cognitive/map ────────────────────────────────────────────────────

router.get("/cognitive/map", async (req, res) => {
  try {
    res.json(await buildMindMap());
  } catch (err) {
    req.log.error({ err }, "Failed to get cognitive map");
    res.status(500).json({ error: "Failed to get cognitive map" });
  }
});

// ─── GET /cognitive/automatic-thoughts ────────────────────────────────────

router.get("/cognitive/automatic-thoughts", async (req, res) => {
  try {
    const limit = req.query["limit"] ? parseInt(req.query["limit"] as string) : 50;
    const thoughts = await db
      .select()
      .from(automaticThoughtsTable)
      .orderBy(desc(automaticThoughtsTable.createdAt))
      .limit(limit);
    res.json(thoughts);
  } catch (err) {
    req.log.error({ err }, "Failed to list automatic thoughts");
    res.status(500).json({ error: "Failed to fetch automatic thoughts" });
  }
});

// ─── GET /cognitive/intermediate-beliefs ──────────────────────────────────

router.get("/cognitive/intermediate-beliefs", async (req, res) => {
  try {
    const beliefs = await db
      .select()
      .from(intermediateBeliefsCogTable)
      .where(eq(intermediateBeliefsCogTable.status, "active"))
      .orderBy(desc(intermediateBeliefsCogTable.confidence));
    res.json(beliefs);
  } catch (err) {
    req.log.error({ err }, "Failed to list intermediate beliefs");
    res.status(500).json({ error: "Failed to fetch intermediate beliefs" });
  }
});

// Manually dismiss an intermediate belief — soft delete so re-analysis
// cannot bring it back.
router.delete("/cognitive/intermediate-beliefs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const updated = await db
      .update(intermediateBeliefsCogTable)
      .set({ status: "dismissed", dismissedAt: new Date() })
      .where(eq(intermediateBeliefsCogTable.id, id))
      .returning({ id: intermediateBeliefsCogTable.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "Intermediate belief not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to dismiss intermediate belief");
    res.status(500).json({ error: "Failed to dismiss intermediate belief" });
  }
});

// ─── GET /cognitive/core-schemas ──────────────────────────────────────────

router.get("/cognitive/core-schemas", async (req, res) => {
  try {
    const schemas = await db
      .select()
      .from(coreSchemasTable)
      .where(eq(coreSchemasTable.status, "active"))
      .orderBy(desc(coreSchemasTable.confidence));
    res.json(schemas);
  } catch (err) {
    req.log.error({ err }, "Failed to list core schemas");
    res.status(500).json({ error: "Failed to fetch core schemas" });
  }
});

// Manually dismiss a core schema — soft delete so re-analysis cannot
// bring it back.
router.delete("/cognitive/core-schemas/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const updated = await db
      .update(coreSchemasTable)
      .set({ status: "dismissed", dismissedAt: new Date() })
      .where(eq(coreSchemasTable.id, id))
      .returning({ id: coreSchemasTable.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "Core schema not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to dismiss core schema");
    res.status(500).json({ error: "Failed to dismiss core schema" });
  }
});

// ─── POST /cognitive/analyze ───────────────────────────────────────────────
//
// Three-pass idempotent LLM engine:
//   Pass 1 — extract automatic thoughts from unprocessed telemetry, mark processed
//   Pass 2 — synthesise / upsert intermediate beliefs from all thoughts
//   Pass 3 — infer / upsert core schemas from intermediate beliefs
//
// Confidence and evidenceCount on existing rows accumulate rather than reset.

router.post("/cognitive/analyze", async (req, res) => {
  try {
    // ── Pass 0: fetch unprocessed telemetry ──────────────────────────
    const unprocessed = await db
      .select()
      .from(telemetryEventsTable)
      .where(isNull(telemetryEventsTable.processedAt))
      .orderBy(desc(telemetryEventsTable.createdAt))
      .limit(100);

    const withContent = unprocessed.filter(
      (e) => e.thoughtText && e.thoughtText.trim().length > 5,
    );
    const withoutContent = unprocessed.filter(
      (e) => !e.thoughtText || e.thoughtText.trim().length <= 5,
    );

    // Events without meaningful text will never yield thoughts — consume them
    // eagerly so they don't inflate the backlog badge on retry.
    if (withoutContent.length > 0) {
      await db
        .update(telemetryEventsTable)
        .set({ processedAt: new Date() })
        .where(inArray(telemetryEventsTable.id, withoutContent.map((e) => e.id)));
    }

    // ── Pass 1: extract automatic thoughts from content events ────────
    // Events in `withContent` are marked processed ONLY inside a transaction
    // after their thoughts are successfully persisted. If the LLM fails or
    // insertion throws, the transaction rolls back and events remain
    // unprocessed so the next analyze call can retry them.
    if (withContent.length > 0) {
      const entriesText = withContent
        .map(
          (e, i) =>
            `${i + 1}. [type:${e.type}] [source:${e.source ?? "manual"}] "${e.thoughtText}"`,
        )
        .join("\n");

      const layer1System = `You are a Beck-model CBT expert. Extract automatic thoughts from the entries below.
For each entry return one or more automatic thought objects as a JSON array. Each object:
  entryIndex: number (1-based, matches the entry number)
  thoughtText: string — the core automatic thought (concise, first-person)
  situation: string | null — the triggering situation
  emotion: string | null — primary emotion (e.g. "anxiety", "sadness", "anger")
  intensityPct: number 0–100 — estimated emotional intensity
  distortionTags: string[] — applicable Burns cognitive distortions from this exact list:
    all_or_nothing, overgeneralization, mental_filter, discounting_positive, mind_reading,
    fortune_telling, magnification, minimization, emotional_reasoning,
    should_statements, labeling, personalization

Return ONLY a valid JSON array — no markdown, no explanation.`;

      // This call can throw (network error, timeout, API error).
      // Let it propagate — the catch block returns 500 and events stay retryable.
      const responseContent = await veraComplete({
        system: layer1System,
        maxTokens: 3000,
        messages: [{ role: "user", content: `Entries:\n${entriesText}` }],
      });

      // Parse the LLM response — do NOT swallow parse errors.
      // If JSON.parse throws (malformed output), it propagates to the outer
      // catch, returns 500, and withContent events remain unprocessed + retryable.
      const parsedResponse: unknown = JSON.parse(responseContent);
      if (!Array.isArray(parsedResponse)) {
        throw new Error(
          `LLM returned non-array response (type: ${typeof parsedResponse}). Events left retryable.`,
        );
      }

      // Validate individual thought objects — malformed entries are skipped,
      // not silently treated as successes.
      type ValidThought = {
        entryIndex: number;
        thoughtText: string;
        situation?: string | null;
        emotion?: string | null;
        intensityPct?: number | null;
        distortionTags?: string[];
      };
      const validThoughts: ValidThought[] = (parsedResponse as unknown[]).filter(
        (t): t is ValidThought => {
          if (typeof t !== "object" || t === null) return false;
          const obj = t as Record<string, unknown>;
          return (
            typeof obj["entryIndex"] === "number" &&
            (obj["entryIndex"] as number) >= 1 &&
            (obj["entryIndex"] as number) <= withContent.length &&
            typeof obj["thoughtText"] === "string" &&
            (obj["thoughtText"] as string).trim().length > 0
          );
        },
      );

      // Atomic: insert validated thoughts and mark only their source events as
      // processed. Events with no valid thoughts extracted remain unprocessed
      // and retryable. Transaction rollback leaves everything retryable.
      const processedEventIds = new Set<number>();
      await db.transaction(async (tx) => {
        for (const t of validThoughts) {
          const sourceEvent = withContent[t.entryIndex - 1];
          if (!sourceEvent) continue;
          await tx.insert(automaticThoughtsTable).values({
            thoughtText: t.thoughtText.trim(),
            situation: typeof t.situation === "string" ? t.situation : null,
            emotion: typeof t.emotion === "string" ? t.emotion : null,
            intensityPct:
              typeof t.intensityPct === "number"
                ? Math.min(100, Math.max(0, Math.round(t.intensityPct)))
                : null,
            distortionTags: Array.isArray(t.distortionTags)
              ? t.distortionTags.filter((d) => typeof d === "string")
              : [],
            telemetryEventId: sourceEvent.id,
          });
          processedEventIds.add(sourceEvent.id);
        }
        if (processedEventIds.size > 0) {
          await tx
            .update(telemetryEventsTable)
            .set({ processedAt: new Date() })
            .where(inArray(telemetryEventsTable.id, [...processedEventIds]));
        }
        // Events with zero valid thoughts are intentionally left unprocessed
        // (processedAt stays null) so they can be retried on next analyze call.
      });
    }

    // ── Pass 2: upsert intermediate beliefs ──────────────────────────
    const [allThoughts, existingIBeliefs] = await Promise.all([
      db
        .select()
        .from(automaticThoughtsTable)
        .orderBy(desc(automaticThoughtsTable.createdAt))
        .limit(80),
      db.select().from(intermediateBeliefsCogTable),
    ]);

    if (allThoughts.length > 0) {
      const thoughtsSummary = allThoughts
        .map(
          (t) =>
            `- "${t.thoughtText}" [${(t.distortionTags as string[]).join(", ") || "no distortions"}]`,
        )
        .join("\n");

      // Only active beliefs are offered to the LLM for confirmation —
      // dismissed ones must not be reinforced or resurrected.
      const activeIBeliefs = existingIBeliefs.filter((b) => b.status === "active");
      const existingIText =
        activeIBeliefs.length > 0
          ? `\nExisting intermediate beliefs (reference by id when this batch confirms them):\n${activeIBeliefs.map((b) => `  id:${b.id} "${b.beliefText}" (${b.category})`).join("\n")}`
          : "";

      const layer2System = `You are a Beck-model CBT expert. From these automatic thoughts, synthesise intermediate beliefs — rules, assumptions, or attitudes.${existingIText}

Return a JSON array. Each object:
  beliefText: string — concise belief statement
  category: "rule" | "assumption" | "attitude"
    • rule: starts with "I must/should/have to…" or "People must…"
    • assumption: conditional "If I X then Y" statements
    • attitude: stable evaluative stance ("I am fundamentally inadequate")
  matchesExistingId: number | null — id of an existing belief this confirms; null for new
  initialConfidence: number 15–60 — initial confidence if new (higher = more thoughts support it)

Only include beliefs supported by 2+ thoughts. Return ONLY valid JSON array.`;

      const layer2Text = await veraComplete({
        system: layer2System,
        maxTokens: 2000,
        messages: [{ role: "user", content: thoughtsSummary }],
      });

      let rawBeliefs: Array<{
        beliefText: string;
        category: string;
        matchesExistingId?: number | null;
        initialConfidence?: number;
      }> = [];
      try {
        rawBeliefs = JSON.parse(layer2Text || "[]");
      } catch {
        rawBeliefs = [];
      }

      for (const b of rawBeliefs) {
        if (!b.beliefText?.trim()) continue;
        if (b.matchesExistingId) {
          const existing = existingIBeliefs.find((e) => e.id === b.matchesExistingId);
          // Dismissed beliefs stay dismissed — never reinforce them.
          if (existing && existing.status === "active") {
            await db
              .update(intermediateBeliefsCogTable)
              .set({
                evidenceCount: existing.evidenceCount + 1,
                confidence: Math.min(95, existing.confidence + 10),
                updatedAt: new Date(),
              })
              .where(eq(intermediateBeliefsCogTable.id, existing.id));
          }
        } else {
          // Use onConflictDoUpdate so an exact-duplicate beliefText (caught by
          // the unique index) accumulates evidence rather than failing silently
          // or crashing the analysis run. setWhere keeps dismissed rows
          // dismissed: the conflict update is a no-op for them, so a pruned
          // belief cannot reappear on re-analysis.
          await db
            .insert(intermediateBeliefsCogTable)
            .values({
              beliefText: b.beliefText,
              category: b.category ?? "rule",
              confidence: b.initialConfidence ?? 20,
              evidenceCount: 1,
            })
            .onConflictDoUpdate({
              target: intermediateBeliefsCogTable.beliefText,
              set: {
                evidenceCount: sql`${intermediateBeliefsCogTable.evidenceCount} + 1`,
                confidence: sql`LEAST(95, ${intermediateBeliefsCogTable.confidence} + 10)`,
                updatedAt: new Date(),
              },
              setWhere: sql`${intermediateBeliefsCogTable.status} = 'active'`,
            });
        }
      }
    }

    // ── Pass 3: upsert core schemas ───────────────────────────────────
    const [allIBeliefs, existingSchemas] = await Promise.all([
      db
        .select()
        .from(intermediateBeliefsCogTable)
        .where(eq(intermediateBeliefsCogTable.status, "active"))
        .orderBy(desc(intermediateBeliefsCogTable.confidence)),
      db.select().from(coreSchemasTable),
    ]);

    if (allIBeliefs.length >= 2) {
      const beliefsSummary = allIBeliefs
        .map((b) => `- "${b.beliefText}" (${b.category}, confidence:${b.confidence})`)
        .join("\n");

      // Dismissed schemas are withheld from the LLM so they are never confirmed.
      const activeSchemas = existingSchemas.filter((s) => s.status === "active");
      const existingSchemasText =
        activeSchemas.length > 0
          ? `\nExisting core schemas (reference by id when confirmed):\n${activeSchemas.map((s) => `  id:${s.id} "${s.schemaText}" (${s.domain})`).join("\n")}`
          : "";

      const layer3System = `You are a Beck-model CBT expert. From these intermediate beliefs, infer core schemas.${existingSchemasText}

Core schema domains: "helpless" | "unlovable" | "worthless" | "other"
Return a JSON array. Each object:
  schemaText: string — core schema (e.g. "I am fundamentally incapable")
  domain: "helpless" | "unlovable" | "worthless" | "other"
  matchesExistingId: number | null
  initialConfidence: number 10–50

Only include schemas supported by 3+ intermediate beliefs. Return ONLY valid JSON array.`;

      const layer3Text = await veraComplete({
        system: layer3System,
        maxTokens: 1500,
        messages: [{ role: "user", content: beliefsSummary }],
      });

      let rawSchemas: Array<{
        schemaText: string;
        domain: string;
        matchesExistingId?: number | null;
        initialConfidence?: number;
      }> = [];
      try {
        rawSchemas = JSON.parse(layer3Text || "[]");
      } catch {
        rawSchemas = [];
      }

      for (const s of rawSchemas) {
        if (!s.schemaText?.trim() || !s.domain) continue;
        if (s.matchesExistingId) {
          const existing = existingSchemas.find((e) => e.id === s.matchesExistingId);
          // Dismissed schemas stay dismissed — never reinforce them.
          if (existing && existing.status === "active") {
            await db
              .update(coreSchemasTable)
              .set({
                evidenceCount: existing.evidenceCount + 1,
                confidence: Math.min(95, existing.confidence + 10),
                updatedAt: new Date(),
              })
              .where(eq(coreSchemasTable.id, existing.id));
          }
        } else {
          // Same conflict-safe upsert as Pass 2 — unique index on schemaText
          // catches duplicates the LLM mis-labels as new, and setWhere keeps
          // dismissed rows dismissed.
          await db
            .insert(coreSchemasTable)
            .values({
              schemaText: s.schemaText,
              domain: s.domain,
              confidence: s.initialConfidence ?? 15,
              evidenceCount: 1,
            })
            .onConflictDoUpdate({
              target: coreSchemasTable.schemaText,
              set: {
                evidenceCount: sql`${coreSchemasTable.evidenceCount} + 1`,
                confidence: sql`LEAST(95, ${coreSchemasTable.confidence} + 10)`,
                updatedAt: new Date(),
              },
              setWhere: sql`${coreSchemasTable.status} = 'active'`,
            });
        }
      }
    }

    // ── Maintenance pass 1: decay confidence on stale entries ────────
    // Active entries untouched for 14+ days lose 5 confidence points
    // (floored at 5). The decay itself refreshes updatedAt, so each entry
    // decays at most once per 14-day window of inactivity.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [decayedBeliefs, decayedSchemas] = await Promise.all([
      db
        .update(intermediateBeliefsCogTable)
        .set({
          confidence: sql`GREATEST(5, ${intermediateBeliefsCogTable.confidence} - 5)`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(intermediateBeliefsCogTable.status, "active"),
            lt(intermediateBeliefsCogTable.updatedAt, fourteenDaysAgo),
          ),
        )
        .returning({ id: intermediateBeliefsCogTable.id }),
      db
        .update(coreSchemasTable)
        .set({
          confidence: sql`GREATEST(5, ${coreSchemasTable.confidence} - 5)`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(coreSchemasTable.status, "active"),
            lt(coreSchemasTable.updatedAt, fourteenDaysAgo),
          ),
        )
        .returning({ id: coreSchemasTable.id }),
    ]);

    if (decayedBeliefs.length > 0 || decayedSchemas.length > 0) {
      req.log.info(
        {
          decayedBeliefIds: decayedBeliefs.map((b) => b.id),
          decayedSchemaIds: decayedSchemas.map((s) => s.id),
        },
        `Decayed confidence on ${decayedBeliefs.length} stale belief(s) and ${decayedSchemas.length} stale schema(s)`,
      );
    }

    // ── Maintenance pass 2: prune stale low-evidence entries ─────────
    // Entries created over 30 days ago that were never confirmed by more
    // than one analysis run and still have low confidence are almost
    // certainly artefacts of a one-off session. They are DISMISSED, not
    // deleted — the row (and its unique text) stays behind so a later
    // analysis run cannot re-create the same belief from old thoughts.
    // (createdAt, not updatedAt: the decay pass refreshes updatedAt.)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [prunedBeliefs, prunedSchemas] = await Promise.all([
      db
        .update(intermediateBeliefsCogTable)
        .set({ status: "dismissed", dismissedAt: new Date() })
        .where(
          and(
            eq(intermediateBeliefsCogTable.status, "active"),
            lte(intermediateBeliefsCogTable.evidenceCount, 1),
            lt(intermediateBeliefsCogTable.confidence, 20),
            lt(intermediateBeliefsCogTable.createdAt, thirtyDaysAgo),
          ),
        )
        .returning({ id: intermediateBeliefsCogTable.id }),
      db
        .update(coreSchemasTable)
        .set({ status: "dismissed", dismissedAt: new Date() })
        .where(
          and(
            eq(coreSchemasTable.status, "active"),
            lte(coreSchemasTable.evidenceCount, 1),
            lt(coreSchemasTable.confidence, 15),
            lt(coreSchemasTable.createdAt, thirtyDaysAgo),
          ),
        )
        .returning({ id: coreSchemasTable.id }),
    ]);

    if (prunedBeliefs.length > 0 || prunedSchemas.length > 0) {
      req.log.info(
        {
          prunedBeliefIds: prunedBeliefs.map((b) => b.id),
          prunedSchemaIds: prunedSchemas.map((s) => s.id),
        },
        `Pruned (dismissed) ${prunedBeliefs.length} stale intermediate belief(s) and ${prunedSchemas.length} stale core schema(s)`,
      );
    }

    res.json(await buildMindMap());
  } catch (err) {
    req.log.error({ err }, "Failed to run cognitive analysis");
    res.status(500).json({ error: "Failed to run cognitive analysis" });
  }
});

export default router;
