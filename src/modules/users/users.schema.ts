import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Needed later so "today" means YOUR today, not the server's
  timezone: text("timezone").notNull().default("UTC"),
  // Last calendar day that has been closed out (step 4 uses this)
  lastClosedDate: date("last_closed_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;