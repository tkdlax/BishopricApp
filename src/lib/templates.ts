/**
 * Message templates for interviews (confirmation, etc.). Placeholders: {name}, {date}, {time}, {interviewType}, {locationSuffix}.
 */

import { db } from '../db/schema';
import { REACH_OUT_INTERVIEW_TYPES } from './reachOutTemplate';

export const INTERVIEW_TEMPLATE_TYPES = REACH_OUT_INTERVIEW_TYPES.map((t) => ({ type: t.type, name: t.name }));

export const INTERVIEW_LOCATION_DEFAULT = '';
export const INTERVIEW_LOCATION_OPTIONS = [
  { value: '', label: 'No location' },
  { value: 'bishop_office', label: "Bishop's office" },
  { value: 'bishop_home', label: "Bishop's home" },
  { value: 'other', label: 'Other' },
];

const DEFAULT_BODIES: Record<string, string> = {
  temple_recommend: 'Hi {name}, you have a temple recommend interview scheduled for {date} at {time}.{locationSuffix}',
  youth_annual: 'Hi {name}, you have a youth annual interview scheduled for {date} at {time}.{locationSuffix}',
  youth_semi_annual: 'Hi {name}, you have a youth semi-annual interview scheduled for {date} at {time}.{locationSuffix}',
  ordinance: 'Hi {name}, your ordinance interview is scheduled for {date} at {time}.{locationSuffix}',
  mission_prep: 'Hi {name}, your mission prep interview is scheduled for {date} at {time}.{locationSuffix}',
  ecclesiastical_endorsement: 'Hi {name}, your ecclesiastical endorsement interview is scheduled for {date} at {time}.{locationSuffix}',
  patriarchal_blessing: 'Hi {name}, your patriarchal blessing interview is scheduled for {date} at {time}.{locationSuffix}',
  tithing_declaration: 'Hi {name}, your tithing declaration is scheduled for {date} at {time}.{locationSuffix}',
};

export function getLocationSuffix(location?: string): string {
  if (!location?.trim()) return '';
  const opt = INTERVIEW_LOCATION_OPTIONS.find((o) => o.value === location);
  if (!opt?.label) return '';
  return ` Location: ${opt.label}.`;
}

export async function getRenderedTemplate(
  type: string,
  params: { name: string; date: string; time: string; interviewType?: string; locationSuffix?: string }
): Promise<string> {
  const template = await db.templates.where('type').equals(type).first();
  const body = template?.body ?? DEFAULT_BODIES[type] ?? 'Hi {name}, your appointment is {date} at {time}.';
  return body
    .replace(/\{name\}/g, params.name)
    .replace(/\{date\}/g, params.date)
    .replace(/\{time\}/g, params.time)
    .replace(/\{interviewType\}/g, params.interviewType ?? '')
    .replace(/\{locationSuffix\}/g, params.locationSuffix ?? '');
}

export const PRAYER_ASK_DEFAULT = 'Hi {name}, would you be willing to offer the {prayerType} prayer in sacrament meeting on {date}?';

export async function getPrayerAskMessage(name: string, prayerType: 'opening' | 'closing', dateLabel: string): Promise<string> {
  const template = await db.templates.where('type').equals('prayer_ask').first();
  const body = template?.body ?? PRAYER_ASK_DEFAULT;
  const prayerLabel = prayerType === 'opening' ? 'opening' : 'closing';
  return body
    .replace(/\{name\}/g, name)
    .replace(/\{prayerType\}/g, prayerLabel)
    .replace(/\{date\}/g, dateLabel);
}

export const YOUTH_REACH_OUT_DEFAULT = "Hello {recipient}, I'm reaching out on behalf of {bishopPhrase}, he'd love to schedule a time for {interviewType}. Is there a Sunday upcoming that would work?";

export async function getYouthReachOutBody(): Promise<string> {
  const template = await db.templates.where('type').equals('youth_reach_out').first();
  return template?.body ?? YOUTH_REACH_OUT_DEFAULT;
}
