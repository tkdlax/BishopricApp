/**
 * Dexie schema v1 – aligned with plan (households, people, appointments, etc.)
 * All dates/times: localDate (YYYY-MM-DD) + minutesFromMidnight for scheduling.
 */

import Dexie, { type EntityTable } from 'dexie';

export const SCHEMA_VERSION = 8;

export type HouseholdRole = 'HEAD' | 'SPOUSE' | 'OTHER';
export type PersonRole = 'adult' | 'youth' | 'primary';
export type DefaultContactPreference = 'text_mom' | 'text_dad' | 'both' | 'individual';

export interface Household {
  id: string;
  sourceHouseholdUuid?: string;
  name: string;
  addressFormatted?: string;
  defaultContactPreference?: DefaultContactPreference;
  /** Exclude from tithing declaration list (e.g. will never attend). */
  excludeFromTithingDeclaration?: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Person {
  id: string;
  householdId: string;
  sourcePersonUuid?: string;
  nameListPreferred: string;
  nameGiven?: string;
  nameFamily?: string;
  normalizedName: string;
  phones: string[];
  email?: string;
  householdRole: HouseholdRole;
  role: PersonRole;
  age?: number;
  /** YYYY-MM-DD for birthday/semi-annual/advancement/baptism logic */
  birthDate?: string;
  /** For advancement (priesthood) list; if missing, show all and user selects */
  gender?: 'male' | 'female';
  eligibleForInterview: boolean;
  eligibleForPrayer: boolean;
  doNotAskForPrayer?: boolean;
  /** Exclude from interviews-to-get and scheduling pickers (e.g. inactive members). */
  doNotInterview?: boolean;
  inactive?: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type AppointmentType = 'bishop_interview' | 'tithing_declaration';
export type AppointmentStatus = 'hold' | 'invited' | 'confirmed' | 'completed' | 'canceled' | 'no_show';

export interface AppointmentHistoryEntry {
  at: number;
  who: string;
  what: string;
}

export interface Appointment {
  id: string;
  type: AppointmentType;
  personId: string;
  localDate: string; // YYYY-MM-DD
  minutesFromMidnight: number;
  durationMinutes: number;
  location?: string;
  status: AppointmentStatus;
  historyLog: AppointmentHistoryEntry[];
  /** Use-case key for message template (e.g. standard_interview, youth_interview). */
  interviewKind?: string;
  createdAt: number;
  updatedAt: number;
}

export type PrayerType = 'opening' | 'closing';
export type PrayerAssignmentStatus = 'suggested' | 'asked' | 'accepted' | 'completed' | 'declined' | 'not_this_sunday';

export interface PrayerAssignment {
  id: string;
  personId: string;
  localDate: string;
  prayerType: PrayerType;
  status: PrayerAssignmentStatus;
  askedAt?: number;
  acceptedAt?: number;
  completedAt?: number;
  declinedAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Skip suggestion for this Sunday only (do not re-suggest same person for same slot). */
export interface PrayerSkipped {
  id: string;
  personId: string;
  prayerType: PrayerType;
  localDate: string;
  createdAt: number;
}

export type MessageQueueStatus = 'pending' | 'opened' | 'sent' | 'skipped';

export interface MessageQueueItem {
  id: string;
  recipientPhone: string;
  renderedMessage: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  status: MessageQueueStatus;
  openedAt?: number;
  sentAt?: number;
  skippedAt?: number;
  skipReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  body: string;
  type: string;
  createdAt: number;
  updatedAt: number;
}

export interface Setting {
  id: string;
  value: string | number | boolean;
  updatedAt: number;
}

export interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: number;
  updatedAt: number;
}

export interface PrayerHistoryRecord {
  id: string;
  personId: string;
  prayerType: PrayerType;
  localDate: string;
  status: 'completed' | 'declined' | 'accepted_not_completed';
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface BlackoutDate {
  id: string;
  localDate: string;
  reason: string;
  createdAt: number;
  updatedAt: number;
}

export type TithingHouseholdStatus = 'not_contacted' | 'invited' | 'scheduled' | 'completed' | 'declined';

export interface TithingHousehold {
  id: string;
  campaignId: string;
  householdId: string;
  status: TithingHouseholdStatus;
  updatedAt: number;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/** 0 = every Sunday, 1–5 = 1st–5th Sunday of month. */
export interface RecurringScheduleItem {
  id: string;
  templateId: string;
  label: string;
  weekOfMonth: number; // 0 = all, 1 = 1st Sunday, ..., 5 = 5th
  startMinutes: number;
  endMinutes: number;
  order: number;
  reminderDaysBefore?: number | null;
  reminderRecipientKind?: 'none' | 'bishop' | 'custom';
  reminderRecipientPersonId?: string | null;
  yearEffective?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleItemException {
  id: string;
  templateId: string;
  itemId: string;
  localDate: string;
  createdAt: number;
  updatedAt: number;
}

/** One-off event on a day (no person, no message template). */
export interface DayBlock {
  id: string;
  localDate: string;
  startMinutes: number;
  endMinutes: number;
  label: string;
  createdAt: number;
  updatedAt: number;
}

/** Dismissal of an interview-to-get item for the current period only (e.g. "not this time"). */
export interface InterviewToGetDismissal {
  id: string;
  personId: string;
  reasonKey: string;
  periodKey: string;
  createdAt: number;
}

/** Notes for a specific interview-to-get item (person + reason key). */
export interface InterviewToGetNote {
  id: string;
  personId: string;
  reasonKey: string;
  notes: string;
  updatedAt: number;
}

/** User-added custom "interview to get" item. Free-form until you reach out or schedule. */
export interface CustomInterviewToGet {
  id: string;
  personId?: string;
  label: string;
  notes?: string;
  /** Optional target date for the interview (YYYY-MM-DD). */
  targetDay?: string;
  createdAt: number;
  completedAt?: number;
}

/** Advancement (priesthood) interview marked complete or scheduled – so it no longer appears in list. */
export interface AdvancementCompletion {
  id: string;
  personId: string;
  office: 'Deacon' | 'Teacher' | 'Priest';
  completedAt: number;
  createdAt: number;
}

/** Baptism interview marked complete or scheduled – so it no longer appears in list. */
export interface BaptismCompletion {
  id: string;
  personId: string;
  completedAt: number;
  createdAt: number;
}

/** Youth interview (birthday/semi-annual) marked complete so it no longer appears. */
export interface YouthInterviewCompletion {
  id: string;
  personId: string;
  reasonKey: string;
  year: number;
  completedAt: number;
  createdAt: number;
}

/** Advancement interview dismissed (won't happen) – remove from list without marking complete. */
export interface AdvancementDismissal {
  id: string;
  personId: string;
  office: string;
  createdAt: number;
}

/** Baptism interview dismissed (won't happen) – remove from list without marking complete. */
export interface BaptismDismissal {
  id: string;
  personId: string;
  createdAt: number;
}

export class BishopricDb extends Dexie {
  households!: EntityTable<Household, 'id'>;
  people!: EntityTable<Person, 'id'>;
  appointments!: EntityTable<Appointment, 'id'>;
  prayerAssignments!: EntityTable<PrayerAssignment, 'id'>;
  messageQueue!: EntityTable<MessageQueueItem, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  settings!: EntityTable<Setting, 'id'>;
  campaigns!: EntityTable<Campaign, 'id'>;
  prayerHistory!: EntityTable<PrayerHistoryRecord, 'id'>;
  prayerSkipped!: EntityTable<PrayerSkipped, 'id'>;
  blackoutDates!: EntityTable<BlackoutDate, 'id'>;
  tithingHouseholds!: EntityTable<TithingHousehold, 'id'>;
  scheduleTemplates!: EntityTable<ScheduleTemplate, 'id'>;
  recurringScheduleItems!: EntityTable<RecurringScheduleItem, 'id'>;
  scheduleItemExceptions!: EntityTable<ScheduleItemException, 'id'>;
  dayBlocks!: EntityTable<DayBlock, 'id'>;
  interviewToGetDismissals!: EntityTable<InterviewToGetDismissal, 'id'>;
  interviewToGetNotes!: EntityTable<InterviewToGetNote, 'id'>;
  customInterviewToGet!: EntityTable<CustomInterviewToGet, 'id'>;
  advancementCompletions!: EntityTable<AdvancementCompletion, 'id'>;
  baptismCompletions!: EntityTable<BaptismCompletion, 'id'>;
  youthInterviewCompletions!: EntityTable<YouthInterviewCompletion, 'id'>;
  advancementDismissals!: EntityTable<AdvancementDismissal, 'id'>;
  baptismDismissals!: EntityTable<BaptismDismissal, 'id'>;

  constructor() {
    super('BishopricDb');
    this.version(1).stores({
      households: 'id, sourceHouseholdUuid, name, updatedAt',
      people: 'id, householdId, sourcePersonUuid, normalizedName, inactive, eligibleForInterview, eligibleForPrayer, updatedAt',
      appointments: 'id, personId, type, localDate, minutesFromMidnight, status, createdAt, updatedAt',
      prayerAssignments: 'id, personId, localDate, prayerType, status, createdAt, updatedAt',
      messageQueue: 'id, status, recipientPhone, createdAt, updatedAt',
      templates: 'id, type, updatedAt',
      settings: 'id, updatedAt',
      campaigns: 'id, startDate, endDate, updatedAt',
      prayerHistory: 'id, personId, prayerType, localDate, createdAt, updatedAt',
      blackoutDates: 'id, localDate, updatedAt',
    });
    this.version(2).stores({
      tithingHouseholds: 'id, campaignId, householdId, status, updatedAt',
    });
    this.version(3).stores({
      scheduleTemplates: 'id, updatedAt',
      recurringScheduleItems: 'id, templateId, weekOfMonth, updatedAt',
      scheduleItemExceptions: 'id, templateId, itemId, localDate, updatedAt',
    });
    this.version(4).stores({
      prayerSkipped: 'id, [prayerType+localDate], personId, createdAt',
    });
    this.version(5).stores({
      dayBlocks: 'id, localDate, createdAt, updatedAt',
    });
    this.version(6).stores({
      interviewToGetDismissals: 'id, personId, reasonKey, periodKey, createdAt',
      interviewToGetNotes: 'id, personId, reasonKey, updatedAt, [personId+reasonKey]',
      customInterviewToGet: 'id, personId, createdAt, completedAt',
    });
    this.version(7).stores({
      advancementCompletions: 'id, personId, office, completedAt, createdAt',
      baptismCompletions: 'id, personId, completedAt, createdAt',
    });
    this.version(8).stores({
      youthInterviewCompletions: 'id, personId, reasonKey, year, completedAt, createdAt',
      advancementDismissals: 'id, personId, office, createdAt',
      baptismDismissals: 'id, personId, createdAt',
    });
  }
}

export const db = new BishopricDb();
