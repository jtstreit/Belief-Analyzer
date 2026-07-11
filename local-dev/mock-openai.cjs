/**
 * Local OpenAI-compatible mock for offline dev/verification.
 *
 * Serves POST /v1/chat/completions (stream + non-stream). Every request's
 * full message payload is appended to local-dev/logs/mock-llm.jsonl so the
 * exact context that reached "Vera" (or the analysis passes) can be inspected
 * — this is the verification seam when no real LLM key is configured.
 *
 * Responses are canned and keyed off the system prompt so the 3-pass
 * cognitive engine and the REBT pattern analyzer receive parseable JSON.
 *
 * Usage:  node local-dev/mock-openai.cjs   (listens on :8090)
 * Then:   AI_INTEGRATIONS_OPENAI_BASE_URL=http://localhost:8090/v1
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.MOCK_LLM_PORT ? Number(process.env.MOCK_LLM_PORT) : 8090;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'mock-llm.jsonl');
fs.mkdirSync(LOG_DIR, { recursive: true });

function logRequest(body) {
  const entry = {
    ts: new Date().toISOString(),
    model: body.model,
    stream: Boolean(body.stream),
    messages: body.messages,
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

/** Pick a canned reply based on what the caller is asking for. */
function cannedContent(body) {
  const system = (body.messages?.find((m) => m.role === 'system')?.content ?? '').toLowerCase();
  const user = (body.messages?.filter((m) => m.role === 'user').map((m) => m.content).join('\n') ?? '');

  // Pass 1 — automatic thought extraction (cognitive engine)
  if (system.includes('extract automatic thoughts')) {
    const count = (user.match(/^\d+\.\s/gm) ?? []).length || 1;
    const thoughts = [];
    for (let i = 1; i <= count; i++) {
      thoughts.push({
        entryIndex: i,
        thoughtText: `I always ruin things and everyone notices (mock ${i})`,
        situation: 'team meeting',
        emotion: 'anxiety',
        intensityPct: 70,
        distortionTags: ['all_or_nothing', 'mind_reading'],
      });
    }
    return JSON.stringify(thoughts);
  }

  // Pass 2 — intermediate belief synthesis
  if (system.includes('synthesise intermediate beliefs')) {
    return JSON.stringify([
      {
        beliefText: 'I must never make mistakes in front of others',
        category: 'rule',
        matchesExistingId: null,
        initialConfidence: 35,
      },
    ]);
  }

  // Pass 3 — core schema inference
  if (system.includes('infer core schemas')) {
    return JSON.stringify([
      {
        schemaText: 'I am fundamentally inadequate',
        domain: 'worthless',
        matchesExistingId: null,
        initialConfidence: 25,
      },
    ]);
  }

  // REBT pattern analyzer (/patterns/analyze)
  if (system.includes('rebt expert')) {
    return JSON.stringify([
      {
        beliefText: 'I must be perfect or I am a failure',
        beliefType: 'should_statements',
        triggerSituation: 'making a mistake at work',
        emotionalConsequence: 'shame and anxiety',
      },
    ]);
  }

  // Vera coach chat — mention a real exercise so recommendation detection fires
  return (
    "That sounds like **demandingness** — a rigid rule you're holding yourself to. " +
    'Where is the evidence that you must never make mistakes? ' +
    'The **ABCDE Worksheet** would be a good next step to dispute this belief.'
  );
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'mock: only POST /v1/chat/completions is implemented' }));
    return;
  }

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    logRequest(body);
    const content = cannedContent(body);
    const id = 'chatcmpl-mock-' + Date.now();

    if (body.stream) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const words = content.split(' ');
      let i = 0;
      const tick = setInterval(() => {
        if (i < words.length) {
          const chunk = {
            id,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: (i ? ' ' : '') + words[i] }, finish_reason: null }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          i++;
        } else {
          const done = {
            id,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          };
          res.write(`data: ${JSON.stringify(done)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          clearInterval(tick);
        }
      }, 15);
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id,
          object: 'chat.completion',
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`mock-openai listening on http://localhost:${PORT}/v1 — log: ${LOG_FILE}`);
});
