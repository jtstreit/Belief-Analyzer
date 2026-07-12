# HANDOFF — Belief Analyzer: state + next task (LifeOps telemetry adapter)

Written 2026-07-11 by Claude Code for GPT/Codex. Self-contained — assume no other context.

## What this project is

**REBT Belief Analyzer** ("REBT Companion") — Jackson's personal dual-modality (REBT/CBT)
self-coaching app. Expo app (`artifacts/rebt-app`) + Express 5 API (`artifacts/api-server`)
+ Drizzle/Postgres (`lib/db`) in a pnpm workspace. **LLM = Claude Opus 4.8 via the
Claude Agent SDK (MIGRATED 2026-07-12; DeepSeek fully removed).** Every LLM call goes
through `veraComplete` in `lib/integrations-openai-ai-server/src/vera.ts` — never call
a provider client directly. Backend switch: `AI_INTEGRATIONS_OPENAI_BASE_URL` set →
OpenAI-compatible endpoint (the local mock LLM, the verification seam); unset → Claude
Agent SDK using the Max-subscription OAuth token (`CLAUDE_CODE_OAUTH_TOKEN` — zero API
spend; ANTHROPIC_API_KEY is stripped from the subprocess env so it can never bill a
pay-per-token account). Model override env: `VERA_MODEL`. **Replit secrets change on
next pull: add `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`), remove/ignore the
old DeepSeek `OPENAI_API_KEY`; never set `AI_INTEGRATIONS_OPENAI_BASE_URL` in prod.**
API client is Orval-generated from
`lib/api-spec/openapi.yaml` (`pnpm --filter @workspace/api-spec run codegen`).
Coach persona = Vera. The LIVE instance runs on Replit (app "Belief Analyzer",
account streitwieserj92); **Replit Agent is banned (too expensive) — all dev is local.**

## Repo + sync state (IMPORTANT)

- Local canonical repo: `C:\Users\46743\rebt-belief-analyzer` (full git history, branch `main`).
- **Local is ~9 commits ahead of the Replit deployment.** All T0–T11 work-brief tasks are
  DONE and verified locally (typecheck 0 errors, api-server vitest 26/26 + new tests,
  runtime-verified against a local stack incl. mock LLM).
- **Push is BLOCKED**: `origin` = https://github.com/jtstreit/Belief-Analyzer but cached
  credentials are for `streitwieserj92` → 403. Fix: Jackson invites streitwieserj92 as
  collaborator on that repo (or re-auths as jtstreit), then `git push origin main`.
  Fallback: `Downloads\belief-analyzer-updated.zip` (full repo snapshot).
- **After Replit pulls**: run `pnpm install`, `pnpm --filter @workspace/db run push`
  (new tables: `exercises`; new columns: `status`/`dismissed_at` on
  `intermediate_beliefs_cog` + `core_schemas`), then
  `pnpm --filter @workspace/scripts run seed:exercises` (seeds the 13-exercise catalog).
  Without push+seed, the Library shows the offline fallback and GET /exercises is empty.

## Local dev stack (Windows box, all proven working)

- Dot-source `local-dev\env.local.ps1` — sets PATH (portable Node 24 at
  `C:\Users\46743\tools\node-v24.16.0-win-x64`, Git sh), `PORT=8080`,
  `DATABASE_URL=postgresql://postgres@localhost:5544/belief_analyzer`,
  mock-LLM env, `EXPO_PUBLIC_DOMAIN=localhost:8080`.
- Postgres 17.5 portable: `C:\Users\46743\tools\pgsql`, data dir
  `C:\Users\46743\tools\pgsql-data-belief`, port 5544. Start:
  `pg_ctl -D C:\Users\46743\tools\pgsql-data-belief -o "-p 5544" start`. Currently STOPPED.
- Mock LLM (no spend, logs every request payload for seam verification):
  `node local-dev\mock-openai.cjs` (:8090; log at `local-dev\logs\mock-llm.jsonl`).
