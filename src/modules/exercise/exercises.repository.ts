import { and, asc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { exercises, type ExerciseMetric } from "./exercises.schema";
import type { ListExercisesQuery } from "./exercises.types";

// Built-in exercises (no owner) plus the user's own, never archived ones
const visibleTo = (userId: string) =>
  and(isNull(exercises.archivedAt), or(isNull(exercises.userId), eq(exercises.userId, userId)));

// Make % and _ in a search behave as plain characters
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export const exercisesRepository = {
  async list(userId: string, filters: ListExercisesQuery) {
    const conditions = [visibleTo(userId)];
    if (filters.q) {
      conditions.push(ilike(exercises.name, `%${escapeLike(filters.q)}%`));
    }
    if (filters.metric) {
      conditions.push(
        sql`${exercises.metrics} @> array[${filters.metric}]::exercise_metric[]`,
      );
    }
    return db
      .select()
      .from(exercises)
      .where(and(...conditions))
      .orderBy(asc(exercises.name));
  },

  async findVisible(userId: string, id: string) {
    const [row] = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, id), visibleTo(userId)))
      .limit(1);
    return row ?? null;
  },

  // Case-insensitive, across built-ins and the user's own exercises
  async nameTaken(userId: string, name: string, excludeId?: string) {
    const [row] = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(
        and(
          visibleTo(userId),
          sql`lower(${exercises.name}) = lower(${name})`,
          excludeId ? ne(exercises.id, excludeId) : undefined,
        ),
      )
      .limit(1);
    return row !== undefined;
  },

  async create(data: { userId: string; name: string; metrics: ExerciseMetric[]; notes: string | null }) {
    const [row] = await db.insert(exercises).values(data).returning();
    return row;
  },

  // Own exercises only: built-ins are never matched because their userId is null
  async update(
    userId: string,
    id: string,
    data: { name?: string; metrics?: ExerciseMetric[]; notes?: string | null },
  ) {
    const [row] = await db
      .update(exercises)
      .set(data)
      .where(and(eq(exercises.id, id), eq(exercises.userId, userId), isNull(exercises.archivedAt)))
      .returning();
    return row ?? null;
  },

  async archive(userId: string, id: string) {
    const [row] = await db
      .update(exercises)
      .set({ archivedAt: new Date() })
      .where(and(eq(exercises.id, id), eq(exercises.userId, userId), isNull(exercises.archivedAt)))
      .returning();
    return row ?? null;
  },

  // Insert the built-ins, or refresh them if they already exist (matched by slug)
  async upsertBuiltIns(items: { slug: string; name: string; metrics: ExerciseMetric[] }[]) {
    await db
      .insert(exercises)
      .values(items.map((i) => ({ ...i, userId: null })))
      .onConflictDoUpdate({
        target: exercises.slug,
        set: {
          name: sql`excluded.name`,
          metrics: sql`excluded.metrics`,
          archivedAt: null,
        },
      });
    return items.length;
  },
};