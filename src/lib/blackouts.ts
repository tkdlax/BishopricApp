import { db } from '../db/schema';
import type { BlackoutDate } from '../db/schema';

export async function getBlackoutDates(): Promise<string[]> {
  const list = await db.blackoutDates.toArray();
  return list.map((b) => b.localDate);
}

export async function addBlackout(localDate: string, reason: string): Promise<void> {
  const now = Date.now();
  await db.blackoutDates.add({
    id: `blackout-${localDate}-${now}`,
    localDate,
    reason,
    createdAt: now,
    updatedAt: now,
  });
}

export async function removeBlackout(id: string): Promise<void> {
  await db.blackoutDates.delete(id);
}

export async function getBlackoutsForDate(localDate: string): Promise<BlackoutDate[]> {
  return db.blackoutDates.where('localDate').equals(localDate).toArray();
}

/** First Sunday of a given month. */
function firstSunday(year: number, month: number): string {
  const first = new Date(year, month - 1, 1);
  const day = first.getDay();
  const add = day === 0 ? 0 : 7 - day;
  const d = new Date(year, month - 1, 1 + add);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** One-tap: General Conference Sundays (first Sunday April + October). */
export function getGeneralConferenceDates(year: number): string[] {
  return [firstSunday(year, 4), firstSunday(year, 10)];
}
