import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client";
import { users, type NewUser } from "./users.schema";

export const usersRepository = {
  async findByEmail(email: string) {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  },

  async findById(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  },

  async create(data: NewUser) {
    const [row] = await db.insert(users).values(data).returning();
    return row;
  },

  async advanceLastClosedDate(id: string, day: string) {
    await db
      .update(users)
      .set({ lastClosedDate: day })
      .where(
        and(eq(users.id, id), or(isNull(users.lastClosedDate), lt(users.lastClosedDate, day))),
      );
  },
};