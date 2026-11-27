import { AppError } from "../../shared/errors";
import { BUILT_IN_EXERCISES } from "./exercises.defaults";
import { exercisesRepository } from "./exercises.repository";
import type { Exercise } from "./exercises.schema";
import type {
  CreateExerciseInput,
  ListExercisesQuery,
  UpdateExerciseInput,
} from "./exercises.types";

function toDto(e: Exercise) {
  return {
    id: e.id,
    name: e.name,
    metrics: e.metrics,
    notes: e.notes,
    isBuiltIn: e.userId === null,
    createdAt: e.createdAt,
  };
}

async function getVisible(userId: string, id: string) {
  const exercise = await exercisesRepository.findVisible(userId, id);
  if (!exercise) throw new AppError(404, "Exercise not found");
  return exercise;
}

// Built-in exercises are shared by everyone, so nobody can change them
function assertOwn(exercise: Exercise) {
  if (exercise.userId === null) throw new AppError(403, "Built-in exercises can't be changed");
}

export const exercisesService = {
  async list(userId: string, query: ListExercisesQuery) {
    const rows = await exercisesRepository.list(userId, query);
    return rows.map(toDto);
  },

  async get(userId: string, id: string) {
    return toDto(await getVisible(userId, id));
  },

  async create(userId: string, input: CreateExerciseInput) {
    if (await exercisesRepository.nameTaken(userId, input.name)) {
      throw new AppError(409, "An exercise with that name already exists");
    }
    const row = await exercisesRepository.create({
      userId,
      name: input.name,
      metrics: input.metrics,
      notes: input.notes ?? null,
    });
    return toDto(row);
  },

  async update(userId: string, id: string, patch: UpdateExerciseInput) {
    const existing = await getVisible(userId, id);
    assertOwn(existing);

    if (patch.name && (await exercisesRepository.nameTaken(userId, patch.name, id))) {
      throw new AppError(409, "An exercise with that name already exists");
    }

    const newMetrics = patch.metrics;
    if (newMetrics) {
      const removed = existing.metrics.filter((m) => !newMetrics.includes(m));
      if (removed.length > 0) {
        throw new AppError(
          409,
          `Metrics can only be added, not removed (this would remove: ${removed.join(", ")})`,
        );
      }
    }

    const updated = await exercisesRepository.update(userId, id, patch);
    if (!updated) throw new AppError(404, "Exercise not found");
    return toDto(updated);
  },

  async archive(userId: string, id: string) {
    const existing = await getVisible(userId, id);
    assertOwn(existing);
    await exercisesRepository.archive(userId, id);
  },

  // Used by the seed script. Safe to run any number of times.
  syncBuiltIns: () => exercisesRepository.upsertBuiltIns(BUILT_IN_EXERCISES),
};