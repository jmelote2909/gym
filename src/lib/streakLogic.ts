import { 
  isSaturday, 
  isSunday, 
  subDays, 
  startOfDay, 
  isAfter, 
  addDays,
  parseISO,
  format
} from 'date-fns';

/**
 * Calculates updated streak and lives based on gaps since last workout.
 * Monday-Friday are required training days.
 * 1 life is consumed per missed M-F day.
 * If 0 lives, streak resets to 0.
 * Lives regenerate every 15 days sequentially.
 */
export function calculateStreakAndLives(
  lastWorkoutDateStr: string | null,
  currentStreak: number,
  currentLives: number,
  nextLifeAtStr: string | null,
  missedDaysWithLifeArr: string[] = []
) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  let newLives = typeof currentLives === 'number' ? currentLives : 3;
  let newNextLifeAt = nextLifeAtStr ? new Date(nextLifeAtStr) : null;
  let newStreak = typeof currentStreak === 'number' ? currentStreak : 0;
  let newMissedDaysWithLife = Array.isArray(missedDaysWithLifeArr) ? [...missedDaysWithLifeArr] : [];

  // 1. Handle Life Regeneration
  // If we have less than 3 lives and the timer passed, add lives
  if (newLives < 3) {
    if (newNextLifeAt && !isAfter(newNextLifeAt, today)) {
       while (newLives < 3 && newNextLifeAt && !isAfter(newNextLifeAt, today)) {
          newLives += 1;
          if (newLives < 3) {
            newNextLifeAt = addDays(newNextLifeAt, 15);
          } else {
            newNextLifeAt = null;
          }
       }
    }
  }

  // 2. Handle Missed Days (Streak & Lives deduction)
  if (lastWorkoutDateStr) {
    let checkDay = startOfDay(addDays(parseISO(lastWorkoutDateStr), 1));
    const yesterday = startOfDay(subDays(today, 1));
    
    while (!isAfter(checkDay, yesterday)) {
      const dateStr = format(checkDay, 'yyyy-MM-dd');
      if (!isSaturday(checkDay) && !isSunday(checkDay)) {
        // Required M-F day missed
        // Only consume if not already consumed in this day (safeguard)
        if (!newMissedDaysWithLife.includes(dateStr)) {
          if (newLives > 0) {
            newLives -= 1;
            newMissedDaysWithLife.push(dateStr);
            // Start recovery timer if not already running
            if (!newNextLifeAt) {
              newNextLifeAt = addDays(new Date(), 15);
            }
          } else {
            newStreak = 0;
          }
        }
      }
      checkDay = addDays(checkDay, 1);
    }
  }

  return {
    streak: newStreak,
    lives: newLives,
    nextLifeAt: newNextLifeAt ? newNextLifeAt.toISOString() : null,
    todayTrained: lastWorkoutDateStr === todayStr,
    missedDaysWithLife: newMissedDaysWithLife
  };
}
