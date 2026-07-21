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
}

export function buildConversationFocusBlock(
  belief?: FocusedBelief,
  thought?: FocusedAutomaticThought,
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
      "Type: suspected automatic thought",
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

  return "## Selected focus for this conversation\nNo thought or belief is selected. Ask the user to choose one before making a specific formulation.";
}
