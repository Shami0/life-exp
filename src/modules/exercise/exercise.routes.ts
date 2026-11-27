import type { FastifyPluginAsync } from "fastify";
import { exercisesRoutes } from "./exercises.routes";

export const exerciseRoutes: FastifyPluginAsync = async (app) => {
  app.register(exercisesRoutes, { prefix: "/exercises" });
};