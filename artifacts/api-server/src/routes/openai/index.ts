import { Router } from "express";
import {
  db,
  conversations as convTable,
  messages as msgTable,
  beliefsTable,
  automaticThoughtsTable,
  intermediateBeliefsCogTable,
  exerciseSessions,
  exercisesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { veraComplete } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { buildConversationFocusBlock } from "./conversation-focus";
import {
  exerciseModalityForApproach,
  getCoachingSystemPrompt,
  normalizeCoachingApproach,
} from "./coaching-prompts";

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
  { id: 'cbt-quick-examine-evidence', title: 'Examine the Evidence', keywords: ['examine the evidence'], targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'overgeneralization', 'mental_filter'] },
  { id: 'cbt-quick-distortions', title: 'Identify & Explain Distortions', keywords: ['identify and explain distortions', 'identify & explain distortions'], targetProcesses: ['automatic_thoughts', 'cognitive_distortions'] },
  { id: 'cbt-quick-be-specific', title: 'Be Specific', keywords: ['be specific'], targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'overgeneralization', 'labeling'] },
  { id: 'cbt-quick-shades-of-gray', title: 'Thinking in Shades of Gray', keywords: ['thinking in shades of gray', 'shades of gray', 'shades of grey'], targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'all_or_nothing'] },
  { id: 'cbt-quick-define-terms', title: 'Define Terms', keywords: ['define terms', 'semantic method'], targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'labeling', 'global_rating'] },
  { id: 'cbt-quick-double-standard', title: 'Double-Standard Technique', keywords: ['double-standard technique', 'double standard technique'], targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'global_rating'] },
  { id: 'cbt-quick-cost-benefit', title: 'Cost-Benefit Analysis', keywords: ['cost-benefit analysis', 'cost benefit analysis'], targetProcesses: ['intermediate_beliefs', 'demandingness', 'should_statements'] },
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

