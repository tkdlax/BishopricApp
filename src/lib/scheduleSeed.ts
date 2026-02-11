/**
 * Seed default "Monthly Sunday Meeting" schedule template with standard blocks.
 * Call when no schedule template exists (e.g. first run or from Settings).
 */

import { db } from '../db/schema';

const TEMPLATE_ID = 'schedule-monthly-sunday';

function m(h: number, min: number): number {
  return h * 60 + min;
}

export async function seedDefaultScheduleTemplate(): Promise<void> {
  const existing = await db.scheduleTemplates.get(TEMPLATE_ID);
  if (existing) return;

  const now = Date.now();
  await db.scheduleTemplates.add({
    id: TEMPLATE_ID,
    name: 'Monthly Sunday Meeting',
    description: 'Ward Sunday schedule (1st–5th Sundays)',
    createdAt: now,
    updatedAt: now,
  });

  const items: Array<{
    id: string;
    templateId: string;
    label: string;
    weekOfMonth: number;
    startMinutes: number;
    endMinutes: number;
    order: number;
  }> = [
    // Common (week 0 = every Sunday)
    { id: `${TEMPLATE_ID}-common-prepare`, templateId: TEMPLATE_ID, label: 'Prepare for Church', weekOfMonth: 0, startMinutes: m(11, 30), endMinutes: m(12, 0), order: 0 },
    { id: `${TEMPLATE_ID}-common-1st`, templateId: TEMPLATE_ID, label: 'Church (1st Hour)', weekOfMonth: 0, startMinutes: m(12, 0), endMinutes: m(13, 0), order: 1 },
    { id: `${TEMPLATE_ID}-common-2nd`, templateId: TEMPLATE_ID, label: 'Church (2nd Hour)', weekOfMonth: 0, startMinutes: m(13, 0), endMinutes: m(14, 0), order: 2 },
    { id: `${TEMPLATE_ID}-common-interviews`, templateId: TEMPLATE_ID, label: 'Bishop interviews as needed', weekOfMonth: 0, startMinutes: m(14, 0), endMinutes: m(16, 0), order: 3 },
    // 1st Sunday
    { id: `${TEMPLATE_ID}-1-bishopric`, templateId: TEMPLATE_ID, label: 'Bishopric Meeting', weekOfMonth: 1, startMinutes: m(9, 0), endMinutes: m(9, 30), order: 10 },
    { id: `${TEMPLATE_ID}-1-eq`, templateId: TEMPLATE_ID, label: 'Elders Quorum', weekOfMonth: 1, startMinutes: m(10, 0), endMinutes: m(10, 30), order: 11 },
    { id: `${TEMPLATE_ID}-1-rs`, templateId: TEMPLATE_ID, label: 'Relief Society', weekOfMonth: 1, startMinutes: m(10, 30), endMinutes: m(11, 0), order: 12 },
    { id: `${TEMPLATE_ID}-1-quorum`, templateId: TEMPLATE_ID, label: 'Quorum Presidency Meetings', weekOfMonth: 1, startMinutes: m(11, 0), endMinutes: m(11, 30), order: 13 },
    { id: `${TEMPLATE_ID}-1-linger`, templateId: TEMPLATE_ID, label: 'Linger Longer', weekOfMonth: 1, startMinutes: m(14, 0), endMinutes: m(15, 0), order: 14 },
    { id: `${TEMPLATE_ID}-1-interviews-pm`, templateId: TEMPLATE_ID, label: 'Bishop interviews as needed', weekOfMonth: 1, startMinutes: m(15, 0), endMinutes: m(16, 0), order: 15 },
    // 2nd Sunday
    { id: `${TEMPLATE_ID}-2-bishopric`, templateId: TEMPLATE_ID, label: 'Bishopric Meeting', weekOfMonth: 2, startMinutes: m(9, 30), endMinutes: m(10, 30), order: 20 },
    { id: `${TEMPLATE_ID}-2-council`, templateId: TEMPLATE_ID, label: 'Ward Council', weekOfMonth: 2, startMinutes: m(10, 30), endMinutes: m(11, 30), order: 21 },
    { id: `${TEMPLATE_ID}-2-interviews`, templateId: TEMPLATE_ID, label: 'Bishop interviews as needed', weekOfMonth: 2, startMinutes: m(14, 0), endMinutes: m(15, 0), order: 22 },
    // 3rd Sunday
    { id: `${TEMPLATE_ID}-3-bishopric`, templateId: TEMPLATE_ID, label: 'Bishopric Meeting', weekOfMonth: 3, startMinutes: m(9, 0), endMinutes: m(9, 30), order: 30 },
    { id: `${TEMPLATE_ID}-3-primary`, templateId: TEMPLATE_ID, label: 'Primary', weekOfMonth: 3, startMinutes: m(10, 0), endMinutes: m(10, 30), order: 31 },
    { id: `${TEMPLATE_ID}-3-yw`, templateId: TEMPLATE_ID, label: 'Young Women', weekOfMonth: 3, startMinutes: m(10, 30), endMinutes: m(11, 0), order: 32 },
    { id: `${TEMPLATE_ID}-3-wyc`, templateId: TEMPLATE_ID, label: 'WYC', weekOfMonth: 3, startMinutes: m(11, 0), endMinutes: m(11, 30), order: 33 },
    { id: `${TEMPLATE_ID}-3-interviews`, templateId: TEMPLATE_ID, label: 'Bishop interviews as needed', weekOfMonth: 3, startMinutes: m(14, 0), endMinutes: m(15, 0), order: 34 },
    // 4th Sunday
    { id: `${TEMPLATE_ID}-4-bishopric`, templateId: TEMPLATE_ID, label: 'Bishopric Meeting', weekOfMonth: 4, startMinutes: m(9, 30), endMinutes: m(10, 30), order: 40 },
    { id: `${TEMPLATE_ID}-4-council`, templateId: TEMPLATE_ID, label: 'Ward Council', weekOfMonth: 4, startMinutes: m(10, 30), endMinutes: m(11, 30), order: 41 },
    { id: `${TEMPLATE_ID}-4-interviews`, templateId: TEMPLATE_ID, label: 'Bishop interviews as needed', weekOfMonth: 4, startMinutes: m(14, 0), endMinutes: m(15, 0), order: 42 },
    // 5th Sunday
    { id: `${TEMPLATE_ID}-5-bishopric`, templateId: TEMPLATE_ID, label: 'Bishopric Meeting', weekOfMonth: 5, startMinutes: m(10, 30), endMinutes: m(11, 30), order: 50 },
    { id: `${TEMPLATE_ID}-5-ss`, templateId: TEMPLATE_ID, label: 'Sunday School (combined), then meet with Bishop', weekOfMonth: 5, startMinutes: m(14, 0), endMinutes: m(15, 0), order: 51 },
    { id: `${TEMPLATE_ID}-5-interviews`, templateId: TEMPLATE_ID, label: 'Bishop interviews as needed', weekOfMonth: 5, startMinutes: m(15, 0), endMinutes: m(16, 0), order: 52 },
  ];

  for (const item of items) {
    await db.recurringScheduleItems.add({
      ...item,
      reminderDaysBefore: null,
      reminderRecipientKind: 'none',
      reminderRecipientPersonId: null,
      yearEffective: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
