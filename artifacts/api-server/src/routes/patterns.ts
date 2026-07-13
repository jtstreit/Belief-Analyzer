import { Router } from "express";
import { db, beliefsTable, telemetryEventsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { veraComplete } from "@workspace/integrations-openai-ai-server";
import { AnalyzePatternsBody } from "@workspace/api-zod";

const router = Router();

router.get("/patterns", async (req, res) => {
  try {
    const allBeliefs = await db.select().from(beliefsTable);
    const activeBeliefs = allBeliefs.filter(b => b.status === "active");
    const resolvedBeliefs = allBeliefs.filter(b => b.status === "resolved");

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const b of allBeliefs) {
      typeCounts[b.beliefType] = (typeCounts[b.beliefType] ?? 0) + 1;
    }

    const byType = Object.entries(typeCounts).map(([beliefType, count]) => ({
      beliefType,
      count,
    }));

    // Count check-in streak (consecutive days with a mood_checkin)
    const recentCheckins = await db
      .select()
      .from(telemetryEventsTable)
      .where(eq(telemetryEventsTable.type, "mood_checkin"))
      .orderBy(desc(telemetryEventsTable.createdAt))
      .limit(30);

    let streak = 0;
    const today = new Date();
    const seen = new Set<string>();
    for (const c of recentCheckins) {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      seen.add(key);
    }
    // Count consecutive days backwards from today
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (seen.has(key)) {
        streak++;
      } else {
        break;
      }
    }

    const lastAnalyzedAt =
      allBeliefs.length > 0
        ? new Date(Math.max(...allBeliefs.map((b) => new Date(b.createdAt).getTime()))).toISOString()
        : null;

    res.json({
      totalBeliefs: allBeliefs.length,
      activeBeliefs: activeBeliefs.length,
      resolvedBeliefs: resolvedBeliefs.length,
      byType,
      recentStreak: streak,
      lastAnalyzedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get patterns");
    res.status(500).json({ error: "Failed to fetch patterns" });
  }
});

router.post("/patterns/analyze", async (req, res) => {
  try {
    const parsed = AnalyzePatternsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { modality } = parsed.data;
    // Fetch recent telemetry events with thought text (both explicit thought entries and mood check-ins with thoughts)
    const recentThoughts = await db
      .select()
      .from(telemetryEventsTable)
      .orderBy(desc(telemetryEventsTable.createdAt))
      .limit(50)
      .then(rows => rows.filter(r =>
        (r.type === "thought_entry" || r.type === "mood_checkin") &&
        r.thoughtText && r.thoughtText.trim().length > 0
      ));

    if (recentThoughts.length === 0) {
      res.json([]);
      return;
    }

    const thoughtsText = recentThoughts
      .map((t, i) => `${i + 1}. [${new Date(t.createdAt).toLocaleDateString()}] Mood: ${t.mood ?? "unknown"} — "${t.thoughtText ?? ""}"`)
      .join("\n");

    const systemPrompt = modality === "cbt"
      ? `You are an analysis assistant using Beckian CBT concepts for a self-help app. Identify possible unhelpful thought patterns as hypotheses, not diagnoses.

For each pattern found, respond with a JSON array. Each item should have:
- beliefText: the concise automatic thought or underlying belief, phrased tentatively and without diagnosing the person
- beliefType: one of: "all_or_nothing", "overgeneralization", "mental_filter", "discounting_positive", "mind_reading", "fortune_telling", "catastrophizing", "minimization", "emotional_reasoning", "should_statements", "labeling", "personalization", "other"
- triggerSituation: what situation may trigger this pattern
- emotionalConsequence: what emotional state may follow

Return ONLY a valid JSON array, no markdown, no explanation.`
      : `You are an analysis assistant using REBT concepts for a self-help app. Identify possible rigid or self-defeating beliefs as hypotheses, not diagnoses.

For each pattern found, respond with a JSON array. Each item should have:
- beliefText: the concise underlying belief (e.g. "I must be perfect or I'm a failure"), phrased tentatively and without diagnosing the person
- beliefType: one of: "demandingness", "awfulizing", "low_frustration_tolerance", "global_rating", "other"
- triggerSituation: what situation may trigger this belief
- emotionalConsequence: what emotional state may follow

Return ONLY a valid JSON array, no markdown, no explanation.`;

    const content = await veraComplete({
      system: systemPrompt,
      maxTokens: 2000,
      messages: [
        {
          role: "user",
          content: `Analyze these journal entries for possible ${modality.toUpperCase()} thought patterns:\n\n${thoughtsText}`,
        },
      ],
    });
    let detectedBeliefs: Array<{
      beliefText: string;
      beliefType: string;
      triggerSituation?: string;
      emotionalConsequence?: string;
    }>;

    try {
      detectedBeliefs = JSON.parse(content);
    } catch {
      detectedBeliefs = [];
    }

    // Save detected beliefs to DB. Re-analysis routinely re-detects the same
    // belief — skip any text that already exists (whatever its status) so
    // duplicates don't accumulate and resolved/dismissed beliefs stay gone.
    const existingBeliefs = await db.select().from(beliefsTable);
    const existingTexts = new Set(
      existingBeliefs.map((b) => b.beliefText.trim().toLowerCase()),
    );

    const saved = [];
    for (const b of detectedBeliefs) {
      if (!b.beliefText || !b.beliefType) continue;
      if (existingTexts.has(b.beliefText.trim().toLowerCase())) continue;
      existingTexts.add(b.beliefText.trim().toLowerCase());
      const [inserted] = await db
        .insert(beliefsTable)
        .values({
          beliefText: b.beliefText,
          beliefType: b.beliefType,
          triggerSituation: b.triggerSituation ?? null,
          emotionalConsequence: b.emotionalConsequence ?? null,
          status: "active",
        })
        .returning();
      if (inserted) saved.push(inserted);
    }

    res.json(saved);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze patterns");
    res.status(500).json({ error: "Failed to analyze patterns" });
  }
});

export default router;
