import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";
import { toPublicUser, usersService } from "../users/users.service";
import { authRepository } from "./auth.repository";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function issueRefreshToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await authRepository.insertRefreshToken({ userId, tokenHash: hashToken(token), expiresAt });
  return token;
}

export const authService = {
  async register(input: { email: string; password: string; timezone: string }) {
    const existing = await usersService.findByEmail(input.email);
    if (existing) throw new AppError(409, "Email already registered");

    const passwordHash = await argon2.hash(input.password);
    const user = await usersService.create({
      email: input.email,
      passwordHash,
      timezone: input.timezone,
    });

    return { user: toPublicUser(user), refreshToken: await issueRefreshToken(user.id) };
  },

  async login(input: { email: string; password: string }) {
    const user = await usersService.findByEmail(input.email);
    const valid = user ? await argon2.verify(user.passwordHash, input.password) : false;
    if (!user || !valid) throw new AppError(401, "Invalid email or password");

    return { user: toPublicUser(user), refreshToken: await issueRefreshToken(user.id) };
  },

  async refresh(token: string) {
    const record = await authRepository.findByHash(hashToken(token));
    if (!record) throw new AppError(401, "Invalid refresh token");

    if (record.revokedAt) {
      // An already-used token came back: possible theft, so end all sessions
      await authRepository.revokeAllForUser(record.userId);
      throw new AppError(401, "Invalid refresh token");
    }
    if (record.expiresAt < new Date()) throw new AppError(401, "Refresh token expired");

    await authRepository.revoke(record.id);
    return { userId: record.userId, refreshToken: await issueRefreshToken(record.userId) };
  },

  async logout(token: string) {
    const record = await authRepository.findByHash(hashToken(token));
    if (record && !record.revokedAt) await authRepository.revoke(record.id);
  },
};