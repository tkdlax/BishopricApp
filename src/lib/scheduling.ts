/**
 * Scheduling helpers: time format, dates, next Sunday, slots, availability.
 */

import { db } from '../db/schema';

/** Format minutes-from-midnight as HH:MM (24h). For internal use / time inputs. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format minutes-from-midnight as AM/PM (e.g. "2:30 PM"). For display. */
export function formatTimeAmPm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function todayLocalDate(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function parseLocalDate(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLocalDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function addDays(localDate: string, days: number): string {
  const d = parseLocalDate(localDate);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function nextSunday(fromDate?: string): string {
  const from = fromDate ? parseLocalDate(fromDate) : new Date();
  const day = from.getDay();
  const add = day === 0 ? 7 : 7 - day;
  from.setDate(from.getDate() + add);
  return formatLocalDate(from);
}

/** Upcoming Sunday: today if today is Sunday, otherwise the next Sunday. */
export function upcomingSunday(fromDate?: string): string {
  const today = fromDate ?? todayLocalDate();
  const from = parseLocalDate(today);
  if (from.getDay() === 0) return today;
  return nextSunday(today);
}

/** First and last day of month as YYYY-MM-DD (for filtering). */
export function getMonthRange(ref?: Date): { start: string; end: string } {
  const d = ref ?? new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/** Week of month (1-5) for a date. 1 = 1st Sunday, etc. */
export function getWeekOfMonth(localDate: string): number {
  const d = parseLocalDate(localDate);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstDay = first.getDay();
  const firstSunday = first.getDate() + (firstDay === 0 ? 0 : 7 - firstDay);
  return Math.floor((d.getDate() - firstSunday) / 7) + 1;
}

/** Build slot minutes from start (inclusive), end (inclusive), interval. */
export function buildSlotMinutes(startMinutes: number, endMinutes: number, intervalMinutes: number): number[] {
  const out: number[] = [];
  for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) out.push(m);
  return out;
}

export const INTERVIEW_SLOT_START_KEY = 'interviewSlotStart';
export const INTERVIEW_SLOT_END_KEY = 'interviewSlotEnd';
export const INTERVIEW_SLOT_INTERVAL_KEY = 'interviewSlotInterval';

const DEFAULT_INTERVIEW_START = 14 * 60;
const DEFAULT_INTERVIEW_END = 16 * 60;
const DEFAULT_INTERVIEW_INTERVAL = 20;

export async function getInterviewSlotMinutes(): Promise<number[]> {
  const [startS, endS, intervalS] = await Promise.all([
    db.settings.get(INTERVIEW_SLOT_START_KEY),
    db.settings.get(INTERVIEW_SLOT_END_KEY),
    db.settings.get(INTERVIEW_SLOT_INTERVAL_KEY),
  ]);
  const start = typeof startS?.value === 'number' ? startS.value : DEFAULT_INTERVIEW_START;
  const end = typeof endS?.value === 'number' ? endS.value : DEFAULT_INTERVIEW_END;
  const interval = typeof intervalS?.value === 'number' && intervalS.value > 0 ? intervalS.value : DEFAULT_INTERVIEW_INTERVAL;
  if (start >= end || interval <= 0) return buildSlotMinutes(9 * 60, 11 * 60, 30);
  return buildSlotMinutes(start, end, interval);
}

export async function getInterviewSlotWindow(): Promise<{ start: number; end: number }> {
  const [startS, endS] = await Promise.all([
    db.settings.get(INTERVIEW_SLOT_START_KEY),
    db.settings.get(INTERVIEW_SLOT_END_KEY),
  ]);
  const start = typeof startS?.value === 'number' ? startS.value : DEFAULT_INTERVIEW_START;
  const end = typeof endS?.value === 'number' ? endS.value : DEFAULT_INTERVIEW_END;
  return start < end ? { start, end } : { start: DEFAULT_INTERVIEW_START, end: DEFAULT_INTERVIEW_END };
}

export interface SlotInfo {
  localDate: string;
  minutesFromMidnight: number;
  label: string;
  taken: boolean;
}

export async function getSlotsForDate(
  localDate: string,
  appointments: { localDate: string; minutesFromMidnight: number; durationMinutes?: number }[],
  blackouts: string[],
  slotMinutes: number[]
): Promise<SlotInfo[]> {
  if (blackouts.includes(localDate)) return [];
  const taken = new Set<number>();
  for (const a of appointments) {
    if (a.localDate !== localDate) continue;
    const dur = a.durationMinutes ?? 20;
    for (let m = a.minutesFromMidnight; m < a.minutesFromMidnight + dur; m += 15) {
      taken.add(m);
    }
  }
  return slotMinutes.map((minutesFromMidnight) => {
    const dur = 20;
    let blocked = false;
    for (let m = minutesFromMidnight; m < minutesFromMidnight + dur; m += 15) {
      if (taken.has(m)) {
        blocked = true;
        break;
      }
    }
    const h = Math.floor(minutesFromMidnight / 60);
    const min = minutesFromMidnight % 60;
    const label = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return { localDate, minutesFromMidnight, label, taken: blocked };
  });
}

export function getNextAvailableSlot(
  fromLocalDate: string,
  appointments: { localDate: string; minutesFromMidnight: number; durationMinutes?: number }[],
  blackouts: string[],
  slotMinutes: number[]
): { localDate: string; minutesFromMidnight: number } | null {
  let date = fromLocalDate;
  for (let i = 0; i < 8; i++) {
    if (blackouts.includes(date)) {
      date = addDays(date, 1);
      continue;
    }
    const taken = new Set<string>();
    for (const a of appointments) {
      if (a.localDate !== date) continue;
      const dur = a.durationMinutes ?? 20;
      for (let m = a.minutesFromMidnight; m < a.minutesFromMidnight + dur; m += 15) {
        taken.add(`${date}-${m}`);
      }
    }
    for (const minutesFromMidnight of slotMinutes) {
      let blocked = false;
      for (let m = minutesFromMidnight; m < minutesFromMidnight + 20; m += 15) {
        if (taken.has(`${date}-${m}`)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { localDate: date, minutesFromMidnight };
    }
    date = addDays(date, 1);
  }
  return null;
}
