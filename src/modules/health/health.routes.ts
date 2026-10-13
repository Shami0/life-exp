import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../../db/client";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    await db.execute(sql`select 1`);
    return { status: "ok", db: "up", time: new Date().toISOString() };
  });
};