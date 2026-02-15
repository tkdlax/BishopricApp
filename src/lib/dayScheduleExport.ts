/**
 * Build a simple text summary of a day's schedule (same data as Day view)
 * for sending to Bishop via text or WhatsApp.
 */

import { db } from '../db/schema';
import { formatTimeAmPm, getWeekOfMonth } from './scheduling';
import { formatLongDate } from './monthInterviews';

const DEFAULT_TEMPLATE_ID = 'schedule-monthly-sunday';
const DURATION = 20;

type DayEvent =
  | { type: 'appointment'; label: string; start: number; end: number }
  | { type: 'block'; label: string; start: number; end: number }
  | { type: 'recurring'; label: string; start: number; end: number };

/**
 * Load all events for a day (appointments, day blocks, recurring with exceptions)
 * and return a plain-text list ready to send.
 */
export async function getDayScheduleText(localDate: string): Promise<string> {
  const week = getWeekOfMonth(localDate);
  const [appointments, dayBlocks, recurring, peopleList, exceptions] = await Promise.all([
    db.appointments.where('localDate').equals(localDate).toArray(),
    db.dayBlocks.where('localDate').equals(localDate).toArray(),
    db.recurringScheduleItems.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
    db.people.toArray(),
    db.scheduleItemExceptions.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
  ]);
  const exceptionItemIds = new Set(exceptions.filter((e) => e.localDate === localDate).map((e) => e.itemId));
  const nameBy = new Map(peopleList.map((p) => [p.id, p.nameListPreferred]));

  const list: DayEvent[] = [];
  for (const a of appointments) {
    if (a.status === 'canceled') continue;
    const end = a.minutesFromMidnight + (a.durationMinutes ?? DURATION);
    list.push({
      type: 'appointment',
      label: nameBy.get(a.personId) ?? 'Interview',
      start: a.minutesFromMidnight,
      end,
    });
  }
  for (const b of dayBlocks) {
    list.push({ type: 'block', label: b.label, start: b.startMinutes, end: b.endMinutes });
  }
  for (const r of recurring) {
    if (exceptionItemIds.has(r.id)) continue;
    if (r.weekOfMonth !== 0 && r.weekOfMonth !== week) continue;
    list.push({ type: 'recurring', label: r.label, start: r.startMinutes, end: r.endMinutes });
  }
  list.sort((a, b) => a.start - b.start);

  const title = formatLongDate(localDate);
  const lines = list.map((ev) => {
    const time = formatTimeAmPm(ev.start);
    const suffix = ev.type === 'appointment' ? ' (interview)' : ev.type === 'recurring' ? ' (recurring)' : '';
    return `${time} – ${ev.label}${suffix}`;
  });
  if (lines.length === 0) {
    return `${title} – Schedule\n\nNo items scheduled.`;
  }
  return `${title} – Schedule\n\n${lines.join('\n')}`;
}
