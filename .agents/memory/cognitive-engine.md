---
name: Cognitive Engine Design
description: 3-pass LLM pipeline for REBT cognitive conceptualization; idempotency rules and pass ordering.
---

## Rule
Pass 2 (intermediate beliefs) and Pass 3 (core schemas) must ALWAYS run on every
`POST /cognitive/analyze` call — they operate on all existing DB rows, not just
the current batch.

**Why:** If Pass 1 runs but Pass 2/3 are skipped (e.g. due to early return), the
system accumulates automatic thoughts that never surface as beliefs. Pass 2/3 are
cheap reads; always run them.

## Rule
Events with content are marked processed ONLY inside a DB transaction after thoughts are inserted.
Events without meaningful text are marked processed eagerly (nothing to retry).

**Why:** Marking ALL events processed before LLM calls means an LLM failure silently
drops those events — they can never be retried. The transaction makes Pass 1 atomic:
if insertion or the LLM call throws, the transaction rolls back and events stay retryable.

## How to apply
In `artifacts/api-server/src/routes/cognitive.ts`:
1. Fetch unprocessed events (`isNull(processedAt)`)
2. Split into `withContent` and `withoutContent`
3. Mark `withoutContent` processed eagerly (no retry value)
4. Call the LLM (`veraComplete`) for `withContent` (let errors propagate to catch — events stay retryable)
5. `db.transaction()`: insert thoughts + mark `withContent` events processed atomically
6. Run Pass 2 always (from DB — all thoughts)
7. Run Pass 3 always (from DB — all intermediate beliefs)
8. Return `buildMindMap()`
