import type { FastifyPluginAsync } from "fastify";
import { authService } from "./auth.service";
import { loginBody, refreshBody, registerBody } from "./auth.types";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const body = registerBody.parse(request.body);
    const { user, refreshToken } = await authService.register(body);
    const accessToken = app.jwt.sign({ sub: user.id });
    return reply.status(201).send({ user, accessToken, refreshToken });
  });

  app.post("/login", async (request) => {
    const body = loginBody.parse(request.body);
    const { user, refreshToken } = await authService.login(body);
    const accessToken = app.jwt.sign({ sub: user.id });
    return { user, accessToken, refreshToken };
  });

  app.post("/refresh", async (request) => {
    const { refreshToken: oldToken } = refreshBody.parse(request.body);
    const { userId, refreshToken } = await authService.refresh(oldToken);
    return { accessToken: app.jwt.sign({ sub: userId }), refreshToken };
  });

  app.post("/logout", async (request, reply) => {
    const { refreshToken } = refreshBody.parse(request.body);
    await authService.logout(refreshToken);
    return reply.status(204).send();
  });
};