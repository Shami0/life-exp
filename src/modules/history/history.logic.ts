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