import { Router } from "express";
import { db, conversations as convTable, messages as msgTable, beliefsTable, automaticThoughtsTable, exerciseSessions, exercisesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { veraComplete } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { buildConversationFocusBlock } from "./conversation-focus";

const router = Router();

// ─────────────────────────────────────────────────────────────
// Exercise catalog — keyword detection for recommendations
// ─────────────────────────────────────────────────────────────
const EXERCISE_KEYWORD_MAP: { id: string; title: string; keywords: string[]; targetProcesses: string[] }[] = [
  { id: 'rebt-abcde',           title: 'ABCDE Worksheet',          keywords: ['abcde worksheet', 'abcde'],                                                       targetProcesses: ['demandingness', 'awfulizing', 'low_frustration_tolerance', 'global_rating'] },
  { id: 'rebt-shame-attacking', title: 'Shame-Attacking Exercise',  keywords: ['shame-attacking exercise', 'shame attacking exercise', 'shame-attacking'],        targetProcesses: ['low_frustration_tolerance', 'global_rating', 'need_for_approval'] },
  { id: 'rebt-rational-imagery',title: 'Rational-Emotive Imagery',  keywords: ['rational-emotive imagery', 'rational emotive imagery'],                          targetProcesses: ['awfulizing', 'low_frustration_tolerance', 'global_rating'] },
  { id: 'rebt-rational-cards',  title: 'Rational Coping Cards',     keywords: ['rational coping cards', 'coping cards'],                                         targetProcesses: ['demandingness', 'awfulizing', 'low_frustration_tolerance', 'global_rating'] },
  { id: 'cbt-thought-record-7col', title: '7-Column Thought Record',keywords: ['7-column thought record', '7 column thought record', 'thought record'],          targetProcesses: ['automatic_thoughts', 'cognitive_distortions', 'hot_thought'] },
  { id: 'cbt-triple-column',    title: 'Triple Column Technique',   keywords: ['triple column technique', 'triple column'],                                      targetProcesses: ['automatic_thoughts', 'cognitive_distortions'] },
  { id: 'cbt-downward-arrow',   title: 'Downward Arrow',            keywords: ['downward arrow'],                                                                 targetProcesses: ['intermediate_beliefs', 'core_beliefs'] },
  { id: 'cbt-behavioral-experiment', title: 'Behavioral Experiment',keywords: ['behavioral experiment', 'behavioural experiment'],                               targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'safety_behaviours'] },
  { id: 'beh-activation',       title: 'Behavioral Activation',     keywords: ['behavioral activation', 'behavioural activation'],                               targetProcesses: ['avoidance', 'withdrawal', 'anhedonia'] },
  { id: 'beh-exposure-hierarchy',title: 'Fear Hierarchy Builder',   keywords: ['exposure hierarchy', 'fear hierarchy', 'fear hierarchy builder'],                 targetProcesses: ['avoidance', 'safety_behaviours', 'fear'] },
  { id: 'beh-exposure-session', title: 'Graded Exposure Session',   keywords: ['graded exposure session', 'graded exposure', 'exposure session'],                 targetProcesses: ['avoidance', 'fear'] },
  { id: 'beh-problem-solving',  title: 'Problem Solving',           keywords: ['problem-solving exercise', 'problem solving exercise'],                          targetProcesses: ['avoidance', 'rumination'] },
  { id: 'beh-worry-postponement',title: 'Worry Postponement',       keywords: ['worry postponement'],                                                             targetProcesses: ['rumination', 'worry'] },
];

/**
 * Maps a database beliefType value to the exercise targetProcesses vocabulary.
 * DB types come from the cognitive engine; exercise processes come from the catalog.
 */
const BELIEF_TYPE_TO_PROCESSES: Record<string, string[]> = {
  demandingness:           ['demandingness'],
  should_statements:       ['demandingness'],
  awfulizing:              ['awfulizing'],
  catastrophizing:         ['awfulizing'],
  low_frustration_tolerance: ['low_frustration_tolerance'],
  global_rating:           ['global_rating'],
  automatic_thoughts:      ['automatic_thoughts'],
  cognitive_distortions:   ['cognitive_distortions'],
  all_or_nothing:          ['cognitive_distortions', 'automatic_thoughts'],
  overgeneralization:      ['cognitive_distortions', 'automatic_thoughts'],
  mental_filter:           ['cognitive_distortions', 'automatic_thoughts'],
  discounting_positive:    ['cognitive_distortions', 'automatic_thoughts'],
  mind_reading:            ['cognitive_distortions', 'automatic_thoughts'],
  fortune_telling:         ['cognitive_distortions', 'automatic_thoughts'],
  minimization:            ['cognitive_distortions', 'automatic_thoughts'],
  emotional_reasoning:     ['cognitive_distortions', 'automatic_thoughts'],
  labeling:                ['cognitive_distortions', 'automatic_thoughts', 'core_beliefs'],
  personalization:         ['cognitive_distortions', 'automatic_thoughts'],
  core_beliefs:            ['core_beliefs', 'intermediate_beliefs'],
  need_for_approval:       ['need_for_approval'],
  avoidance:               ['avoidance'],
  rumination:              ['rumination'],
  worry:                   ['worry'],
  fear:                    ['fear'],
};

