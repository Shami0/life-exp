import type { FastifyPluginAsync } from "fastify";
import { historyService } from "./history.service";
import { heatmapQuery } from "./history.types";

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tasks", async (request) => {
    const query = heatmapQuery.parse(request.query);
    return historyService.tasksHeatmap(request.user.sub, query);
  });
};