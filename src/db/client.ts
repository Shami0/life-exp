import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as usersSchema from "../modules/users/users.schema";
import * as authSchema from "../modules/auth/auth.schema";
import * as tasksSchema from "../modules/tasks/tasks.schema";

// Man, Modules are pretty daunting things to track. I really like micro-services 

export const schema = { ...usersSchema, ...authSchema, ...tasksSchema };

export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });