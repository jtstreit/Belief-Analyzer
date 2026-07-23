import { describe, expect, it } from 'vitest';

import {
  buildExerciseFocusPrefill,
  FOCUS_STEP_BY_EXERCISE_ID,
  isQuickExercise,
  QUICK_EXERCISE_IDS,
} from './exerciseFocus';

describe('exercise focus routing', () => {
  it.each(QUICK_EXERCISE_IDS)(
    'routes %s focus text to the target step',
    (exerciseId) => {
      expect(FOCUS_STEP_BY_EXERCISE_ID[exerciseId]).toBe('target');
      expect(
        buildExerciseFocusPrefill(exerciseId, {
          kind: ' intermediate_belief ',
          id: ' 42 ',
          text: '  If I ask for help, I am weak.  ',
        }),
      ).toEqual({
        target: 'If I ask for help, I am weak.',
        __focusKind: 'intermediate_belief',
        __focusId: 42,
      });
    },
  );

  it('supports known legacy exercise focus fields', () => {
    expect(
      buildExerciseFocusPrefill('rebt-abcde', {
        text: 'I must never make mistakes.',
      }),
    ).toEqual({ B: 'I must never make mistakes.' });

    expect(
      buildExerciseFocusPrefill('cbt-thought-record-7col', {
        text: 'They will think I am incompetent.',
      }),
    ).toEqual({
      automaticThoughts: 'They will think I am incompetent.',
    });
  });

  it('keeps valid focus metadata even when the exercise has no focus step', () => {
    expect(
      buildExerciseFocusPrefill('unknown-exercise', {
        kind: 'automatic-thought',
        id: '9',
        text: 'This text has nowhere to be prefilled.',
      }),
    ).toEqual({
      __focusKind: 'automatic-thought',
      __focusId: 9,
    });
  });

  it('rejects malformed or unsafe IDs and bounds stored focus kinds', () => {
    expect(
      buildExerciseFocusPrefill('cbt-quick-be-specific', {
        kind: `  ${'k'.repeat(80)}  `,
        id: '12abc',
        text: '  ',
      }),
    ).toEqual({
      __focusKind: 'k'.repeat(64),
    });

    expect(
      buildExerciseFocusPrefill('cbt-quick-be-specific', {
        id: '9007199254740992',
      }),
    ).toEqual({});
  });
});

describe('quick exercise detection', () => {
  it('recognizes either explicit catalog metadata or a known quick ID', () => {
    expect(isQuickExercise({ id: 'custom-quick', quick: true })).toBe(true);
    expect(isQuickExercise({ id: QUICK_EXERCISE_IDS[0] })).toBe(true);
    expect(
      isQuickExercise({ id: QUICK_EXERCISE_IDS[0], quick: false }),
    ).toBe(true);
  });

  it('does not classify an ordinary exercise as quick', () => {
    expect(isQuickExercise({ id: 'rebt-abcde' })).toBe(false);
    expect(isQuickExercise({ id: 'rebt-abcde', quick: false })).toBe(false);
  });
});
