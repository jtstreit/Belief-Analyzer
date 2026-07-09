import { Router } from "express";
import { db, beliefsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateBeliefBody, UpdateBeliefBody } from "@workspace/api-zod";

const router = Router();

router.get("/beliefs", async (req, res) => {
  try {
    const status = req.query["status"] as string | undefined;
    const beliefType = req.query["beliefType"] as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(beliefsTable.status, status));
    if (beliefType) conditions.push(eq(beliefsTable.beliefType, beliefType));

    const beliefs = await db
      .select()
      .from(beliefsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(beliefsTable.createdAt));
    res.json(beliefs);
  } catch (err) {
    req.log.error({ err }, "Failed to list beliefs");
    res.status(500).json({ error: "Failed to fetch beliefs" });
  }
});

router.post("/beliefs", async (req, res) => {
  try {
    const parsed = CreateBeliefBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [belief] = await db
      .insert(beliefsTable)
      .values({
        beliefText: parsed.data.beliefText,
        beliefType: parsed.data.beliefType,
        triggerSituation: parsed.data.triggerSituation ?? null,
        emotionalConsequence: parsed.data.emotionalConsequence ?? null,
        status: parsed.data.status ?? "active",
        conversationId: parsed.data.conversationId ?? null,
      })
      .returning();

    res.status(201).json(belief);
  } catch (err) {
    req.log.error({ err }, "Failed to create belief");
    res.status(500).json({ error: "Failed to create belief" });
  }
});

router.get("/beliefs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [belief] = await db
      .select()
      .from(beliefsTable)
      .where(eq(beliefsTable.id, id));

    if (!belief) {
      res.status(404).json({ error: "Belief not found" });
      return;
    }

    res.json(belief);
  } catch (err) {
    req.log.error({ err }, "Failed to get belief");
    res.status(500).json({ error: "Failed to fetch belief" });
  }
});

router.patch("/beliefs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateBeliefBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updateData["status"] = parsed.data.status;
    if (parsed.data.conversationId !== undefined) updateData["conversationId"] = parsed.data.conversationId;
    if (parsed.data.beliefText !== undefined) updateData["beliefText"] = parsed.data.beliefText;
    if (parsed.data.triggerSituation !== undefined) updateData["triggerSituation"] = parsed.data.triggerSituation;
    if (parsed.data.emotionalConsequence !== undefined) updateData["emotionalConsequence"] = parsed.data.emotionalConsequence;

    const [updated] = await db
      .update(beliefsTable)
      .set(updateData)
      .where(eq(beliefsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Belief not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update belief");
    res.status(500).json({ error: "Failed to update belief" });
  }
});

export default router;
