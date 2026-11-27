import { pool } from "../src/db/client";
import { exercisesService } from "../src/modules/exercise/exercises.service";

async function main() {
  const count = await exercisesService.syncBuiltIns();
  console.log(`Synced ${count} built-in exercises.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());