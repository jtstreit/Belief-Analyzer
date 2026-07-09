---
name: Dual-modality therapy engine
description: Architecture and decisions for REBT/CBT modality toggle, exercise catalog, session storage, and modality-aware coach.
---

# Dual-modality therapy engine

## Modality preference
Stored in AsyncStorage via `ModalityContext` (`artifacts/rebt-app/contexts/ModalityContext.tsx`). No DB column — client-side only. Passed as `modality` field in the send-message body (`POST /api/openai/conversations/:id/messages`).

**Why:** Simplest approach; modality is a per-device UX preference, not a per-conversation or server-side concern.

## Exercise sessions (new DB table)
Table: `exercise_sessions` — columns: exerciseId (text), modality (text), stepData (jsonb), moodBefore/moodAfter (int), sudsRating (int), notes (text), completed (boolean). Pushed via `pnpm --filter @workspace/db push-force`.

**How to apply:** Any future exercise feature reads/writes this table. stepData is a free-form JSON object keyed by step ID — do not assume a fixed shape.

## Exercise catalog
Fully static TypeScript file: `artifacts/rebt-app/constants/exercises.ts`. 13 exercises: 4 REBT, 4 CBT, 5 behavioral/both. No DB backing for catalog definitions — they are code, not data.

**Why:** Exercises are curated, evidence-based content — they change with code, not user input.

## API codegen workflow
OpenAPI spec at `lib/api-spec/openapi.yaml`. Regenerate both clients with:
```
cd lib/api-spec && pnpm dlx orval --config orval.config.ts
```
New exercise-session endpoints were added; zod schemas and react-query hooks are fully generated.

## Coach system prompts
Two separate system prompts in `artifacts/api-server/src/routes/openai/index.ts`:
- `REBT_SYSTEM_PROMPT` — Ellis ABC(DE), four irrational-belief processes, three disputation types, USA/UOA/ULA goals
- `CBT_SYSTEM_PROMPT` — Beck/Burns/Padesky, cognitive distortions, Socratic discovery, thought records, downward arrow

Selected by `modality` field from the request body (`rebt` default if absent).

**How to apply:** Any change to coach personality must go in one or both prompts; never put model-level concepts in the wrong prompt.

## Tab layout
5 tabs: Home | Check-In | Library | Coach | Settings. Beliefs tab is hidden from the tab bar (`href: null`) but still registered so the beliefs route works.

## Exercise runner
`artifacts/rebt-app/app/exercise/[exerciseId].tsx` — gate → step runner → completion. Saves session via `useCreateExerciseSession` on gate completion; updates via `useUpdateExerciseSession` on finish. Step types: text, multiline, rating, suds, mood, choice, info.
