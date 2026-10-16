import { z } from "zod";

const email = z.string().trim().toLowerCase().email();

const timezone = z
  .string()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone (e.g. Europe/Berlin)")
  .default("UTC");

export const registerBody = z.object({
  email,
  password: z.string().min(8).max(128),
  timezone,
});

export const loginBody = z.object({
  email,
  password: z.string().min(1),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(1),
});