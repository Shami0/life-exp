import { z } from "zod";
import { dateString } from "../../shared/dates";

const title = z.string().trim().min(1).max(200);
const notes = z.string().trim().max(2000);

export const createTaskBody = z.object({
  title,
  notes: notes.optional(),
  date: dateString.optional(), // defaults to today
});

export const updateTaskBody = z
  .object({
    title: title.optional(),
    notes: notes.nullable().optional(), // null clears the notes
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

export const idParams = z.object({ id: z.string().uuid() });
export const dayQuery = z.object({ date: dateString.optional() });
export const setStatusBody = z.object({ status: z.enum(["pending", "done"]) });

export type CreateTaskInput = z.infer<typeof createTaskBody>;
export type UpdateTaskInput = z.infer<typeof updateTaskBody>;