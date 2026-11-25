export type DayCounts = { total: number; done: number; missed: number };

// none    = gray   (nothing scheduled)
// done    = green  (everything done)
// partial = orange (some done, some missed)
// missed  = red    (scheduled, but nothing done)
// open    = today, still in progress (not judged until the day is over)
export type DayStatus = "none" | "done" | "partial" | "missed" | "open";

export type HeatmapDay = DayCounts & {
  date: string;
  status: DayStatus;
  pending: number;
};

export function dayStatus(counts: DayCounts, isToday: boolean): DayStatus {
  if (counts.total === 0) return "none";
  if (counts.done === counts.total) return "done";
  if (isToday) return "open";
  return counts.done === 0 ? "missed" : "partial";
}

// Walks the days from oldest to newest:
// - a 'done' day extends the streak
// - 'none' (nothing scheduled) and 'open' (today, unfinished) neither extend nor break it
// - 'partial' and 'missed' days break it
export function computeStreaks(days: { status: DayStatus }[]) {
  let run = 0;
  let longest = 0;
  for (const { status } of days) {
    if (status === "done") {
      run++;
      longest = Math.max(longest, run);
    } else if (status === "partial" || status === "missed") {
      run = 0;
    }
  }
  return { current: run, longest };
}

export function summarize(days: HeatmapDay[]) {
  const byStatus: Record<DayStatus, number> = { done: 0, partial: 0, missed: 0, none: 0, open: 0 };
  let tasksDone = 0;
  let tasksMissed = 0;

  for (const day of days) {
    byStatus[day.status]++;
    tasksDone += day.done;
    tasksMissed += day.missed;
  }

  const judged = tasksDone + tasksMissed;
  return {
    days: byStatus,
    tasksDone,
    tasksMissed,
    completionRate: judged === 0 ? null : Math.round((tasksDone / judged) * 1000) / 1000,
  };
}