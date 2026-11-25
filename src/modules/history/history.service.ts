import { AppError } from "../../shared/errors";
import { addDays, daysBetween, todayInTimezone } from "../../shared/dates";
import { tasksService } from "../tasks/tasks.service";
import { usersService } from "../users/users.service";
import { computeStreaks, dayStatus, summarize, type HeatmapDay } from "./history.logic";
import type { HeatmapQuery } from "./history.types";

const DEFAULT_RANGE_DAYS = 365;
const MAX_RANGE_DAYS = 366;

async function getUser(userId: string) {
  const user = await usersService.findById(userId);
  if (!user) throw new AppError(401, "Unauthorized");
  return user;
}

// One entry per day from..to, including days with nothing scheduled
async function buildDays(userId: string, from: string, to: string, today: string) {
  const rows = await tasksService.dailyCounts(userId, from, to);
  const byDate = new Map(rows.map((r) => [r.date, r]));

  const days: HeatmapDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const row = byDate.get(date);
    const total = row?.total ?? 0;
    const done = row?.done ?? 0;
    const missed = row?.missed ?? 0;
    days.push({
      date,
      status: dayStatus({ total, done, missed }, date === today),
      total,
      done,
      missed,
      pending: total - done - missed,
    });
  }
  return days;
}

export const historyService = {
  async tasksHeatmap(userId: string, query: HeatmapQuery) {
    const user = await getUser(userId);
    const today = todayInTimezone(user.timezone);

    // The future has no history: 'to' is clamped to today
    const to = query.to && query.to < today ? query.to : today;
    const from = query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));

    if (from > today) throw new AppError(400, "'from' cannot be in the future");
    if (from > to) throw new AppError(400, "'from' must not be after 'to'");
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
      throw new AppError(400, `Range too large (max ${MAX_RANGE_DAYS} days)`);
    }

    const days = await buildDays(userId, from, to, today);
    return { from, to, days };
  },

  // One day with every task on it: what you open when you click a heatmap square
  async tasksDay(userId: string, date: string) {
    const user = await getUser(userId);
    const today = todayInTimezone(user.timezone);
    if (date > today) throw new AppError(400, "No history for future days");

    const { occurrences } = await tasksService.listForDate(userId, date);
    const total = occurrences.length;
    const done = occurrences.filter((o) => o.status === "done").length;
    const missed = occurrences.filter((o) => o.status === "missed").length;

    return {
      date,
      status: dayStatus({ total, done, missed }, date === today),
      total,
      done,
      missed,
      pending: total - done - missed,
      items: occurrences.map((o) => ({ ...o, carriedOver: o.carriedFromId !== null })),
    };
  },

  async tasksStats(userId: string) {
    const user = await getUser(userId);
    const today = todayInTimezone(user.timezone);
    // Nothing can exist before the account does
    const since = todayInTimezone(user.timezone, user.createdAt);

    const days = await buildDays(userId, since, today, today);
    const streaks = computeStreaks(days);

    return {
      since,
      through: today,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      ...summarize(days),
    };
  },
};