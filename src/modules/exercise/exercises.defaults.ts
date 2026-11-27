import type { ExerciseMetric } from "./exercises.schema";

type BuiltIn = { slug: string; name: string; metrics: ExerciseMetric[] };

// Keep metrics in this order: reps, weight, duration, distance
export const BUILT_IN_EXERCISES: BuiltIn[] = [
  // Bodyweight
  { slug: "push-up", name: "Push-up", metrics: ["reps"] },
  { slug: "pull-up", name: "Pull-up", metrics: ["reps", "weight"] },
  { slug: "chin-up", name: "Chin-up", metrics: ["reps", "weight"] },
  { slug: "dip", name: "Dip", metrics: ["reps", "weight"] },
  { slug: "sit-up", name: "Sit-up", metrics: ["reps"] },
  { slug: "crunch", name: "Crunch", metrics: ["reps"] },
  { slug: "bodyweight-squat", name: "Bodyweight squat", metrics: ["reps"] },
  { slug: "lunge", name: "Lunge", metrics: ["reps", "weight"] },
  { slug: "burpee", name: "Burpee", metrics: ["reps"] },
  { slug: "mountain-climber", name: "Mountain climber", metrics: ["reps"] },
  { slug: "plank", name: "Plank", metrics: ["duration"] },
  { slug: "side-plank", name: "Side plank", metrics: ["duration"] },
  { slug: "wall-sit", name: "Wall sit", metrics: ["duration"] },

  // Strength
  { slug: "bench-press", name: "Bench press", metrics: ["reps", "weight"] },
  { slug: "incline-bench-press", name: "Incline bench press", metrics: ["reps", "weight"] },
  { slug: "overhead-press", name: "Overhead press", metrics: ["reps", "weight"] },
  { slug: "barbell-squat", name: "Barbell squat", metrics: ["reps", "weight"] },
  { slug: "deadlift", name: "Deadlift", metrics: ["reps", "weight"] },
  { slug: "romanian-deadlift", name: "Romanian deadlift", metrics: ["reps", "weight"] },
  { slug: "barbell-row", name: "Barbell row", metrics: ["reps", "weight"] },
  { slug: "lat-pulldown", name: "Lat pulldown", metrics: ["reps", "weight"] },
  { slug: "leg-press", name: "Leg press", metrics: ["reps", "weight"] },
  { slug: "dumbbell-curl", name: "Dumbbell curl", metrics: ["reps", "weight"] },
  { slug: "tricep-pushdown", name: "Tricep pushdown", metrics: ["reps", "weight"] },

  // Cardio and mobility
  { slug: "running", name: "Running", metrics: ["duration", "distance"] },
  { slug: "walking", name: "Walking", metrics: ["duration", "distance"] },
  { slug: "cycling", name: "Cycling", metrics: ["duration", "distance"] },
  { slug: "rowing", name: "Rowing", metrics: ["duration", "distance"] },
  { slug: "swimming", name: "Swimming", metrics: ["duration", "distance"] },
  { slug: "jump-rope", name: "Jump rope", metrics: ["duration"] },
  { slug: "stretching", name: "Stretching", metrics: ["duration"] },
];