- API: `cd artifacts\api-server; node ./build.mjs; node --enable-source-maps ./dist/index.mjs`
  (the package `dev` script uses sh syntax that cmd.exe can't run).
- App (web): `cd artifacts\rebt-app; pnpm exec expo start --localhost --port 8081`
  — do NOT set `CI=1` (it silently disables Metro's file watcher; stale bundles).
- Gotchas already solved (don't re-fight): pnpm-workspace.yaml re-allows win32-x64 native
  binaries; drizzle config needs POSIX schema path; RN-web TouchableOpacity ignores
  synthetic JS clicks (use real pointer events / navigate directly to routes).

## NEXT TASK (Jackson chose this): LifeOps → Belief Analyzer telemetry adapter

Goal: feed Sentinel LifeOps' real phone telemetry into the Belief Analyzer's
`telemetry_events` table so the 3-pass cognitive engine (`POST /api/cognitive/analyze`)
runs on real passive data instead of only manual check-ins.

**Source (LifeOps, live on Render):**
- `GET https://sentinel-lifeops-api.onrender.com/api/telemetry`,
  header `x-sentinel-ingest-token` (value: `SENTINEL_INGEST_TOKEN` in
  `C:\Users\46743\sentinel-lifeops\.env`). Returns `{logs:[...]}`, capped ~500 events.
- Event fields: `id, timestamp, source, title, content, capturedAtEpochMillis,
  packageName, metadata`. `source` enum (7): sms | notification | calendar | location |
  app_usage | screen_text | user_note.

**Destination (Belief Analyzer):**
- `POST /api/telemetry/batch` (see `lib/api-spec/openapi.yaml` ~line 82; Zod
  `TelemetryBatchInput` in `lib/api-zod`). Rows land in `telemetry_events`
  (`lib/db/src/schema/telemetry_events.ts`).
- The cognitive engine consumes rows where `processedAt IS NULL` and
  `thoughtText` length > 5 — so map LifeOps `content` (+ `title`) → `thoughtText`,
  keep a `source` label. Rows without meaningful text get marked processed and ignored.

**Design decisions for you (recommendation first):**
1. Prefer a **standalone bridge** (new script/job, e.g. in `scripts/` workspace or a tiny
   Render cron) that pulls from LifeOps and POSTs batches to the Belief Analyzer API.
   Avoids touching either server. A server-side ingest endpoint inside the Belief Analyzer
   is the alternative if Jackson wants push-based flow later.
2. **Dedup is mandatory** (LifeOps re-serves the same ~500-event window): LifeOps `id`s are
   stable — persist them (e.g. in telemetry metadata, or a bridge-side cursor on
   `capturedAtEpochMillis`) and skip already-ingested events.
3. Batch + backoff; both services are small Render instances.

**⚠ HARD CONSTRAINTS:**
- **PHI FILTER IS NON-NEGOTIABLE.** LifeOps telemetry includes raw screen text / SMS /
  notifications from Jackson's WORK phone usage (Credible EHR, Monarch, client content).
  The Belief Analyzer's LLM is an external service with **no BAA — Claude as of the
  2026-07-12 migration; PHI must never reach it.** The adapter
  MUST filter clinical/work content before ingest. LifeOps already has a tested heuristic:
  `isClinicalContent` in `C:\Users\46743\sentinel-lifeops\src\lifeopsRules.ts` — reuse the
  logic (copy it into the bridge; see next bullet). Safest default: ingest only
  `user_note` + `mood/check-in`-like sources at first, gate `screen_text`/`sms`/
  `notification` behind the clinical filter, and drop `location` entirely (no text value).
- **Do NOT edit the `C:\Users\46743\sentinel-lifeops` working tree** — Grok 4.5 is
  actively editing that repo (2026-07-11). Read-only is fine. Also never break LifeOps
  capture (standing hard rule).
- LifeOps' deploy repo is `streitwieserj92/workautomationlab` (OneDrive checkout), NOT the
  sentinel-lifeops folder — only relevant if a LifeOps-side change becomes unavoidable
  (it shouldn't for a pull-based bridge). Fast-forward pushes only there, never force.

**Verification recipes (proven this session):**
- LifeOps AI alive: POST `/api/ask-lifeops` (same token header) `{question:"..."}` →
  response `engine: "claude-agent-sdk"` = healthy; `"local-heuristic"` + warning = broken.
- Belief Analyzer local: seed a LifeOps-shaped event through the bridge → run
  `POST /api/cognitive/analyze` (mock LLM running) → confirm new `automatic_thoughts`
  rows + Mind Map shows them; confirm re-running the bridge ingests 0 duplicates.
- CBT Sentinel (unaffected, but if touched): all routes need `x-cbt-token` header
  (value in `C:\Users\46743\cbt\.env`); AI probe = POST `/ai/analyze-thought` → poll
  `/ai/jobs/:id`.

## What was completed this session (context for "what's already done")

Work brief T0–T11 all verified done locally: T1 types (pre-done by Replit Agent, confirmed),
T2 exercises catalog table + GET /exercises + app wiring w/ offline fallback, T3 patterns
real (pre-done; fixed hardcoded lastAnalyzedAt), T4 exercise→Vera context (pre-done,
verified at seam via mock-LLM log), T5 catalog step-title labels in Vera memory, T6
modality-filtered exercise surfacing, T7 zero-belief cold start (verified), T8
recommendation card moved out of inverted FlatList (scroll-proof), T9 exercise-history
browser on Progress, T10 soft-dismissal (status/dismissedAt columns; prune pass dismisses
instead of deleting; setWhere guards block resurrection; manual dismiss endpoints + UI),
T11 visible analysis-error banners (mindmap + checkin) + confidence decay in the
maintenance pass. Plus: 3 Rules-of-Hooks crashes fixed (hooks in renderItem — beliefs,
library, coach), scheme-aware API origin for local dev, win32 build fixes.
Full commit log: `git log --oneline` in the repo.
