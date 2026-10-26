import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  timestamp,
  unique,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "../users/users.schema";

export const occurrenceStatus = pgEnum("occurrence_status", ["pending", "done", "missed"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_user_idx").on(t.userId)],
);

export const taskOccurrences = pgTable(
  "task_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    // Denormalised on purpose: every query filters by user, so no join needed
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: occurrenceStatus("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Set in 4c: the missed occurrence this one was carried over from
    carriedFromId: uuid("carried_from_id").references((): AnyPgColumn => taskOccurrences.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A task has at most one occurrence per day (makes generation idempotent later)
    unique("task_occurrences_task_date_unique").on(t.taskId, t.date),
    index("task_occurrences_user_date_idx").on(t.userId, t.date),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type TaskOccurrence = typeof taskOccurrences.$inferSelect;