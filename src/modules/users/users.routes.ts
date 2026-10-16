import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../shared/errors";
import { toPublicUser, usersService } from "./users.service";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", { onRequest: [app.authenticate] }, async (request) => {
    const user = await usersService.findById(request.user.sub);
    if (!user) throw new AppError(404, "User not found");
    return { user: toPublicUser(user) };
  });
};