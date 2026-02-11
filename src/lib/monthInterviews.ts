/**
 * Bishop interviews for the current month: query appointments + join people for display.
 */

import { db } from '../db/schema';
import { getMonthRange } from './scheduling';
import { minutesToTime } from './scheduling';

export interface MonthInterviewRow {
  appointmentId: string;
  localDate: string;
  minutesFromMidnight: number;
  personId: string;
  personName: string;
}

export async function getMonthInterviews(ref?: Date): Promise<MonthInterviewRow[]> {
  const { start, end } = getMonthRange(ref);
  const all = await db.appointments.where('type').equals('bishop_interview').toArray();
  const appointments = all
    .filter((a) => a.localDate >= start && a.localDate <= end)
    .sort((a, b) => {
      if (a.localDate !== b.localDate) return a.localDate.localeCompare(b.localDate);
      return a.minutesFromMidnight - b.minutesFromMidnight;
    });
  const byDate = appointments;
  const personIds = [...new Set(byDate.map((a) => a.personId))];
  const people = await db.people.bulkGet(personIds);
  const nameBy = new Map<string, string>();
  people.forEach((p) => {
    if (p) nameBy.set(p.id, p.nameListPreferred);
  });
  return byDate.map((a) => ({
    appointmentId: a.id,
    localDate: a.localDate,
    minutesFromMidnight: a.minutesFromMidnight,
    personId: a.personId,
    personName: nameBy.get(a.personId) ?? '—',
  }));
}

export function formatSundayLabel(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const dObj = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const sun = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return sun;
}

export { minutesToTime };
