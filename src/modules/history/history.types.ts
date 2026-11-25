import { z } from "zod";
import { dateString } from "../../shared/dates";

export const heatmapQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

export const dayParams = z.object({ date: dateString });

export type HeatmapQuery = z.infer<typeof heatmapQuery>;