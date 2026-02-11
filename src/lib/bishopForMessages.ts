/**
 * Bishop name for message templates (e.g. reach-out: "on behalf of bishop [last name]").
 * Stores bishop person id in settings; returns last name for use in templates.
 */

import { db } from '../db/schema';
import type { Person } from '../db/schema';

export const BISHOP_PERSON_ID_KEY = 'bishopPersonId';

/**
 * Returns the bishop's last name for use in messages (e.g. "Smith" for "bishop Smith").
 * Uses the person selected in Settings (bishop person id); falls back to nameFamily or last word of nameListPreferred.
 * Returns empty string if no bishop set or person not found.
 */
export async function getBishopLastNameForMessage(): Promise<string> {
  const setting = await db.settings.get(BISHOP_PERSON_ID_KEY);
  const personId = typeof setting?.value === 'string' ? setting.value : null;
  if (!personId) return '';
  const person = await db.people.get(personId);
  if (!person) return '';
  if (person.nameFamily?.trim()) return person.nameFamily.trim();
  const parts = (person.nameListPreferred || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : (parts[0] ?? '');
}

/**
 * Load the bishop person record (for Settings UI or other use).
 */
export async function getBishopPerson(): Promise<Person | null> {
  const setting = await db.settings.get(BISHOP_PERSON_ID_KEY);
  const personId = typeof setting?.value === 'string' ? setting.value : null;
  if (!personId) return null;
  const person = await db.people.get(personId);
  return person ?? null;
}
