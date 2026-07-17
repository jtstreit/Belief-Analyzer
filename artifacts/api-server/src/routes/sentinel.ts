import { Router } from "express";
import { getLifeOpsStatus, syncLifeOps } from "../lib/lifeops-adapter";

const router = Router();

router.get("/sentinel/status", (_req, res) => {
  res.json(getLifeOpsStatus());
});

router.post("/sentinel/sync", async (req, res) => {
  try {
    res.json(await syncLifeOps());
  } catch (error) {
    req.log.error({ error }, "LifeOps sync request failed");
    res.status(502).json({ error: "LifeOps sync failed" });
  }
});

export default router;
