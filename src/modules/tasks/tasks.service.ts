import { AppError } from "../../shared/errors";
import { addDays, todayInTimezone } from "../../shared/dates";
import { usersService } from "../users/users.service";
import { tasksRepository } from "./tasks.repository";
import type { CreateTaskInput, UpdateTaskInput } from "./tasks.types";

// How far ahead a day view will generate recurring occurrences
const GENERATE_AHEAD_DAYS = 60;

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

    return tasksRepository.create({
      userId,
      title: input.title,
      notes: input.notes ?? null,
      date,
      repeat: input.repeat,
    });
  },

  async listForDate(userId: string, date?: string) {
    const today = await todayFor(userId);
    const day = date ?? today;

    // Past days are never generated here: closing them is closeDay's job
    if (day >= today && day <= addDays(today, GENERATE_AHEAD_DAYS)) {
      await tasksRepository.generateRecurringForDate(userId, day);
    }

    const occurrences = await tasksRepository.listOccurrencesForDate(userId, day);
    return { date: day, occurrences };
  },

  async update(userId: string, id: string, patch: UpdateTaskInput) {
    const { repeat, ...fields } = patch;

    const existing = await tasksRepository.findTask(userId, id);
    if (!existing) throw new AppError(404, "Task not found");

    if (repeat) {
      if (existing.repeatType === "none") {
        throw new AppError(409, "Only recurring tasks have a repeat rule");
      }
      const today = await todayFor(userId);
      await tasksRepository.updateRepeat(userId, id, repeat, today);
    }

    if (Object.keys(fields).length > 0) {
      await tasksRepository.updateTask(userId, id, fields);
    }

    const task = await tasksRepository.findTask(userId, id);
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

  // Called by the days module for each finished day
  closeDay: (userId: string, day: string) => tasksRepository.closeDay(userId, day),
};