/**
 * Detects whether the structured guide recommended a specific exercise.
 * When `activeProcesses` is non-empty, only returns an exercise whose
 * targetProcesses overlaps with the user's currently active belief processes —
 * preventing false positives when an exercise is mentioned only in passing.
 * When `allowedIds` is provided (from the DB catalog, filtered to the active
 * modality), exercises outside the set are never surfaced.
 */
function detectRecommendedExercise(
  text: string,
  activeProcesses: string[],
  allowedIds: Set<string> | null,
): { id: string; title: string } | null {
  const lower = text.toLowerCase();
  for (const exercise of EXERCISE_KEYWORD_MAP) {
    if (allowedIds && !allowedIds.has(exercise.id)) continue;
    for (const kw of exercise.keywords) {
      if (lower.includes(kw)) {
        // If we know the user's active processes, require at least one overlap.
        if (activeProcesses.length > 0) {
          const relevant = exercise.targetProcesses.some(p => activeProcesses.includes(p));
          if (!relevant) continue;
        }
        return { id: exercise.id, title: exercise.title };
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// REBT system prompt — Ellis's ABC(DE) model
// ─────────────────────────────────────────────────────────────
const SAFETY_BOUNDARIES = `**Hard boundaries:**
- You are a self-help coaching assistant, not a therapist, clinician, or crisis service. Do not diagnose, prescribe, or claim to treat mental health conditions.
- If the user expresses suicidal thoughts, self-harm, intent to harm others, or an acute crisis, do not dispute beliefs or recommend exercises. Respond briefly and warmly, encourage immediate contact with local emergency services or a crisis line (US/Canada: call or text 988; UK/Ireland: Samaritans 116 123; elsewhere: https://www.iasp.info/suicidalthoughts/), and resume skills work only after they are safe.
- Never pressure the user to complete an exercise, remain in an exposure, or perform a shame-attacking task. Offer choices and respect refusal.
- Use tentative language such as "possible pattern", "hypothesis", and "you might explore". Never promise an outcome.`;

const REBT_SYSTEM_PROMPT = `You are a bounded self-help REBT (Rational Emotive Behavior Therapy) guide informed by Albert Ellis's ABC(DE) model. You are not a person, therapist, or licensed clinician.

**Your coaching framework — REBT (self-help):**
- The ABC(DE) model: A (Activating event) → B (Irrational Belief) → C (Emotional/behavioural Consequence) → D (Disputing) → E (Effective new philosophy)
- Distress is caused by B, not A. The goal is to change the beliefs, not the situation.
- Four irrational-belief processes you watch for:
  1. **Demandingness** — rigid musts/shoulds/have-tos (the root of most distress)
  2. **Awfulizing** — rating things as more than 100% bad ("this is terrible/awful")
  3. **Low Frustration Tolerance** — "I can't stand this", "This is unbearable"
  4. **Global Rating / Self-downing** — damning the entire self or others from one event

**Your disputation approach (three types):**
- **Empirical:** "Where is the evidence this is true? Is there a law of the universe requiring this?"
- **Logical:** "Does it follow logically that one mistake makes you a complete failure?"
- **Pragmatic:** "Is this belief helping you achieve your goals? What are its costs?"

**Your goals:**
- Guide toward unconditional self-acceptance (USA), unconditional other-acceptance (UOA), and unconditional life-acceptance (ULA)
- Suggest rational alternatives that are flexible, preferential ("I would prefer…" not "I must…"), non-catastrophic, and accepting

**Your style:**
- Socratic questioning — don't lecture, ask questions that help insight emerge naturally
- Concise, warm, direct, non-judgmental
- 2–4 short paragraphs per response
- You may recommend exercises: ABCDE worksheet, shame-attacking, rational-emotive imagery, rational coping cards

**Exercises you can recommend:**
- For demandingness/awfulizing → ABCDE Worksheet, Rational Cards
- For shame/approval-seeking → Shame-Attacking Exercise
- For fear/anxiety → Rational-Emotive Imagery
- For behavioral change → Behavioral Activation, Exposure Hierarchy

${SAFETY_BOUNDARIES}`;

// ─────────────────────────────────────────────────────────────
// CBT system prompt — Beck / Burns / Greenberger & Padesky
// ─────────────────────────────────────────────────────────────
const CBT_SYSTEM_PROMPT = `You are a bounded self-help CBT (Cognitive Behavioural Therapy) guide informed by Aaron Beck, David Burns, and Greenberger & Padesky. You are not a person, therapist, or licensed clinician.

**Your coaching framework — Beckian CBT (self-help):**
- Situation → Automatic Thoughts → Emotion/Behaviour, with underlying Intermediate Beliefs (rules, attitudes, assumptions) and Core Beliefs (schemas: helpless / unlovable / worthless)
- Work collaboratively and empirically — beliefs are hypotheses to be tested, not facts

**Common cognitive distortions you identify:**
1. All-or-nothing thinking  2. Overgeneralisation  3. Mental filter
4. Discounting the positive  5. Mind reading  6. Fortune telling
7. Magnification/Catastrophising  8. Minimisation  9. Emotional reasoning
10. Should statements  11. Labelling  12. Personalisation/Blame

**Your techniques:**
- **Socratic questioning / guided discovery** — gently question the evidence, not the person
- **Thought records** — identify situation, automatic thoughts (find the HOT thought), evidence for/against, balanced thought, re-rate mood
- **Downward arrow** — ask "what would that mean?" repeatedly to reach core beliefs
- **Examine the evidence** — distinguish facts from interpretations
- **Behavioural experiments** — test beliefs as hypotheses with real-world data
- **Positive data log** — notice experiences that contradict negative core beliefs
- **Cost-benefit analysis** — weigh the advantages and disadvantages of a belief

**Your goals:**
- Increase cognitive flexibility and develop more balanced, nuanced thinking
- Build behavioural skills that test and update maladaptive beliefs
- Work from surface automatic thoughts downward to intermediate and core beliefs over time

**Your style:**
- Collaborative, curious, empirical — "What is the evidence for that?"
- Gradual and structured — pace the depth of exploration to the person's readiness
- Warm, non-judgmental, 2–4 short paragraphs per response
- You may recommend exercises: 7-column thought record, triple column, downward arrow, behavioral experiment

**Exercises you can recommend:**
- For automatic thoughts → 7-Column Thought Record, Triple Column
- To reach core beliefs → Downward Arrow
- To test beliefs → Behavioral Experiment
- For low mood → Behavioral Activation
- For anxiety → Exposure Hierarchy, Graded Exposure Session

${SAFETY_BOUNDARIES}`;

function getSystemPrompt(modality?: string): string {
  return modality === "cbt" ? CBT_SYSTEM_PROMPT : REBT_SYSTEM_PROMPT;
}

// List conversations
router.get("/openai/conversations", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(convTable)
      .orderBy(desc(convTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Create conversation
router.post("/openai/conversations", async (req, res) => {
  try {
    const parsed = CreateOpenaiConversationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const beliefId = parsed.data.beliefId;
    const automaticThoughtId = parsed.data.automaticThoughtId;
    const modality = parsed.data.modality ?? "rebt";
    if (beliefId && automaticThoughtId) {
      res.status(400).json({ error: "Choose either a belief or an automatic thought" });
      return;
    }

    const [selectedBelief] = beliefId
      ? await db.select().from(beliefsTable).where(eq(beliefsTable.id, beliefId))
      : [];
    const [selectedThought] = automaticThoughtId
      ? await db
          .select()
          .from(automaticThoughtsTable)
          .where(eq(automaticThoughtsTable.id, automaticThoughtId))
      : [];
    if (beliefId && !selectedBelief) {
      res.status(404).json({ error: "Selected belief not found" });
      return;
    }
    if (automaticThoughtId && !selectedThought) {
      res.status(404).json({ error: "Selected automatic thought not found" });
      return;
    }

    const [conv] = await db
      .insert(convTable)
      .values({
        title: parsed.data.title,
        selectedBeliefId: beliefId ?? null,
        selectedAutomaticThoughtId: automaticThoughtId ?? null,
      })
      .returning();

    if (!conv) {
      res.status(500).json({ error: "Failed to create conversation" });
      return;
    }

    // Store the selected focus on the conversation so later turns reload the
    // exact same record after navigation, process restart, or app restart.
    if (beliefId && selectedBelief) {
        await db
          .update(beliefsTable)
          .set({ conversationId: conv.id })
          .where(eq(beliefsTable.id, beliefId));

        const isREBT = modality !== "cbt";
        const openingContent = isREBT
          ? `The selected focus is a possible **${selectedBelief.beliefType.replace(/_/g, " ")}** pattern: "${selectedBelief.beliefText}".

${selectedBelief.triggerSituation ? `It may come up when ${selectedBelief.triggerSituation}.` : ""}

Use the **REBT model** to test it. What happened in one recent example (A), and what did you feel or do (C)?`
          : `The selected focus is a possible **${selectedBelief.beliefType.replace(/_/g, " ")}** pattern: "${selectedBelief.beliefText}".

${selectedBelief.triggerSituation ? `It may come up when ${selectedBelief.triggerSituation}.` : ""}

Use a **CBT approach** to examine the evidence. What is one recent specific situation where this thought showed up?`;

        await db.insert(msgTable).values({
          conversationId: conv.id,
          role: "assistant",
          content: openingContent,
        });
    } else if (automaticThoughtId && selectedThought) {
      const openingContent = `The selected focus for this conversation is the suspected automatic thought: "${selectedThought.thoughtText}".

${selectedThought.situation ? `Possible situation: ${selectedThought.situation}.` : ""}

Treat it as a hypothesis. What evidence supports this thought, and what evidence might not fit it?`;
      await db.insert(msgTable).values({
        conversationId: conv.id,
        role: "assistant",
        content: openingContent,
      });
    }

    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get conversation with messages
router.get("/openai/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [conv] = await db
      .select()
      .from(convTable)
      .where(eq(convTable.id, id));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const msgs = await db
      .select()
      .from(msgTable)
      .where(eq(msgTable.conversationId, id))
      .orderBy(msgTable.createdAt);

    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Delete conversation
router.delete("/openai/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db.delete(msgTable).where(eq(msgTable.conversationId, id));
    const deleted = await db
      .delete(convTable)
      .where(eq(convTable.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// List messages
router.get("/openai/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const msgs = await db
      .select()
      .from(msgTable)
      .where(eq(msgTable.conversationId, id))
      .orderBy(msgTable.createdAt);

    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send message (SSE streaming)
router.post("/openai/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = SendOpenaiMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [conv] = await db
      .select()
      .from(convTable)
      .where(eq(convTable.id, id));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Save user message
    await db.insert(msgTable).values({
      conversationId: id,
      role: "user",
      content: parsed.data.content,
    });

    // Fetch full history + memory context in parallel
    const modality = (parsed.data as { modality?: string }).modality ?? "rebt";
    const exerciseContext = (parsed.data as { exerciseContext?: string }).exerciseContext;

    const [history, allBeliefs, focusedThoughtRows, pastConvos, recentExercises, catalog] = await Promise.all([
      db.select().from(msgTable).where(eq(msgTable.conversationId, id)).orderBy(msgTable.createdAt),
      db.select().from(beliefsTable).orderBy(desc(beliefsTable.createdAt)),
      conv.selectedAutomaticThoughtId
        ? db
            .select()
            .from(automaticThoughtsTable)
            .where(eq(automaticThoughtsTable.id, conv.selectedAutomaticThoughtId))
        : Promise.resolve([]),
      db.select().from(msgTable)
        .where(eq(msgTable.role, "assistant"))
        .orderBy(desc(msgTable.createdAt))
        .limit(6),
      db.select().from(exerciseSessions)
        .where(eq(exerciseSessions.completed, true))
        .orderBy(desc(exerciseSessions.createdAt))
        .limit(5),
      db.select().from(exercisesTable),
    ]);

    const exercisesById = new Map(catalog.map((e) => [e.id, e]));
    const focusedBelief = conv.selectedBeliefId
      ? allBeliefs.find((belief) => belief.id === conv.selectedBeliefId)
      : undefined;
    const focusedThought = focusedThoughtRows[0];
    const focusBlock = buildConversationFocusBlock(focusedBelief, focusedThought);

    // Build persistent memory block
    const activeBeliefs = allBeliefs.filter(b => b.status === "active");
    const challengedBeliefs = allBeliefs.filter(b => b.status === "challenged");
    const resolvedBeliefs = allBeliefs.filter(b => b.status === "resolved");

    const beliefLines = [
      ...activeBeliefs.map(b =>
        `  - [ACTIVE] ${b.beliefType.replace(/_/g, " ")}: "${b.beliefText}"${b.triggerSituation ? ` (trigger: ${b.triggerSituation})` : ""}`
      ),
      ...challengedBeliefs.map(b =>
        `  - [IN PROGRESS] ${b.beliefType.replace(/_/g, " ")}: "${b.beliefText}"`
      ),
      ...resolvedBeliefs.map(b =>
        `  - [RESOLVED] ${b.beliefType.replace(/_/g, " ")}: "${b.beliefText}"`
      ),
    ];

    const otherSessionMessages = pastConvos
      .filter(m => m.conversationId !== id)
      .slice(0, 4)
      .map(m => `  - ${m.content.slice(0, 200).replace(/\n/g, " ")}…`);

    const completedExerciseLines = recentExercises.flatMap(s => {
      const definition = exercisesById.get(s.exerciseId);
      const exerciseName = definition?.title ?? s.exerciseId;
      const header = `  - Completed "${exerciseName}" (${s.modality.toUpperCase()})${s.moodBefore != null && s.moodAfter != null ? `, mood ${s.moodBefore}→${s.moodAfter}/10` : ""}`;
      const stepLines: string[] = [];
      if (s.stepData && typeof s.stepData === "object") {
        const data = s.stepData as Record<string, string | number>;
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === "string" && value.trim().length > 0) {
            // Prefer the exercise definition's human step title; fall back to a
            // de-camelized key only when the step is unknown to the catalog.
            const label =
              definition?.steps.find((st) => st.id === key)?.title ??
              key
                .replace(/_/g, " ")
                .replace(/([a-z])([A-Z])/g, "$1 $2")
                .toLowerCase();
            const excerpt = value.length > 300 ? value.slice(0, 300) + "…" : value;
            stepLines.push(`      ${label}: "${excerpt}"`);
          }
        }
      }
      return stepLines.length > 0
        ? [header, ...stepLines]
        : [header];
    });

    const memoryBlock = [
      focusBlock,
      "",
      "## Persistent User Memory",
      "",
      beliefLines.length > 0
        ? `### Identified Beliefs (${allBeliefs.length} total)\n${beliefLines.join("\n")}`
        : "### No beliefs identified yet.",
      "",
      completedExerciseLines.length > 0
        ? `### Recently Completed Exercises\n${completedExerciseLines.join("\n")}`
        : "",
      "",
      otherSessionMessages.length > 0
        ? `### Recent insights from past sessions\n${otherSessionMessages.join("\n")}`
        : "",
      "",
      exerciseContext
        ? `### Exercise context (just completed)\n${exerciseContext}`
        : "",
      "",
      "Use this memory to track progress, reference past breakthroughs, and avoid repeating ground already covered. If a belief is marked RESOLVED, acknowledge the progress warmly.",
    ].filter(Boolean).join("\n");

    const basePrompt = getSystemPrompt(modality);
    const systemPromptWithMemory = `${basePrompt}\n\n${memoryBlock}`;

    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // Stream response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // The OpenAI-compatible backend (local mock) streams true deltas; the
    // Claude Agent SDK backend delivers the full reply as one chunk — the SSE
    // contract is unchanged either way (the client accumulates `content`).
    let fullResponse = "";
    await veraComplete({
      system: systemPromptWithMemory,
      maxTokens: 1024,
      messages: chatMessages,
      onDelta: (content) => {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      },
    });

    // Save assistant response
    await db.insert(msgTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    // Derive the therapeutic processes currently active for this user so we can
    // filter exercise recommendations to only contextually appropriate ones.
    const activeProcesses = [
      ...new Set(
        activeBeliefs.flatMap(b => BELIEF_TYPE_TO_PROCESSES[b.beliefType] ?? [])
      ),
    ];

    // Only surface exercises that exist in the catalog AND match the active
    // modality ("both" always qualifies). An unseeded catalog disables the
    // filter rather than silencing recommendations entirely.
    const allowedIds =
      catalog.length > 0
        ? new Set(
            catalog
              .filter((e) => e.modality === modality || e.modality === "both")
              .map((e) => e.id),
          )
        : null;

    // Detect a structured exercise recommendation and emit it as an event.
    const recommendedExercise = detectRecommendedExercise(fullResponse, activeProcesses, allowedIds);
    if (recommendedExercise) {
      res.write(`data: ${JSON.stringify({ recommendedExercise })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
