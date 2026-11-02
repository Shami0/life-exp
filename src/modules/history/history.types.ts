import { z } from "zod";
import { dateString } from "../../shared/dates";

export const heatmapQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

export type HeatmapQuery = z.infer<typeof heatmapQuery>;