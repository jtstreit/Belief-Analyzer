import { describe, expect, it } from "vitest";
import {
  exerciseModalityForApproach,
  getCoachingSystemPrompt,
  normalizeCoachingApproach,
} from "./coaching-prompts";

describe("coaching approach prompts", () => {
  it.each([
    ["team_cbt", "team_cbt"],
    ["team", "team_cbt"],
    ["beck_cbt", "beck_cbt"],
    ["cbt", "beck_cbt"],
    ["rebt", "rebt"],
    [undefined, "rebt"],
    ["unknown", "rebt"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeCoachingApproach(input)).toBe(expected);
  });

  it("keeps legacy cbt links on the Beckian approach", () => {
    expect(normalizeCoachingApproach("cbt")).toBe("beck_cbt");
    expect(getCoachingSystemPrompt("cbt")).toContain("Socratic guided discovery");
  });

  it("gives TEAM-CBT a broad method-selection contract", () => {
    const prompt = getCoachingSystemPrompt("team_cbt");
    expect(prompt).toContain("Testing");
    expect(prompt).toContain("Empathy");
    expect(prompt).toContain("Agenda Setting");
    expect(prompt).toContain("Do not reflexively start with evidence for/against");
    for (const method of [
      "Examine the Evidence",
      "Identify and Explain the Distortions",
      "Be Specific",
      "Thinking in Shades of Gray",
      "Define Terms",
      "Double-Standard Technique",
      "Cost-Benefit Analysis",
      "Positive Reframing",
      "Acceptance Paradox",
      "Externalization of Voices",
    ]) {
      expect(prompt).toContain(method);
    }
  });

  it("gives Beckian CBT method-fit guidance beyond a thought record", () => {
    const prompt = getCoachingSystemPrompt("beck_cbt");
    expect(prompt).toContain("Do not default to a full thought record");
    expect(prompt).toContain("labeling or global self-judgment");
    expect(prompt).toContain("Thinking in Shades of Gray");
    expect(prompt).toContain("Survey Method or Behavioral Experiment");
    expect(prompt).toContain("a rule or assumption");
    expect(prompt).toContain("short structured exercise");
  });

  it("keeps REBT distinct with three-pronged disputation", () => {
    const prompt = getCoachingSystemPrompt("rebt");
    expect(prompt).toContain("ABC(DE)");
    expect(prompt).toContain("Empirical:");
    expect(prompt).toContain("Logical:");
    expect(prompt).toContain("Pragmatic:");
    expect(prompt).toContain("unconditional self-, other-, and life-acceptance");
  });

  it.each(["team_cbt", "beck_cbt", "rebt"] as const)(
    "keeps shared safety boundaries in the %s prompt",
    (approach) => {
      const prompt = getCoachingSystemPrompt(approach);
      expect(prompt).toContain("self-help coaching assistant");
      expect(prompt).toContain("not a therapist");
      expect(prompt).toContain("suicidal thoughts");
      expect(prompt).toContain("respect refusal");
      expect(prompt).toContain("Never promise an outcome");
    },
  );

  it("returns distinct prompts for all three approaches", () => {
    const prompts = [
      getCoachingSystemPrompt("team_cbt"),
      getCoachingSystemPrompt("beck_cbt"),
      getCoachingSystemPrompt("rebt"),
    ];
    expect(new Set(prompts).size).toBe(3);
  });

  it("maps both CBT approaches to the CBT exercise catalog", () => {
    expect(exerciseModalityForApproach("team_cbt")).toBe("cbt");
    expect(exerciseModalityForApproach("beck_cbt")).toBe("cbt");
    expect(exerciseModalityForApproach("rebt")).toBe("rebt");
  });
});
