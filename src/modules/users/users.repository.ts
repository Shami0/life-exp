import { eq } from "drizzle-orm";
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
};