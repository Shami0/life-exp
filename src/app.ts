import Fastify from "fastify";
import { ZodError } from "zod";
import { pool } from "./db/client";
import { AppError } from "./shared/errors";
import { authPlugin } from "./shared/auth.plugin";
import { healthRoutes } from "./modules/health/health.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { tasksRoutes } from "./modules/tasks/tasks.routes";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "ValidationError", issues: error.issues });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    // Errors Fastify itself raises (bad JSON body, 404s, etc.) carry a statusCode
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 500;
    const message = error instanceof Error ? error.message : "Unknown error";

    if (!Number.isInteger(status) || status >= 500) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
    return reply.status(status).send({ error: message });
  });

  app.register(authPlugin);
  app.register(healthRoutes);
  app.register(authRoutes, { prefix: "/auth" });
  app.register(usersRoutes, { prefix: "/users" });
  app.register(tasksRoutes, { prefix: "/tasks" });

  return app;
}