import { and, asc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { addDays, isoWeekday } from "../../shared/dates";
import { taskOccurrences, tasks } from "./tasks.schema";
import type { RecurringRule, RepeatRule } from "./tasks.types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Creates the occurrences recurring tasks should have on a date.
// Idempotent: the unique (task_id, date) constraint makes repeats harmless.
async function generateRecurring(tx: Tx, userId: string, date: string) {
  const weekday = isoWeekday(date);

  const due = await tx
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

  await tx
    .insert(taskOccurrences)
    .values(due.map((t) => ({ taskId: t.id, userId, date })))
    .onConflictDoNothing({ target: [taskOccurrences.taskId, taskOccurrences.date] });
}

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

  async generateRecurringForDate(userId: string, date: string) {
    await db.transaction((tx) => generateRecurring(tx, userId, date));
  },

  // Closes one finished calendar day. Safe to run twice for the same day.
  async closeDay(userId: string, day: string) {
    const next = addDays(day, 1);

    await db.transaction(async (tx) => {
      // 1. Backfill recurring occurrences nobody generated for this day
      await generateRecurring(tx, userId, day);

      // 2. Whatever is still pending is now missed, and frozen from here on
      await tx
        .update(taskOccurrences)
        .set({ status: "missed" })
        .where(
          and(
            eq(taskOccurrences.userId, userId),
            eq(taskOccurrences.date, day),
            eq(taskOccurrences.status, "pending"),
          ),
        );

      // 3. Next day's recurring occurrences first, so a task's own scheduled
      //    occurrence wins over a carried-over copy (no duplicates)
      await generateRecurring(tx, userId, next);

      // 4. Carry missed tasks to the next day. Archived tasks are skipped, and
      //    ON CONFLICT skips tasks that already have an occurrence that day.
      await tx.execute(sql`
        insert into task_occurrences (task_id, user_id, date, carried_from_id)
        select o.task_id, o.user_id, ${next}::date, o.id
        from task_occurrences o
        join tasks t on t.id = o.task_id
        where o.user_id = ${userId}
          and o.date = ${day}::date
          and o.status = 'missed'
          and t.archived_at is null
        on conflict (task_id, date) do nothing
      `);
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
        repeatType: tasks.repeatType,
      })
      .from(taskOccurrences)
      .innerJoin(tasks, eq(tasks.id, taskOccurrences.taskId))
      .where(and(eq(taskOccurrences.userId, userId), eq(taskOccurrences.date, date)))
      .orderBy(asc(taskOccurrences.createdAt));
  },

  // Per-day totals for the history views. Archived tasks still count: history never changes.
  async dailyCounts(userId: string, from: string, to: string) {
    return db
      .select({
        date: taskOccurrences.date,
        total: sql<number>`count(*)`.mapWith(Number),
        done: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'done')`.mapWith(Number),
        missed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'missed')`.mapWith(Number),
      })
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.userId, userId),
          gte(taskOccurrences.date, from),
          lte(taskOccurrences.date, to),
        ),
      )
      .groupBy(taskOccurrences.date)
      .orderBy(asc(taskOccurrences.date));
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