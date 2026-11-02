import { AppError } from "../../shared/errors";
import { addDays, daysBetween, todayInTimezone } from "../../shared/dates";
import { tasksService } from "../tasks/tasks.service";
import { usersService } from "../users/users.service";
import { dayStatus, type HeatmapDay } from "./history.logic";
import type { HeatmapQuery } from "./history.types";

const DEFAULT_RANGE_DAYS = 365;
const MAX_RANGE_DAYS = 366;

export const historyService = {
  async tasksHeatmap(userId: string, query: HeatmapQuery) {
    const user = await usersService.findById(userId);
    if (!user) throw new AppError(401, "Unauthorized");
    const today = todayInTimezone(user.timezone);

    // The future has no history: 'to' is clamped to today
    const to = query.to && query.to < today ? query.to : today;
    const from = query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));

    if (from > today) throw new AppError(400, "'from' cannot be in the future");
    if (from > to) throw new AppError(400, "'from' must not be after 'to'");
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
      throw new AppError(400, `Range too large (max ${MAX_RANGE_DAYS} days)`);
    }

    const rows = await tasksService.dailyCounts(userId, from, to);
    const byDate = new Map(rows.map((r) => [r.date, r]));

    // One entry per day, including days with nothing scheduled
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

    return { from, to, days };
  },
};