import Fastify from "fastify";
import { pool } from "./db/client";
import { healthRoutes } from "./modules/health/health.routes";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  app.register(healthRoutes);

  return app;
}