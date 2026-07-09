import { Router, type IRouter } from "express";
import healthRouter from "./health";
import telemetryRouter from "./telemetry";
import beliefsRouter from "./beliefs";
import patternsRouter from "./patterns";
import cognitiveRouter from "./cognitive";
import openaiRouter from "./openai/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(telemetryRouter);
router.use(beliefsRouter);
router.use(patternsRouter);
router.use(cognitiveRouter);
router.use(openaiRouter);

export default router;
