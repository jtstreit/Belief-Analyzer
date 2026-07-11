import { Router } from "express";
import { db, exerciseSessions, exercisesTable } from "@workspace/db";
import { eq, desc, and, asc, or } from "drizzle-orm";

const router = Router();

// List exercise definitions — DB is the source of truth for the catalog
router.get("/exercises", async (req, res) => {
  try {
    const modality = req.query["modality"] as string | undefined;

    const rows = await db
      .select()
      .from(exercisesTable)
      .where(
        modality
          ? or(eq(exercisesTable.modality, modality), eq(exercisesTable.modality, "both"))
          : undefined,
      )
      .orderBy(asc(exercisesTable.sortOrder));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list exercises");
    res.status(500).json({ error: "Failed to fetch exercises" });
  }
});

// List exercise sessions
router.get("/exercise-sessions", async (req, res) => {
  try {
    const exerciseId = req.query["exerciseId"] as string | undefined;
    const modality = req.query["modality"] as string | undefined;
    const completed = req.query["completed"] as string | undefined;

    const conditions = [];
    if (exerciseId) conditions.push(eq(exerciseSessions.exerciseId, exerciseId));
    if (modality) conditions.push(eq(exerciseSessions.modality, modality));
    if (completed !== undefined) {
      conditions.push(eq(exerciseSessions.completed, completed === "true"));
    }

    const rows = await db
      .select()
      .from(exerciseSessions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(exerciseSessions.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list exercise sessions");
    res.status(500).json({ error: "Failed to fetch exercise sessions" });
  }
});

// Create exercise session
router.post("/exercise-sessions", async (req, res) => {
  try {
    const { exerciseId, modality, stepData, moodBefore, moodAfter, sudsRating, notes, completed } =
      req.body;

    if (!exerciseId || typeof exerciseId !== "string") {
      res.status(400).json({ error: "exerciseId is required" });
      return;
    }
    if (!modality || typeof modality !== "string") {
      res.status(400).json({ error: "modality is required" });
      return;
    }

    const [session] = await db
      .insert(exerciseSessions)
      .values({
        exerciseId,
        modality,
        stepData: stepData ?? null,
        moodBefore: moodBefore ?? null,
        moodAfter: moodAfter ?? null,
        sudsRating: sudsRating ?? null,
        notes: notes ?? null,
        completed: completed ?? false,
      })
      .returning();

    res.status(201).json(session);
  } catch (err) {
    req.log.error({ err }, "Failed to create exercise session");
    res.status(500).json({ error: "Failed to create exercise session" });
  }
});

// Get exercise session
router.get("/exercise-sessions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [session] = await db
      .select()
      .from(exerciseSessions)
      .where(eq(exerciseSessions.id, id));

    if (!session) {
      res.status(404).json({ error: "Exercise session not found" });
      return;
    }

    res.json(session);
  } catch (err) {
    req.log.error({ err }, "Failed to get exercise session");
    res.status(500).json({ error: "Failed to fetch exercise session" });
  }
});

// Update exercise session (save progress / complete)
router.patch("/exercise-sessions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    const body = req.body as Record<string, unknown>;
    if ("stepData" in body) updateData["stepData"] = body["stepData"];
    if ("moodBefore" in body) updateData["moodBefore"] = body["moodBefore"];
    if ("moodAfter" in body) updateData["moodAfter"] = body["moodAfter"];
    if ("sudsRating" in body) updateData["sudsRating"] = body["sudsRating"];
    if ("notes" in body) updateData["notes"] = body["notes"];
    if ("completed" in body) updateData["completed"] = body["completed"];

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(exerciseSessions)
      .set(updateData)
      .where(eq(exerciseSessions.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Exercise session not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update exercise session");
    res.status(500).json({ error: "Failed to update exercise session" });
  }
});

export default router;
