import express from "express";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tables = vi.hoisted(() => ({
  conversations: {
    id: { column: "id" },
    createdAt: { column: "createdAt" },
  } as object,
  messages: {
    conversationId: { column: "conversationId" },
    createdAt: { column: "createdAt" },
  } as object,
  beliefs: { id: { column: "id" } } as object,
  automaticThoughts: { id: { column: "id" } } as object,
  intermediateBeliefs: { id: { column: "id" } } as object,
  exerciseSessions: {
    conversationId: { column: "conversationId" },
    createdAt: { column: "createdAt" },
  } as object,
  exercises: { id: { column: "id" } } as object,
}));

const state = vi.hoisted(() => ({
  rowsByTable: new Map<object, unknown[]>(),
  inserts: [] as Array<{ table: object; values: Record<string, unknown> }>,
  conversationResult: {
    id: 0,
    title: "",
    selectedBeliefId: null,
    selectedAutomaticThoughtId: null,
    selectedIntermediateBeliefId: null,
    coachingApproach: "rebt",
    createdAt: new Date(0),
  } as Record<string, unknown>,
}));

vi.mock("@workspace/db", () => {
  function chain(result: unknown) {
    const promise = Promise.resolve(result) as Promise<unknown> & {
      where: () => unknown;
      orderBy: () => unknown;
      limit: () => unknown;
    };
    promise.where = () => promise;
    promise.orderBy = () => promise;
    promise.limit = () => promise;
    return promise;
  }

  const db = {
    select: vi.fn(() => ({
      from: (table: object) => chain(state.rowsByTable.get(table) ?? []),
    })),
    insert: vi.fn((table: object) => ({
      values: (values: Record<string, unknown>) => {
        state.inserts.push({ table, values });
        if (table === tables.conversations) {
          return {
            returning: () => Promise.resolve([state.conversationResult]),
          };
        }
        return Promise.resolve(undefined);
      },
    })),
  };

  return {
    db,
    conversations: tables.conversations,
    messages: tables.messages,
    beliefsTable: tables.beliefs,
    automaticThoughtsTable: tables.automaticThoughts,
    intermediateBeliefsCogTable: tables.intermediateBeliefs,
    exerciseSessions: tables.exerciseSessions,
    exercisesTable: tables.exercises,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => ({
    operation: "eq",
    column,
    value,
  })),
  desc: vi.fn((column: unknown) => ({ operation: "desc", column })),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  veraComplete: vi.fn(),
}));

const { default: openaiRouter } = await import("./index.js");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, {
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  });
  next();
});
app.use("/api", openaiRouter);

const agent = supertest(app);

