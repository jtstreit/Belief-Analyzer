import { Router } from "express";
import { db, telemetryEventsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { CreateTelemetryBody } from "@workspace/api-zod";

const router = Router();

router.get("/telemetry", async (req, res) => {
  try {
    const limit = req.query["limit"] ? parseInt(req.query["limit"] as string) : 50;
    const type = req.query["type"] as string | undefined;

    let events;
    if (type) {
      events = await db
        .select()
        .from(telemetryEventsTable)
        .where(eq(telemetryEventsTable.type, type))
        .orderBy(desc(telemetryEventsTable.createdAt))
        .limit(limit);
    } else {
      events = await db
        .select()
        .from(telemetryEventsTable)
        .orderBy(desc(telemetryEventsTable.createdAt))
        .limit(limit);
    }

    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to list telemetry events");
    res.status(500).json({ error: "Failed to fetch telemetry events" });
  }
});

router.post("/telemetry", async (req, res) => {
  try {
    const parsed = CreateTelemetryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [event] = await db
      .insert(telemetryEventsTable)
      .values({
        type: parsed.data.type,
        mood: parsed.data.mood ?? null,
        thoughtText: parsed.data.thoughtText ?? null,
      })
      .returning();

    res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "Failed to create telemetry event");
    res.status(500).json({ error: "Failed to create telemetry event" });
  }
});

export default router;
