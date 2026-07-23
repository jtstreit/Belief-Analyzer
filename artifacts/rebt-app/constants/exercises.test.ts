import { describe, expect, it } from 'vitest';

import seedExerciseCatalog from '../../../lib/db/src/seed/exercise-catalog.json';
import { FOCUS_STEP_BY_EXERCISE_ID, QUICK_EXERCISE_IDS } from '../lib/exerciseFocus';
import { EXERCISE_CATALOG } from './exercises';

const expectedQuickIds = [...QUICK_EXERCISE_IDS];
const bundledQuickExercises = EXERCISE_CATALOG.filter(
  (exercise) => exercise.quick === true,
);
const seededQuickExercises = seedExerciseCatalog.filter(
  (exercise) => exercise.quick === true,
);

describe('quick exercise catalog parity', () => {
  it('defines the same seven quick exercises in app code and the DB seed', () => {
    expect(bundledQuickExercises.map(({ id }) => id)).toEqual(expectedQuickIds);
    expect(seededQuickExercises.map(({ id }) => id)).toEqual(expectedQuickIds);
    expect(seededQuickExercises).toEqual(bundledQuickExercises);
  });

  it.each(bundledQuickExercises)(
    'keeps $id compact, focus-first, and belief-rated',
    (exercise) => {
      expect(exercise.quick).toBe(true);
      expect(['cbt', 'both']).toContain(exercise.modality);
      expect(exercise.category).toBe('cognitive_restructuring');
      expect(exercise.estimatedMinutes).toBeGreaterThanOrEqual(4);
      expect(exercise.estimatedMinutes).toBeLessThanOrEqual(8);
      expect(exercise.steps[0]?.id).toBe('target');
      expect(FOCUS_STEP_BY_EXERCISE_ID[exercise.id]).toBe('target');

      const stepIds = exercise.steps.map(({ id }) => id);
      expect(new Set(stepIds).size).toBe(stepIds.length);

      for (const ratingId of ['beliefBefore', 'beliefAfter']) {
        const rating = exercise.steps.find(({ id }) => id === ratingId);
        expect(rating).toMatchObject({
          id: ratingId,
          type: 'rating',
          min: 0,
          max: 10,
        });
      }
    },
  );

  it('does not reuse a quick ID elsewhere in either full catalog', () => {
    for (const quickId of expectedQuickIds) {
      expect(
        EXERCISE_CATALOG.filter(({ id }) => id === quickId),
      ).toHaveLength(1);
      expect(
        seedExerciseCatalog.filter(({ id }) => id === quickId),
      ).toHaveLength(1);
    }
  });
});
