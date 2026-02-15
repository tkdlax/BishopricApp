/**
 * Recurring schedule reminders: when "today + reminderDaysBefore" equals an item's
 * next occurrence date, add a message to the queue for the configured recipient.
 * Runs once per day on app load (lastReminderCheckDate in settings).
 */

import { db } from '../db/schema';
import type { RecurringScheduleItem } from '../db/schema';
import { getBishopPerson } from './bishopForMessages';
import { todayLocalDate, addDays, upcomingSunday, getWeekOfMonth } from './scheduling';

const DEFAULT_TEMPLATE_ID = 'schedule-monthly-sunday';
const LAST_REMINDER_CHECK_DATE_KEY = 'lastReminderCheckDate';

function getNextOccurrenceDate(item: RecurringScheduleItem, fromDate: string): string {
  let d = upcomingSunday(fromDate);
  if (item.weekOfMonth === 0) return d;
  while (getWeekOfMonth(d) !== item.weekOfMonth) {
    d = addDays(d, 7);
  }
  return d;
}

function formatDateForMessage(localDate: string): string {
  return localDate.replace(/-/g, '/');
}

export async function runReminderQueueIfNeeded(): Promise<void> {
  const today = todayLocalDate();
  const lastCheck = await db.settings.get(LAST_REMINDER_CHECK_DATE_KEY);
  const lastDate = typeof lastCheck?.value === 'string' ? lastCheck.value : '';
  if (lastDate === today) return;

  const [items, exceptions] = await Promise.all([
    db.recurringScheduleItems
      .where('templateId')
      .equals(DEFAULT_TEMPLATE_ID)
      .filter((item) => Boolean((item.reminderDaysBefore ?? 0) > 0 && item.reminderRecipientKind && item.reminderRecipientKind !== 'none'))
      .toArray(),
    db.scheduleItemExceptions.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
  ]);
  const exceptionSet = new Set(exceptions.map((e) => `${e.itemId}-${e.localDate}`));

  for (const item of items) {
    const daysBefore = item.reminderDaysBefore ?? 0;
    if (daysBefore <= 0) continue;
    let occurrenceDate = getNextOccurrenceDate(item, today);
    while (exceptionSet.has(`${item.id}-${occurrenceDate}`)) {
      occurrenceDate = addDays(occurrenceDate, 7);
    }
    const reminderDate = addDays(occurrenceDate, -daysBefore);
    if (reminderDate !== today) continue;

    const dedupeId = `schedule_reminder-${item.id}-${occurrenceDate}`;
    const existing = await db.messageQueue.filter((m) => m.relatedObjectId === dedupeId).first();
    if (existing) continue;

    let phone: string | undefined;
    if (item.reminderRecipientKind === 'bishop') {
      const bishop = await getBishopPerson();
      phone = bishop?.phones?.[0];
    } else if (item.reminderRecipientKind === 'custom' && item.reminderRecipientPersonId) {
      const person = await db.people.get(item.reminderRecipientPersonId);
      phone = person?.phones?.[0];
    }
    if (!phone) continue;

    const body = `Reminder: ${item.label} on ${formatDateForMessage(occurrenceDate)}.`;
    const now = Date.now();
    await db.messageQueue.add({
      id: `msg-${now}-${Math.random().toString(36).slice(2, 9)}`,
      recipientPhone: phone,
      renderedMessage: body,
      relatedObjectType: 'schedule_reminder',
      relatedObjectId: dedupeId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  const now = Date.now();
  await db.settings.put({ id: LAST_REMINDER_CHECK_DATE_KEY, value: today, updatedAt: now });
}
