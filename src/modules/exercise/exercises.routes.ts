import type { FastifyPluginAsync } from "fastify";
import { exercisesService } from "./exercises.service";
import {
  createExerciseBody,
  idParams,
  listExercisesQuery,
  updateExerciseBody,
} from "./exercises.types";

export const exercisesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const query = listExercisesQuery.parse(request.query);
    return { exercises: await exercisesService.list(request.user.sub, query) };
  });

  app.get("/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return { exercise: await exercisesService.get(request.user.sub, id) };
  });

  app.post("/", async (request, reply) => {
    const body = createExerciseBody.parse(request.body);
    const exercise = await exercisesService.create(request.user.sub, body);
    return reply.status(201).send({ exercise });
  });

  app.patch("/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = updateExerciseBody.parse(request.body);
    return { exercise: await exercisesService.update(request.user.sub, id, body) };
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await exercisesService.archive(request.user.sub, id);
    return reply.status(204).send();
  });
};