import { z } from "zod";
import { dateString } from "../../shared/dates";

const title = z.string().trim().min(1).max(200);
const notes = z.string().trim().max(2000);

// 1 = Mon ... 7 = Sun; duplicates removed and sorted
const days = z
  .array(z.number().int().min(1).max(7))
  .min(1)
  .max(7)
  .transform((d) => [...new Set(d)].sort((a, b) => a - b));

const dailyRule = z.object({ type: z.literal("daily") });
const weekdaysRule = z.object({ type: z.literal("weekdays"), days });

export const recurringRule = z.discriminatedUnion("type", [dailyRule, weekdaysRule]);
export const repeatRule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  dailyRule,
  weekdaysRule,
]);

export const createTaskBody = z.object({
  title,
  notes: notes.optional(),
  date: dateString.optional(), // one-off: the day; recurring: the start date. Defaults to today
  repeat: repeatRule.default({ type: "none" }),
});

export const updateTaskBody = z
  .object({
    title: title.optional(),
    notes: notes.nullable().optional(), // null clears the notes
    repeat: recurringRule.optional(), // only recurring tasks can change rule
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export const idParams = z.object({ id: z.string().uuid() });
export const dayQuery = z.object({ date: dateString.optional() });
export const setStatusBody = z.object({ status: z.enum(["pending", "done"]) });

export type RepeatRule = z.infer<typeof repeatRule>;
export type RecurringRule = z.infer<typeof recurringRule>;
export type CreateTaskInput = z.infer<typeof createTaskBody>;
export type UpdateTaskInput = z.infer<typeof updateTaskBody>;