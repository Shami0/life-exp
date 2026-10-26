import { AppError } from "../../shared/errors";
import { todayInTimezone } from "../../shared/dates";
import { usersService } from "../users/users.service";
import { tasksRepository } from "./tasks.repository";
import type { CreateTaskInput, UpdateTaskInput } from "./tasks.types";

// Goes through usersService, never the users repository or table directly
async function todayFor(userId: string) {
  const user = await usersService.findById(userId);
  if (!user) throw new AppError(401, "Unauthorized");
  return todayInTimezone(user.timezone);
}

export const tasksService = {
  async create(userId: string, input: CreateTaskInput) {
    const today = await todayFor(userId);
    const date = input.date ?? today;
    if (date < today) throw new AppError(400, "Cannot schedule a task in the past");

    return tasksRepository.createWithOccurrence({
      userId,
      title: input.title,
      notes: input.notes ?? null,
      date,
    });
  },

  async listForDate(userId: string, date?: string) {
    const day = date ?? (await todayFor(userId));
    const occurrences = await tasksRepository.listOccurrencesForDate(userId, day);
    return { date: day, occurrences };
  },

  async update(userId: string, id: string, patch: UpdateTaskInput) {
    const task = await tasksRepository.updateTask(userId, id, patch);
    if (!task) throw new AppError(404, "Task not found");
    return task;
  },

  async archive(userId: string, id: string) {
    const today = await todayFor(userId);
    const task = await tasksRepository.archiveTask(userId, id, today);
    if (!task) throw new AppError(404, "Task not found");
  },

  async setStatus(userId: string, occurrenceId: string, status: "pending" | "done") {
    const occurrence = await tasksRepository.findOccurrence(userId, occurrenceId);
    if (!occurrence) throw new AppError(404, "Task occurrence not found");

    if (occurrence.status === "missed") throw new AppError(409, "This day is closed");

    const today = await todayFor(userId);
    if (occurrence.date < today) throw new AppError(409, "Past days are frozen");
    if (occurrence.date > today) throw new AppError(409, "Only today's tasks can be completed");

    const updated = await tasksRepository.setOccurrenceStatus(userId, occurrenceId, status);
    if (!updated) throw new AppError(404, "Task occurrence not found");
    return updated;
  },
};