function getSystemPrompt(modality?: string): string {
  return getCoachingSystemPrompt(modality);
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

    const createInput = parsed.data as typeof parsed.data & {
      intermediateBeliefId?: number;
      coachingApproach?: string;
    };
    const beliefId = createInput.beliefId;
    const automaticThoughtId = createInput.automaticThoughtId;
    const intermediateBeliefId = createInput.intermediateBeliefId;
    const approach = normalizeCoachingApproach(
      createInput.coachingApproach ?? createInput.modality,
    );
    if (
      [beliefId, automaticThoughtId, intermediateBeliefId].filter(
        (value) => value != null,
      ).length > 1
    ) {
      res.status(400).json({
        error:
          "Choose one focus: a belief, an automatic thought, or an intermediate belief",
      });
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
    const [selectedIntermediateBelief] = intermediateBeliefId
      ? await db
          .select()
          .from(intermediateBeliefsCogTable)
          .where(eq(intermediateBeliefsCogTable.id, intermediateBeliefId))
      : [];
    if (beliefId && !selectedBelief) {
      res.status(404).json({ error: "Selected belief not found" });
      return;
    }
    if (automaticThoughtId && !selectedThought) {
      res.status(404).json({ error: "Selected automatic thought not found" });
      return;
    }
    if (intermediateBeliefId && !selectedIntermediateBelief) {
      res.status(404).json({ error: "Selected intermediate belief not found" });
      return;
    }
    if (selectedThought && selectedThought.reviewStatus !== "endorsed") {
      res.status(409).json({
        error: "Mark this automatic thought as yours before working on it",
      });
      return;
    }
    if (
      selectedIntermediateBelief &&
      selectedIntermediateBelief.status !== "active"
    ) {
      res.status(409).json({
        error: "This intermediate belief has been dismissed",
      });
      return;
    }
    if (
      selectedIntermediateBelief &&
      selectedIntermediateBelief.reviewStatus !== "endorsed"
    ) {
      res.status(409).json({
        error: "Mark this intermediate belief as ringing true before working on it",
      });
      return;
    }

    const [conv] = await db
      .insert(convTable)
      .values({
        title: parsed.data.title,
        selectedBeliefId: beliefId ?? null,
        selectedAutomaticThoughtId: automaticThoughtId ?? null,
        selectedIntermediateBeliefId: intermediateBeliefId ?? null,
        coachingApproach: approach,
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

        const openingContent = approach === "rebt"
          ? `The selected focus is a possible **${selectedBelief.beliefType.replace(/_/g, " ")}** pattern: "${selectedBelief.beliefText}".

${selectedBelief.triggerSituation ? `It may come up when ${selectedBelief.triggerSituation}.` : ""}

Use the **REBT model** to test it. What happened in one recent example (A), and what did you feel or do (C)?`
          : approach === "team_cbt"
            ? `The selected focus is a possible **${selectedBelief.beliefType.replace(/_/g, " ")}** pattern: "${selectedBelief.beliefText}".

${selectedBelief.triggerSituation ? `It may come up when ${selectedBelief.triggerSituation}.` : ""}

Before choosing a method, I want to understand what this belief does for you as well as what it costs. What would you most like to change about its effect on you?`
            : `The selected focus is a possible **${selectedBelief.beliefType.replace(/_/g, " ")}** pattern: "${selectedBelief.beliefText}".

${selectedBelief.triggerSituation ? `It may come up when ${selectedBelief.triggerSituation}.` : ""}

Using **Beckian guided discovery**, what is one recent, specific situation where this belief was active, and how strongly did you believe it (0–100)?`;

        await db.insert(msgTable).values({
          conversationId: conv.id,
          role: "assistant",
          content: openingContent,
        });
    } else if (automaticThoughtId && selectedThought) {
      const openingContent =
        approach === "rebt"
          ? `You marked this automatic thought as one you actually had: "${selectedThought.thoughtText}".

${selectedThought.situation ? `Possible situation: ${selectedThought.situation}.` : ""}

Using REBT, what rigid demand, awfulizing, frustration-intolerance, or global rating might sit inside this thought—and what emotion or action followed?`
          : approach === "team_cbt"
            ? `You marked this automatic thought as one you actually had: "${selectedThought.thoughtText}".

${selectedThought.situation ? `Possible situation: ${selectedThought.situation}.` : ""}

Before we pick a method, what feels most painful about this thought, and is there anything positive, protective, or understandable about believing it?`
            : `You marked this automatic thought as one you actually had: "${selectedThought.thoughtText}".

${selectedThought.situation ? `Possible situation: ${selectedThought.situation}.` : ""}

Using Beckian guided discovery, how strongly did you believe it (0–100) in one recent specific moment, and what would you like to understand or change about it?`;
      await db.insert(msgTable).values({
        conversationId: conv.id,
        role: "assistant",
        content: openingContent,
      });
    } else if (intermediateBeliefId && selectedIntermediateBelief) {
      const openingContent =
        approach === "rebt"
          ? `You marked this intermediate belief as one that rings true: "${selectedIntermediateBelief.beliefText}".

We will still treat it as a hypothesis. In one recent activating event (A), what did this belief say had to happen—or must not happen—and what emotional or behavioral consequence (C) followed?`
          : approach === "team_cbt"
            ? `You marked this intermediate belief as one that rings true: "${selectedIntermediateBelief.beliefText}".

Before choosing a Burns method, what would you most like to change about its impact—and what advantages or protection might this rule or assumption currently give you?`
            : `You marked this intermediate belief as one that rings true: "${selectedIntermediateBelief.beliefText}".

Using Beckian guided discovery, what is one recent specific situation where this rule or assumption was active, how strongly did you believe it (0–100), and what happened next?`;
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

    const [focusedThoughtRows, focusedIntermediateBeliefRows] =
      await Promise.all([
        conv.selectedAutomaticThoughtId
          ? db
              .select()
              .from(automaticThoughtsTable)
              .where(
                eq(
                  automaticThoughtsTable.id,
                  conv.selectedAutomaticThoughtId,
                ),
              )
          : Promise.resolve([]),
        conv.selectedIntermediateBeliefId
          ? db
              .select()
              .from(intermediateBeliefsCogTable)
              .where(
                eq(
                  intermediateBeliefsCogTable.id,
                  conv.selectedIntermediateBeliefId,
                ),
              )
          : Promise.resolve([]),
      ]);
    const focusedThought = focusedThoughtRows[0];
    const focusedIntermediateBelief = focusedIntermediateBeliefRows[0];

    if (
      conv.selectedAutomaticThoughtId &&
      focusedThought?.reviewStatus !== "endorsed"
    ) {
      res.status(409).json({
        error:
          "This automatic thought is no longer marked as yours. Choose another endorsed focus to continue.",
      });
      return;
    }

    if (
      conv.selectedIntermediateBeliefId &&
      (focusedIntermediateBelief?.status !== "active" ||
        focusedIntermediateBelief.reviewStatus !== "endorsed")
    ) {
      res.status(409).json({
        error:
          "This intermediate belief is no longer marked as ringing true. Choose another endorsed focus to continue.",
      });
      return;
    }

    // Save user message
    await db.insert(msgTable).values({
      conversationId: id,
      role: "user",
      content: parsed.data.content,
    });

    // Fetch full history + memory context in parallel
    const requestedApproach = (
      parsed.data as { modality?: string; coachingApproach?: string }
    ).coachingApproach ?? (parsed.data as { modality?: string }).modality;
    const approach = normalizeCoachingApproach(
      conv.coachingApproach ?? requestedApproach,
    );
    const exerciseContext = (parsed.data as { exerciseContext?: string }).exerciseContext;

    const [
      history,
      allBeliefs,
      allIntermediateBeliefs,
      pastConvos,
      recentExercises,
      catalog,
    ] = await Promise.all([
      db.select().from(msgTable).where(eq(msgTable.conversationId, id)).orderBy(msgTable.createdAt),
      db.select().from(beliefsTable).orderBy(desc(beliefsTable.createdAt)),
      db
        .select()
        .from(intermediateBeliefsCogTable)
        .orderBy(desc(intermediateBeliefsCogTable.updatedAt)),
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
    const focusBlock = buildConversationFocusBlock(
      focusedBelief,
      focusedThought,
      focusedIntermediateBelief,
    );

    // Build persistent memory block
    const activeBeliefs = allBeliefs.filter(b => b.status === "active");
    const challengedBeliefs = allBeliefs.filter(b => b.status === "challenged");
    const resolvedBeliefs = allBeliefs.filter(b => b.status === "resolved");
    const endorsedIntermediateBeliefs = allIntermediateBeliefs.filter(
      (belief) =>
        belief.status === "active" && belief.reviewStatus === "endorsed",
    );

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
          if (key.startsWith("__")) continue;
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
      endorsedIntermediateBeliefs.length > 0
        ? `### User-endorsed intermediate-belief hypotheses\n${endorsedIntermediateBeliefs
            .map(
              (belief) =>
                `  - ${belief.category}: "${belief.beliefText}" (model support ${belief.confidence}%)`,
            )
            .join("\n")}`
        : "",
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

    const basePrompt = getSystemPrompt(approach);
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
        [
          ...activeBeliefs.flatMap(
            (belief) =>
              BELIEF_TYPE_TO_PROCESSES[belief.beliefType] ?? [],
          ),
          ...endorsedIntermediateBeliefs.flatMap((belief) => [
            "intermediate_beliefs",
            belief.category,
          ]),
          ...(focusedThought?.distortionTags ?? []).flatMap(
            (tag) =>
              BELIEF_TYPE_TO_PROCESSES[tag] ?? [
                "automatic_thoughts",
                "cognitive_distortions",
              ],
          ),
        ],
      ),
    ];

    // Only surface exercises that exist in the catalog AND match the active
    // modality ("both" always qualifies). An unseeded catalog disables the
    // filter rather than silencing recommendations entirely.
    const exerciseModality = exerciseModalityForApproach(approach);
    const allowedIds =
      catalog.length > 0
        ? new Set(
            catalog
              .filter(
                (exercise) =>
                  exercise.modality === exerciseModality ||
                  exercise.modality === "both",
              )
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
