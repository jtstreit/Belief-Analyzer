export type ExerciseFocusPrefill = Record<string, string | number>;

export const QUICK_EXERCISE_IDS = [
  'cbt-quick-examine-evidence',
  'cbt-quick-distortions',
  'cbt-quick-be-specific',
  'cbt-quick-shades-of-gray',
  'cbt-quick-define-terms',
  'cbt-quick-double-standard',
  'cbt-quick-cost-benefit',
] as const;

const quickExerciseIds = new Set<string>(QUICK_EXERCISE_IDS);

/**
 * The selected focus belongs in a specific exercise step. Keeping this mapping
 * outside the screen makes the route contract deterministic and testable.
 */
export const FOCUS_STEP_BY_EXERCISE_ID: Readonly<Record<string, string>> = {
  'rebt-abcde': 'B',
  'cbt-thought-record-7col': 'automaticThoughts',
  'cbt-triple-column': 'automaticThought',
  'cbt-downward-arrow': 'surface',
  'cbt-behavioral-experiment': 'belief',
  'cbt-quick-examine-evidence': 'target',
  'cbt-quick-distortions': 'target',
  'cbt-quick-be-specific': 'target',
  'cbt-quick-shades-of-gray': 'target',
  'cbt-quick-define-terms': 'target',
  'cbt-quick-double-standard': 'target',
  'cbt-quick-cost-benefit': 'target',
};

export function isQuickExercise(exercise: {
  id: string;
  quick?: boolean;
}): boolean {
  // The id fallback keeps quick behavior when the online catalog comes from
  // the current DB schema, which does not yet expose the bundled `quick` flag.
  return exercise.quick === true || quickExerciseIds.has(exercise.id);
}

export function buildExerciseFocusPrefill(
  exerciseId: string,
  focus: {
    kind?: string;
    id?: string;
    text?: string;
  },
): ExerciseFocusPrefill {
  const prefill: ExerciseFocusPrefill = {};
  const targetStepId = FOCUS_STEP_BY_EXERCISE_ID[exerciseId];
  const focusText = focus.text?.trim();
  const focusKind = focus.kind?.trim();
  const focusId = focus.id?.trim();

  if (targetStepId && focusText) {
    prefill[targetStepId] = focusText;
  }

  if (focusKind) {
    prefill.__focusKind = focusKind.slice(0, 64);
  }

  if (focusId && /^\d+$/.test(focusId)) {
    const numericId = Number(focusId);
    if (Number.isSafeInteger(numericId)) {
      prefill.__focusId = numericId;
    }
  }

  return prefill;
}
