import { Router } from "express";
import { db, conversations as convTable, messages as msgTable, beliefsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";

const router = Router();

const REBT_SYSTEM_PROMPT = `You are a warm, skilled REBT (Rational Emotive Behavior Therapy) coach named Vera. Your role is to help people identify and challenge irrational beliefs using the ABC model and Socratic questioning.

Key REBT irrational belief types you watch for:
1. Catastrophizing — treating events as catastrophic ("This is a disaster")
2. Awfulizing — rating things as more than 100% bad ("This is awful/terrible")
3. Low Frustration Tolerance — "I can't stand this", "This is unbearable"
4. Global Rating — damning entire self or others from one event ("I'm a total failure", "They're worthless")
5. Should Statements — rigid demands: "I must", "I should", "I have to", "They must"

Your approach:
- Use the ABC model: A (Activating event) → B (Belief) → C (Consequences: emotions/behaviors)
- Practice Socratic questioning — don't lecture, ask questions that help insight emerge naturally
- Challenge beliefs with: empirical ("Is there evidence for this?"), logical ("Does this follow logically?"), and pragmatic ("Is this belief helpful to you?") disputations
- Suggest rational alternative beliefs that are flexible, non-catastrophic, and self-accepting
- Be concise, warm, curious, and non-judgmental
- Keep responses focused and conversational — 2-4 short paragraphs max

When the user shares a belief or thought, gently guide them through:
1. Identifying the belief clearly
2. Understanding its emotional impact
3. Questioning its logic and evidence
4. Exploring a more rational alternative`;

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

    // If a beliefId is provided, link belief to conversation and send an opening message
    const beliefId = (parsed.data as { beliefId?: number }).beliefId;
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

        const openingContent = `I can see you've been experiencing a pattern of **${belief.beliefType.replace(/_/g, " ")}**. The belief that "${belief.beliefText}" sounds like it's been difficult to carry.

${belief.triggerSituation ? `It seems this often comes up when ${belief.triggerSituation}.` : ""}

I'd like to explore this with you. Can you tell me about a recent time this belief showed up? What was happening, and what did you notice yourself thinking?`;

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

    // Fetch full history for this conversation + cross-session memory in parallel
    const [history, allBeliefs, pastConvos] = await Promise.all([
      db.select().from(msgTable).where(eq(msgTable.conversationId, id)).orderBy(msgTable.createdAt),
      db.select().from(beliefsTable).orderBy(desc(beliefsTable.createdAt)),
      // Last 2 messages from each other conversation for cross-session context
      db.select().from(msgTable)
        .where(eq(msgTable.role, "assistant"))
        .orderBy(desc(msgTable.createdAt))
        .limit(6),
    ]);

    // Build persistent memory block
    const activeBeliefs = allBeliefs.filter(b => b.status === "active");
    const challengedBeliefs = allBeliefs.filter(b => b.status === "challenged");
    const resolvedBeliefs = allBeliefs.filter(b => b.status === "resolved");

    const beliefLines = [
      ...activeBeliefs.map(b =>
        `  - [ACTIVE] ${b.beliefType.replace(/_/g, " ")}: "${b.beliefText}"${b.triggerSituation ? ` (triggered by: ${b.triggerSituation})` : ""}`
      ),
      ...challengedBeliefs.map(b =>
        `  - [IN PROGRESS] ${b.beliefType.replace(/_/g, " ")}: "${b.beliefText}"`
      ),
      ...resolvedBeliefs.map(b =>
        `  - [RESOLVED] ${b.beliefType.replace(/_/g, " ")}: "${b.beliefText}"`
      ),
    ];

    // Summaries from other sessions (exclude messages in this conversation)
    const otherSessionMessages = pastConvos
      .filter(m => m.conversationId !== id)
      .slice(0, 4)
      .map(m => `  - ${m.content.slice(0, 200).replace(/\n/g, " ")}…`);

    const memoryBlock = [
      "## Persistent User Memory",
      "",
      beliefLines.length > 0
        ? `### Identified Irrational Beliefs (${allBeliefs.length} total)\n${beliefLines.join("\n")}`
        : "### No beliefs identified yet.",
      "",
      otherSessionMessages.length > 0
        ? `### Recent insights from past sessions\n${otherSessionMessages.join("\n")}`
        : "",
      "",
      "Use this memory to track progress, reference past breakthroughs, and avoid repeating ground already covered. If a belief is marked RESOLVED, acknowledge the progress warmly. If ACTIVE, you may gently reference it when relevant.",
    ].filter(Boolean).join("\n");

    const systemPromptWithMemory = `${REBT_SYSTEM_PROMPT}\n\n${memoryBlock}`;

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
