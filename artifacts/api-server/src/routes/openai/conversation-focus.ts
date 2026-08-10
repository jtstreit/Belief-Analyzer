export interface FocusedBelief {
  id: number;
  beliefText: string;
  beliefType: string;
  triggerSituation?: string | null;
  emotionalConsequence?: string | null;
  status: string;
}

export interface FocusedAutomaticThought {
  id: number;
  thoughtText: string;
  situation?: string | null;
  emotion?: string | null;
  intensityPct?: number | null;
  distortionTags: string[];
  reviewStatus?: string;
}

export interface FocusedIntermediateBelief {
  id: number;
  beliefText: string;
  category: string;
  confidence: number;
  evidenceCount: number;
  reviewStatus: string;
}

export function buildConversationFocusBlock(
  belief?: FocusedBelief,
  thought?: FocusedAutomaticThought,
  intermediateBelief?: FocusedIntermediateBelief,
): string {
  if (belief) {
    return [
      "## Selected focus for this conversation",
      `Type: belief (${belief.beliefType.replace(/_/g, " ")})`,
      `Text: ${JSON.stringify(belief.beliefText)}`,
      belief.triggerSituation
        ? `Trigger: ${JSON.stringify(belief.triggerSituation)}`
        : "",
      belief.emotionalConsequence
        ? `Reported consequence: ${JSON.stringify(belief.emotionalConsequence)}`
        : "",
      `Status: ${belief.status}`,
      "Keep this exact belief as the focus across turns until the user explicitly changes it. Treat it as a hypothesis, not a fact.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (thought) {
    return [
      "## Selected focus for this conversation",
      thought.reviewStatus === "endorsed"
        ? "Type: user-endorsed automatic thought"
        : "Type: suspected automatic thought",
      `Text: ${JSON.stringify(thought.thoughtText)}`,
      thought.situation ? `Situation: ${JSON.stringify(thought.situation)}` : "",
      thought.emotion
        ? `Emotion: ${thought.emotion}${thought.intensityPct != null ? ` (${thought.intensityPct}%)` : ""}`
        : "",
      thought.distortionTags.length > 0
        ? `Possible distortions: ${thought.distortionTags.join(", ")}`
        : "",
      "Keep this exact thought as the focus across turns until the user explicitly changes it. Treat every interpretation as a hypothesis, not a fact.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (intermediateBelief) {
    return [
      "## Selected focus for this conversation",
      intermediateBelief.reviewStatus === "endorsed"
        ? "Type: user-endorsed intermediate-belief hypothesis"
        : "Type: suspected intermediate-belief hypothesis",
      `Text: ${JSON.stringify(intermediateBelief.beliefText)}`,
      `Category: ${intermediateBelief.category}`,
      `Model support: ${intermediateBelief.confidence}% confidence across ${intermediateBelief.evidenceCount} analysis run${intermediateBelief.evidenceCount === 1 ? "" : "s"}`,
      `User review: ${intermediateBelief.reviewStatus}`,
      "Keep this exact intermediate belief as the focus across turns until the user explicitly changes it. Its endorsement means it resonates with the user; it remains a hypothesis to explore, not an objective fact.",
    ].join("\n");
  }

  return "## Selected focus for this conversation\nNo thought or belief is selected. Ask the user to choose one before making a specific formulation.";
}
