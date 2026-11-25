import type { FastifyPluginAsync } from "fastify";
import { historyService } from "./history.service";
import { dayParams, heatmapQuery } from "./history.types";

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tasks", async (request) => {
    const query = heatmapQuery.parse(request.query);
    return historyService.tasksHeatmap(request.user.sub, query);
  });

  // Registered before /tasks/:date for clarity; Fastify matches the fixed path first anyway
  app.get("/tasks/stats", async (request) => {
    return historyService.tasksStats(request.user.sub);
  });

  app.get("/tasks/:date", async (request) => {
    const { date } = dayParams.parse(request.params);
    return historyService.tasksDay(request.user.sub, date);
  });
};