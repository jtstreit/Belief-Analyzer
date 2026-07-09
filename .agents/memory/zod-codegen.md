---
name: Zod v3 codegen constraint
description: Bare `type: object` in OpenAPI spec generates zod.looseObject() which only exists in Zod v4 — breaks codegen.
---

## Rule
Never use bare `type: object` (no properties defined) for request/response fields
in `lib/api-spec/openapi.yaml`. Instead, either define explicit properties or
omit the field entirely.

**Why:** orval generates `zod.looseObject({})` for bare object types, which is
Zod v4 only. The workspace uses Zod v3 for the api-zod package, so codegen
produces code that fails the lib typecheck (`tsc --build`).

## How to apply
- If a field is truly dynamic/arbitrary JSON, use `additionalProperties: true`
  with a defined base type, or omit it from the OpenAPI spec and handle it
  outside the contract.
- Run `pnpm --filter @workspace/api-spec run codegen` after every spec change
  to catch this immediately.

Caused a broken codegen for `metadata: { type: object }` in `TelemetryEventInput`.
Fix: removed `metadata` from the schema.
