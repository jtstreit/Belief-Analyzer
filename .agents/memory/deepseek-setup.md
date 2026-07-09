---
name: DeepSeek via OpenAI client
description: How to call DeepSeek from the API server — client, model string, base URL.
---

## Rule
Use `openai` from `@workspace/integrations-openai-ai-server`. Do NOT import
openai directly or instantiate a new OpenAI client. The integration package
already configures `baseURL: https://api.deepseek.com/v1` and reads `OPENAI_API_KEY`.

**Why:** The Replit secrets integration handles the key; the package already
configures the DeepSeek base URL.

## How to apply
```typescript
import { openai } from "@workspace/integrations-openai-ai-server";

const res = await openai.chat.completions.create({
  model: "deepseek-ai/DeepSeek-V4-Pro",
  max_completion_tokens: 3000,
  messages: [...],
});
```

Existing usage: `artifacts/api-server/src/routes/patterns.ts` and `cognitive.ts`.
