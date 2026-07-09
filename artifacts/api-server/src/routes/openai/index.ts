import { Router } from "express";
import { db, conversations as convTable, messages as msgTable, beliefsTable, exerciseSessions } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";

const router = Router();

// ─────────────────────────────────────────────────────────────
// REBT system prompt — Ellis's ABC(DE) model
// ─────────────────────────────────────────────────────────────
const REBT_SYSTEM_PROMPT = `You are a warm, skilled REBT (Rational Emotive Behavior Therapy) coach named Vera, trained in Albert Ellis's model.

**Your clinical framework — REBT:**
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
- For behavioral change → Behavioral Activation, Exposure Hierarchy`;

// ─────────────────────────────────────────────────────────────
// CBT system prompt — Beck / Burns / Greenberger & Padesky
// ─────────────────────────────────────────────────────────────
const CBT_SYSTEM_PROMPT = `You are a warm, skilled CBT (Cognitive Behavioural Therapy) coach named Vera, trained in Aaron Beck's model and informed by David Burns and Greenberger & Padesky.

**Your clinical framework — Beckian CBT:**
- Situation → Automatic Thoughts → Emotion/Behaviour, with underlying Intermediate Beliefs (rules, attitudes, assumptions) and Core Beliefs (schemas: helpless / unlovable / worthless)
- Work collaboratively and empirically — beliefs are hypotheses to be tested, not facts

**Cognitive distortions you identify (Burns' ten):**
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
- For anxiety → Exposure Hierarchy, Graded Exposure Session`;

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

    const [conv] = await db
      .insert(convTable)
      .values({ title: parsed.data.title })
      .returning();

    if (!conv) {
      res.status(500).json({ error: "Failed to create conversation" });
      return;
    }

    // If a beliefId is provided, link belief and send opening message
    const beliefId = (parsed.data as { beliefId?: number }).beliefId;
    const modality = (parsed.data as { modality?: string }).modality ?? "rebt";

    if (beliefId) {
      const [belief] = await db
        .select()
        .from(beliefsTable)
        .where(eq(beliefsTable.id, beliefId));

      if (belief) {
        await db
          .update(beliefsTable)
          .set({ conversationId: conv.id })
          .where(eq(beliefsTable.id, beliefId));

        const isREBT = modality !== "cbt";
        const openingContent = isREBT
          ? `I can see you've been experiencing a pattern of **${belief.beliefType.replace(/_/g, " ")}**. The belief that "${belief.beliefText}" sounds like it's been difficult to carry.

${belief.triggerSituation ? `It seems this often comes up when ${belief.triggerSituation}.` : ""}

I'd like to work through this using the **REBT model**. Can you tell me about a recent time this belief showed up — what was happening (A), what you felt (C)?`
          : `I can see you've been experiencing a pattern related to **${belief.beliefType.replace(/_/g, " ")}**. The thought "${belief.beliefText}" sounds like it's been causing you distress.

${belief.triggerSituation ? `It seems this often comes up when ${belief.triggerSituation}.` : ""}

I'd like to explore this using a **CBT approach** — examining the evidence for and against this thought. Can you tell me about a recent specific situation where this came up?`;

        await db.insert(msgTable).values({
          conversationId: conv.id,
          role: "assistant",
          content: openingContent,
        });
      }
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

    const [history, allBeliefs, pastConvos, recentExercises] = await Promise.all([
      db.select().from(msgTable).where(eq(msgTable.conversationId, id)).orderBy(msgTable.createdAt),
      db.select().from(beliefsTable).orderBy(desc(beliefsTable.createdAt)),
      db.select().from(msgTable)
        .where(eq(msgTable.role, "assistant"))
        .orderBy(desc(msgTable.createdAt))
        .limit(6),
      db.select().from(exerciseSessions)
        .where(eq(exerciseSessions.completed, true))
        .orderBy(desc(exerciseSessions.createdAt))
        .limit(5),
    ]);

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

    const completedExerciseLines = recentExercises.map(s =>
      `  - Completed "${s.exerciseId}" (${s.modality.toUpperCase()})${s.moodBefore != null && s.moodAfter != null ? `, mood ${s.moodBefore}→${s.moodAfter}/10` : ""}`
    );

    const memoryBlock = [
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

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "deepseek-ai/DeepSeek-V4-Pro",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPromptWithMemory },
        ...chatMessages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Save assistant response
    await db.insert(msgTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

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
