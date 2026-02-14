/**
 * UC-7.2: Resolve the correct message recipient for a person.
 * For youth: default to parent (per household defaultContactPreference); use youth only if allowed and number exists.
 */

import { db } from '../db/schema';
import type { Person } from '../db/schema';

/** True if person is under 18 (youth, primary, or birthDate indicates age < 18). Used to show "choose recipient" when adding confirmation text. */
export function isUnder18(person: Person): boolean {
  if (person.role === 'youth' || person.role === 'primary') return true;
  if (!person.birthDate || person.birthDate.length < 10) return false;
  const birthYear = parseInt(person.birthDate.slice(0, 4), 10);
  if (Number.isNaN(birthYear)) return false;
  const age = new Date().getFullYear() - birthYear;
  return age < 18;
}

/**
 * Returns the phone number to use when sending a message to or about this person.
 * For youth: uses household defaultContactPreference (text_mom, text_dad, both, individual).
 * For adult/primary: uses person.phones[0].
 * Returns null if no suitable number is found.
 */
export async function getMessageRecipientPhone(person: Person): Promise<string | null> {
  if (person.role !== 'youth') {
    return person.phones?.[0] ?? null;
  }

  const household = await db.households.get(person.householdId);
  if (!household) {
    return person.phones?.[0] ?? null;
  }

  const preference = household.defaultContactPreference ?? 'text_mom';
  if (preference === 'individual' && person.phones?.length) {
    return person.phones[0];
  }

  const members = await db.people.where('householdId').equals(person.householdId).toArray();
  const head = members.find((p) => p.householdRole === 'HEAD' && p.id !== person.id);
  const spouse = members.find((p) => p.householdRole === 'SPOUSE' && p.id !== person.id);

  if (preference === 'text_mom' || preference === 'text_dad') {
    const parent = preference === 'text_mom' ? (spouse ?? head) : (head ?? spouse);
    const phone = parent?.phones?.[0];
    if (phone) return phone;
  }
  if (preference === 'both') {
    const phone = (head ?? spouse)?.phones?.[0] ?? spouse?.phones?.[0];
    if (phone) return phone;
  }

  return person.phones?.[0] ?? null;
}

/** All household members that have at least one phone number (for "who should get the text?" picker). */
export async function getHouseholdMembersWithPhones(person: Person): Promise<Person[]> {
  const members = await db.people.where('householdId').equals(person.householdId).toArray();
  return members.filter((p) => p.phones?.length && p.phones[0]);
}
