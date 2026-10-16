import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { refreshTokens } from "./auth.schema";

export const authRepository = {
  async insertRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    await db.insert(refreshTokens).values(data);
  },

  async findByHash(tokenHash: string) {
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  },

  async revoke(id: string) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
  },

  async revokeAllForUser(userId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  },
};