function intermediateBelief(reviewStatus: string) {
  return {
    id: 41,
    beliefText: "If I disappoint someone, they will stop respecting me",
    category: "assumption",
    confidence: 82,
    evidenceCount: 6,
    status: "active",
    dismissedAt: null,
    reviewStatus,
    reviewedAt: reviewStatus === "unreviewed" ? null : new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function automaticThought(reviewStatus: string) {
  return {
    id: 52,
    text: "I always let people down",
    reviewStatus,
    reviewedAt: reviewStatus === "unreviewed" ? null : new Date(),
    createdAt: new Date(),
  };
}

beforeEach(() => {
  state.rowsByTable.clear();
  state.inserts.length = 0;
  state.conversationResult = {
    id: 73,
    title: "Work this belief",
    selectedBeliefId: null,
    selectedAutomaticThoughtId: null,
    selectedIntermediateBeliefId: 41,
    coachingApproach: "team_cbt",
    createdAt: new Date("2026-07-22T12:00:00.000Z"),
  };
});

describe("POST /api/openai/conversations", () => {
  it("persists an endorsed intermediate-belief focus and coaching approach", async () => {
    state.rowsByTable.set(tables.intermediateBeliefs, [
      intermediateBelief("endorsed"),
    ]);

    const response = await agent.post("/api/openai/conversations").send({
      title: "Work this belief",
      intermediateBeliefId: 41,
      coachingApproach: "team_cbt",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 73,
      selectedIntermediateBeliefId: 41,
      coachingApproach: "team_cbt",
    });

    const conversationInsert = state.inserts.find(
      (entry) => entry.table === tables.conversations,
    );
    expect(conversationInsert?.values).toEqual({
      title: "Work this belief",
      selectedBeliefId: null,
      selectedAutomaticThoughtId: null,
      selectedIntermediateBeliefId: 41,
      coachingApproach: "team_cbt",
    });

    const openingMessage = state.inserts.find(
      (entry) => entry.table === tables.messages,
    );
    expect(openingMessage?.values).toMatchObject({
      conversationId: 73,
      role: "assistant",
    });
    expect(openingMessage?.values["content"]).toContain(
      "intermediate belief as one that rings true",
    );
    expect(openingMessage?.values["content"]).toContain(
      "Before choosing a Burns method",
    );
    expect(openingMessage?.values["content"]).toContain(
      "advantages or protection",
    );
  });

  it.each(["unreviewed", "rejected", "irrelevant"])(
    "rejects a %s intermediate-belief focus before writing a conversation",
    async (reviewStatus) => {
      state.rowsByTable.set(tables.intermediateBeliefs, [
        intermediateBelief(reviewStatus),
      ]);

      const response = await agent.post("/api/openai/conversations").send({
        title: "Work this belief",
        intermediateBeliefId: 41,
        coachingApproach: "beck_cbt",
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error:
          "Mark this intermediate belief as ringing true before working on it",
      });
      expect(state.inserts).toHaveLength(0);
    },
  );

  it("rejects an endorsed but lifecycle-dismissed intermediate belief", async () => {
    state.rowsByTable.set(tables.intermediateBeliefs, [
      { ...intermediateBelief("endorsed"), status: "dismissed" },
    ]);

    const response = await agent.post("/api/openai/conversations").send({
      title: "Work this belief",
      intermediateBeliefId: 41,
      coachingApproach: "beck_cbt",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "This intermediate belief has been dismissed",
    });
    expect(state.inserts).toHaveLength(0);
  });
});

describe("POST /api/openai/conversations/:id/messages", () => {
  it("uses the request modality for a legacy conversation without a persisted approach", async () => {
    state.rowsByTable.set(tables.conversations, [
      {
        ...state.conversationResult,
        selectedIntermediateBeliefId: null,
        coachingApproach: null,
      },
    ]);
    state.rowsByTable.set(tables.exerciseSessions, [
      {
        exerciseId: "cbt-quick-be-specific",
        modality: "cbt",
        completed: true,
        moodBefore: null,
        moodAfter: null,
        stepData: {
          __focusKind: "automatic_thought",
          __focusId: 52,
          specificStatement: "One deadline was late this week",
        },
        createdAt: new Date(),
      },
    ]);
    state.rowsByTable.set(tables.exercises, [
      {
        id: "cbt-quick-be-specific",
        title: "Be Specific",
        steps: [
          { id: "specificStatement", title: "A specific description" },
        ],
      },
    ]);

    const response = await agent
      .post("/api/openai/conversations/73/messages")
      .send({ content: "Help me examine this", modality: "cbt" });

    expect(response.status).toBe(200);
    const { veraComplete } =
      await import("@workspace/integrations-openai-ai-server");
    const call = (veraComplete as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const system = (call?.[0] as { system?: string } | undefined)?.system ?? "";
    expect(system).toContain("Beckian CBT");
    expect(system).toContain("One deadline was late this week");
    expect(system).not.toContain("automatic_thought");
  });

  it.each(["unreviewed", "rejected", "irrelevant"])(
    "stops coaching when an automatic thought is now %s",
    async (reviewStatus) => {
      state.rowsByTable.set(tables.conversations, [
        {
          ...state.conversationResult,
          selectedAutomaticThoughtId: 52,
          selectedIntermediateBeliefId: null,
        },
      ]);
      state.rowsByTable.set(tables.automaticThoughts, [
        automaticThought(reviewStatus),
      ]);

      const response = await agent
        .post("/api/openai/conversations/73/messages")
        .send({ content: "Keep going" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error:
          "This automatic thought is no longer marked as yours. Choose another endorsed focus to continue.",
      });
      expect(state.inserts).toHaveLength(0);
    },
  );

  it.each(["unreviewed", "rejected", "irrelevant"])(
    "stops coaching when an intermediate belief is now %s",
    async (reviewStatus) => {
      state.rowsByTable.set(tables.conversations, [
        {
          ...state.conversationResult,
          selectedAutomaticThoughtId: null,
          selectedIntermediateBeliefId: 41,
        },
      ]);
      state.rowsByTable.set(tables.intermediateBeliefs, [
        intermediateBelief(reviewStatus),
      ]);

      const response = await agent
        .post("/api/openai/conversations/73/messages")
        .send({ content: "Keep going" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error:
          "This intermediate belief is no longer marked as ringing true. Choose another endorsed focus to continue.",
      });
      expect(state.inserts).toHaveLength(0);
    },
  );

  it("stops coaching when an intermediate belief is lifecycle-dismissed", async () => {
    state.rowsByTable.set(tables.conversations, [state.conversationResult]);
    state.rowsByTable.set(tables.intermediateBeliefs, [
      { ...intermediateBelief("endorsed"), status: "dismissed" },
    ]);

    const response = await agent
      .post("/api/openai/conversations/73/messages")
      .send({ content: "Keep going" });

    expect(response.status).toBe(409);
    expect(state.inserts).toHaveLength(0);
  });
});
