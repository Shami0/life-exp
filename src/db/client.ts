import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as usersSchema from "../modules/users/users.schema";
import * as authSchema from "../modules/auth/auth.schema";

// Every module's schema gets added here as we build it

export const schema = { ...usersSchema, ...authSchema };

export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });