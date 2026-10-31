import { and, asc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { taskOccurrences, tasks } from "./tasks.schema";
import type { RecurringRule, RepeatRule } from "./tasks.types";

export const tasksRepository = {
  async create(input: {
    userId: string;
    title: string;
    notes: string | null;
    date: string;
    repeat: RepeatRule;
  }) {
    return db.transaction(async (tx) => {
      const isRecurring = input.repeat.type !== "none";

      const [task] = await tx
        .insert(tasks)
        .values({
          userId: input.userId,
          title: input.title,
          notes: input.notes,
          repeatType: input.repeat.type,
          repeatDays: input.repeat.type === "weekdays" ? input.repeat.days : null,
          startDate: isRecurring ? input.date : null,
        })
        .returning();

      // Recurring tasks get their occurrences lazily, when a day is viewed
      if (isRecurring) return { task, occurrence: null };

      const [occurrence] = await tx
        .insert(taskOccurrences)
        .values({ taskId: task.id, userId: input.userId, date: input.date })
        .returning();
      return { task, occurrence };
    });
  },

  async findTask(userId: string, id: string) {
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.archivedAt)))
      .limit(1);
    return row ?? null;
  },

  async updateTask(userId: string, id: string, data: { title?: string; notes?: string | null }) {
    const [row] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.archivedAt)))
      .returning();
    return row ?? null;
  },

  // New rule applies from today: pending occurrences from today on are dropped
  // and regenerated under the new rule the next time those days are viewed.
  async updateRepeat(userId: string, id: string, rule: RecurringRule, today: string) {
    return db.transaction(async (tx) => {
      const [task] = await tx
        .update(tasks)
        .set({
          repeatType: rule.type,
          repeatDays: rule.type === "weekdays" ? rule.days : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.id, id),
            eq(tasks.userId, userId),
            isNull(tasks.archivedAt),
            ne(tasks.repeatType, "none"),
          ),
        )
        .returning();
      if (!task) return null;

      await tx
        .delete(taskOccurrences)
        .where(
          and(
            eq(taskOccurrences.taskId, id),
            eq(taskOccurrences.status, "pending"),
            gte(taskOccurrences.date, today),
          ),
        );
      return task;
    });
  },

  // Archive, don't delete: past occurrences must survive so history never changes
  async archiveTask(userId: string, id: string, today: string) {
    return db.transaction(async (tx) => {
      const [task] = await tx
        .update(tasks)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.archivedAt)))
        .returning();
      if (!task) return null;

      await tx
        .delete(taskOccurrences)
        .where(
          and(
            eq(taskOccurrences.taskId, id),
            eq(taskOccurrences.status, "pending"),
            gte(taskOccurrences.date, today),
          ),
        );
      return task;
    });
  },

  // Idempotent: safe to call any number of times for the same day
  async generateRecurringForDate(userId: string, date: string, weekday: number) {
    const due = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.archivedAt),
          ne(tasks.repeatType, "none"),
          lte(tasks.startDate, date),
          or(
            eq(tasks.repeatType, "daily"),
            and(
              eq(tasks.repeatType, "weekdays"),
              sql`${weekday}::smallint = any(${tasks.repeatDays})`,
            ),
          ),
        ),
      );
    if (due.length === 0) return;

    await db
      .insert(taskOccurrences)
      .values(due.map((t) => ({ taskId: t.id, userId, date })))
      .onConflictDoNothing({ target: [taskOccurrences.taskId, taskOccurrences.date] });
  },

  async listOccurrencesForDate(userId: string, date: string) {
    return db
      .select({
        id: taskOccurrences.id,
        taskId: taskOccurrences.taskId,
        date: taskOccurrences.date,
        status: taskOccurrences.status,
        completedAt: taskOccurrences.completedAt,
        carriedFromId: taskOccurrences.carriedFromId,
        title: tasks.title,
        notes: tasks.notes,
        repeatType: tasks.repeatType,
      })
      .from(taskOccurrences)
      .innerJoin(tasks, eq(tasks.id, taskOccurrences.taskId))
      .where(and(eq(taskOccurrences.userId, userId), eq(taskOccurrences.date, date)))
      .orderBy(asc(taskOccurrences.createdAt));
  },

  async findOccurrence(userId: string, id: string) {
    const [row] = await db
      .select()
      .from(taskOccurrences)
      .where(and(eq(taskOccurrences.id, id), eq(taskOccurrences.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async setOccurrenceStatus(userId: string, id: string, status: "pending" | "done") {
    const [row] = await db
      .update(taskOccurrences)
      .set({ status, completedAt: status === "done" ? new Date() : null })
      .where(and(eq(taskOccurrences.id, id), eq(taskOccurrences.userId, userId)))
      .returning();
    return row ?? null;
  },
};