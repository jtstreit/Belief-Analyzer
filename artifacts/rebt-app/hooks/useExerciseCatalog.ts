import { useListExercises, getListExercisesQueryKey } from '@workspace/api-client-react';
import { EXERCISE_CATALOG, type Exercise } from '@/constants/exercises';

/**
 * Exercise catalog from GET /exercises — the server is the source of truth.
 * The bundled constants are used only as an offline fallback when the
 * request fails, so the app still works without a connection.
 */
export function useExerciseCatalog(): {
  exercises: Exercise[];
  isLoading: boolean;
  isFallback: boolean;
} {
  const { data, isLoading, isError } = useListExercises(undefined, {
    query: { queryKey: getListExercisesQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  if (isError) {
    return { exercises: EXERCISE_CATALOG, isLoading: false, isFallback: true };
  }

  const serverExercises = (data as unknown as Exercise[]) ?? [];
  const bundledById = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise]));
  const exercises = serverExercises.map((exercise) => {
    const reviewed = bundledById.get(exercise.id);
    if (!reviewed) return exercise;

    // Safety-sensitive instructions ship with the mobile release rather than
    // depending on a database seed completing before the app is installed.
    return {
      ...exercise,
      rationale: reviewed.rationale,
      caution: reviewed.caution,
      steps: reviewed.steps,
    };
  });

  return {
    exercises,
    isLoading,
    isFallback: false,
  };
}

export function useExerciseById(id: string | undefined): {
  exercise: Exercise | undefined;
  isLoading: boolean;
} {
  const { exercises, isLoading } = useExerciseCatalog();
  return {
    exercise: id ? exercises.find((e) => e.id === id) : undefined,
    isLoading,
  };
}
