/**
 * Message templates for interviews (confirmation, etc.). Placeholders: {name}, {date}, {time}, {interviewType}, {locationSuffix}.
 */

import { db } from '../db/schema';

export const INTERVIEW_TEMPLATE_TYPES = [
  { type: 'standard_interview', name: 'Bishop interview' },
  { type: 'youth_interview', name: 'Youth interview' },
  { type: 'tithing_declaration', name: 'Tithing declaration' },
];

export const INTERVIEW_LOCATION_DEFAULT = '';
export const INTERVIEW_LOCATION_OPTIONS = [
  { value: '', label: 'No location' },
  { value: 'bishop_office', label: "Bishop's office" },
  { value: 'bishop_home', label: "Bishop's home" },
  { value: 'other', label: 'Other' },
];

const DEFAULT_BODIES: Record<string, string> = {
  standard_interview: 'Hi {name}, you have a bishop interview scheduled for {date} at {time}.{locationSuffix}',
  youth_interview: 'Hi {name}, you have a youth interview scheduled for {date} at {time}.{locationSuffix}',
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
