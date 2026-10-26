import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { taskOccurrences, tasks } from "./tasks.schema";

export const tasksRepository = {
  async createWithOccurrence(input: {
    userId: string;
    title: string;
    notes: string | null;
    date: string;
  }) {
    return db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({ userId: input.userId, title: input.title, notes: input.notes })
        .returning();
      const [occurrence] = await tx
        .insert(taskOccurrences)
        .values({ taskId: task.id, userId: input.userId, date: input.date })
        .returning();
      return { task, occurrence };
    });
  },

  async updateTask(userId: string, id: string, data: { title?: string; notes?: string | null }) {
    const [row] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.archivedAt)))
      .returning();
    return row ?? null;
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