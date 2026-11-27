import { z } from "zod";

const METRIC_ORDER = ["reps", "weight", "duration", "distance"] as const;
const metricEnum = z.enum(METRIC_ORDER);

// At least one metric; duplicates removed and put in a fixed order
const metrics = z
  .array(metricEnum)
  .min(1)
  .max(8)
  .transform((m) => METRIC_ORDER.filter((x) => m.includes(x)));

const name = z.string().trim().min(1).max(100);
const notes = z.string().trim().max(1000);

export const createExerciseBody = z.object({
  name,
  metrics,
  notes: notes.optional(),
});

export const updateExerciseBody = z
  .object({
    name: name.optional(),
    metrics: metrics.optional(),
    notes: notes.nullable().optional(), // null clears the notes
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export const listExercisesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  metric: metricEnum.optional(),
});

export const idParams = z.object({ id: z.string().uuid() });

export type CreateExerciseInput = z.infer<typeof createExerciseBody>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseBody>;
export type ListExercisesQuery = z.infer<typeof listExercisesQuery>;