import { describe, expect, it } from "vitest";
import { buildConversationFocusBlock } from "./conversation-focus";

describe("buildConversationFocusBlock", () => {
  it("keeps a selected belief explicit and durable across turn prompts", () => {
    const block = buildConversationFocusBlock({
      id: 7,
      beliefText: "I must never make a mistake",
      beliefType: "should_statements",
      triggerSituation: "after feedback",
      emotionalConsequence: "anxiety",
      status: "challenged",
    });

    expect(block).toContain('Text: "I must never make a mistake"');
    expect(block).toContain("Keep this exact belief as the focus across turns");
    expect(block).toContain("hypothesis, not a fact");
  });

  it("grounds a selected automatic thought without promoting it to fact", () => {
    const block = buildConversationFocusBlock(undefined, {
      id: 3,
      thoughtText: "They probably think I failed",
      situation: "after a meeting",
      emotion: "anxiety",
      intensityPct: 70,
      distortionTags: ["mind_reading"],
    });

    expect(block).toContain("suspected automatic thought");
    expect(block).toContain("mind_reading");
    expect(block).toContain("hypothesis, not a fact");
  });
});
