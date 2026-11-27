import { pgTable, pgEnum, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "../users/users.schema";

// What can be recorded for one set of an exercise.
// Logs will store canonical units: weight in kg, duration in seconds, distance in metres.
export const exerciseMetric = pgEnum("exercise_metric", ["reps", "weight", "duration", "distance"]);
export type ExerciseMetric = (typeof exerciseMetric.enumValues)[number];

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null = built-in exercise shared by everyone (read-only)
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    // Stable key for built-ins so the seed can be re-run safely. null for custom exercises.
    slug: text("slug").unique(),
    name: text("name").notNull(),
    metrics: exerciseMetric("metrics").array().notNull(),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exercises_user_idx").on(t.userId)],
);

export type Exercise = typeof exercises.$inferSelect;