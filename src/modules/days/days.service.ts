import { AppError } from "../../shared/errors";
import { addDays, todayInTimezone } from "../../shared/dates";
import { tasksService } from "../tasks/tasks.service";
import { usersService } from "../users/users.service";

export const daysService = {
  // Closes every finished day that hasn't been closed yet.
  // When there is nothing to close this is just one cheap lookup.
  async ensureClosed(userId: string) {
    const user = await usersService.findById(userId);
    if (!user) throw new AppError(401, "Unauthorized");

    const today = todayInTimezone(user.timezone);
    const lastDayToClose = addDays(today, -1);

    // First time ever: start from the day the account was created
    let day = user.lastClosedDate
      ? addDays(user.lastClosedDate, 1)
      : todayInTimezone(user.timezone, user.createdAt);

    while (day <= lastDayToClose) {
      await tasksService.closeDay(userId, day);
      // Later: await exerciseService.closeDay(userId, day);
      await usersService.advanceLastClosedDate(userId, day); // saved per day, so a crash can resume
      day = addDays(day, 1);
    }
  },
};