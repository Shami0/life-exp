import type { FastifyPluginAsync } from "fastify";
import { tasksService } from "./tasks.service";
import {
  createTaskBody,
  dayQuery,
  idParams,
  setStatusBody,
  updateTaskBody,
} from "./tasks.types";

export const tasksRoutes: FastifyPluginAsync = async (app) => {
  // Every route in this module requires a logged-in user
  app.addHook("onRequest", app.authenticate);

  app.post("/", async (request, reply) => {
    const body = createTaskBody.parse(request.body);
    const result = await tasksService.create(request.user.sub, body);
    return reply.status(201).send(result);
  });

  // The day view: GET /tasks/occurrences?date=2026-10-14 (defaults to today)
  app.get("/occurrences", async (request) => {
    const { date } = dayQuery.parse(request.query);
    return tasksService.listForDate(request.user.sub, date);
  });

  app.patch("/occurrences/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const { status } = setStatusBody.parse(request.body);
    const occurrence = await tasksService.setStatus(request.user.sub, id, status);
    return { occurrence };
  });

  app.patch("/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = updateTaskBody.parse(request.body);
    const task = await tasksService.update(request.user.sub, id, body);
    return { task };
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await tasksService.archive(request.user.sub, id);
    return reply.status(204).send();
  });
};