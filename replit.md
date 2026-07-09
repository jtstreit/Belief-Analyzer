# REBT Companion

A mobile app that passively captures phone telemetry and thought check-ins, uses an LLM to identify irrational belief patterns (REBT types: catastrophizing, awfulizing, low frustration tolerance, global rating, should statements), and challenges them via a streaming REBT coaching chat interface.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `OPENAI_API_KEY` — OpenAI API key for LLM features

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native), expo-router, @tanstack/react-query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- LLM: OpenAI gpt-4o-mini via `@workspace/integrations-openai-ai-server`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — Drizzle table definitions (beliefs, telemetry_events, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers (beliefs, telemetry, patterns, openai)
- `artifacts/rebt-app/app/` — Expo screens (tabs: home, checkin, beliefs, coach; stacks: belief/[id], coach-session/[id])
- `artifacts/rebt-app/constants/colors.ts` — design tokens (midnight navy + amber palette)

## Architecture decisions

- OpenAI integration uses `OPENAI_API_KEY` directly (user provides own key); fallback from `AI_INTEGRATIONS_OPENAI_API_KEY`
- All three AI lib clients (client.ts, image/client.ts, audio/client.ts) patched to support both env var patterns
- Belief pattern analysis reads both `thought_entry` and `mood_checkin` events that have non-null thoughtText
- SSE streaming chat: coach-session screen uses `expo/fetch` with `reactNative: { textStreaming: true }` for cross-platform streaming

## Product

- **Home** — dashboard with greeting, stats (active beliefs, streak, resolved), recent beliefs
- **Check-In** — mood picker (5 states) + thought journal; "Analyze My Thoughts" triggers LLM pattern detection
- **Beliefs** — filterable list of identified irrational beliefs with type badges and status
- **Coach** — list of REBT coaching conversations; start new sessions
- **Belief Detail** — full belief view with "Challenge this belief" → creates coaching conversation
- **Coach Session** — streaming REBT chat with Vera (gpt-4o-mini), inverted FlatList, amber/indigo message bubbles

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` then `pnpm --filter @workspace/db run push`
- The AI server lib clients (image, audio, main) all require either `AI_INTEGRATIONS_OPENAI_API_KEY` or `OPENAI_API_KEY` to be set
- SSE endpoints are not type-safe via Orval — consume with raw `fetch` + `ReadableStream`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
