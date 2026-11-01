import type { FastifyRequest } from "fastify";
import { daysService } from "./days.service";

export async function closePastDays(request: FastifyRequest) {
  await daysService.ensureClosed(request.user.sub);
}