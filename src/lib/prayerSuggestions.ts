/**
 * Suggests people for prayer assignment based on least recent prayer (rotation).
 * Used by Prayer Dashboard (UC-6.1).
 */

import { db } from '../db/schema';
import { addDays } from './scheduling';
import type { Person, PrayerType } from '../db/schema';

export type PrayerRoleFilter = 'all' | 'youth' | 'primary';

const NOT_THIS_SUNDAY_BOOST_WEEKS = 4;

export interface SuggestedPerson {
  person: Person;
  lastPrayerDate: string | null; // YYYY-MM-DD, null = never
}

/**
 * Returns eligible people sorted by least recent prayer (oldest first), optionally filtered by role.
 * Excludes anyone skipped for this Sunday. "Not this Sunday" is treated as effective last date 4 weeks earlier so they return sooner.
 */
export async function getSuggestedPeopleForPrayer(
  prayerType: PrayerType,
  options: { roleFilter?: PrayerRoleFilter; limit?: number; forSunday?: string } = {}
): Promise<SuggestedPerson[]> {
  const { roleFilter = 'all', limit = 5, forSunday } = options;

  const [allPeople, historyRecords, completedAssignments, notThisSundayAssignments, skippedForSunday] = await Promise.all([
    db.people.toArray(),
    db.prayerHistory.where('prayerType').equals(prayerType).toArray(),
    db.prayerAssignments
      .where('prayerType')
      .equals(prayerType)
      .and((a) => a.status === 'completed')
      .toArray(),
    db.prayerAssignments
      .where('prayerType')
      .equals(prayerType)
      .and((a) => a.status === 'not_this_sunday')
      .toArray(),
    forSunday
      ? db.prayerSkipped.where('[prayerType+localDate]').equals([prayerType, forSunday]).toArray()
      : Promise.resolve([]),
  ]);

  const skippedPersonIds = new Set(skippedForSunday.map((s) => s.personId));
  const thisYear = new Date().getFullYear();

  const eligible = allPeople.filter((p) => {
    if (p.inactive || p.doNotAskForPrayer || !p.eligibleForPrayer || skippedPersonIds.has(p.id)) return false;
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    // Only 12 or older (turning 12 this year or older)
    if (p.birthDate && p.birthDate.length >= 10) {
      const birthYear = parseInt(p.birthDate.slice(0, 4), 10);
      const age = thisYear - birthYear;
      if (age < 12) return false;
    } else if (p.age != null && p.age < 12) return false;
    return true;
  });

  const lastByPerson = new Map<string, string>();
  for (const r of historyRecords) {
    const existing = lastByPerson.get(r.personId);
    if (!existing || r.localDate > existing) lastByPerson.set(r.personId, r.localDate);
  }
  for (const a of completedAssignments) {
    if (a.completedAt) {
      const dateStr = new Date(a.completedAt).toISOString().slice(0, 10);
      const existing = lastByPerson.get(a.personId);
      if (!existing || dateStr > existing) lastByPerson.set(a.personId, dateStr);
    }
  }
  for (const a of notThisSundayAssignments) {
    const effectiveEarlier = addDays(a.localDate, -7 * NOT_THIS_SUNDAY_BOOST_WEEKS);
    const existing = lastByPerson.get(a.personId);
    if (!existing || effectiveEarlier < existing) lastByPerson.set(a.personId, effectiveEarlier);
  }

  const withLast: SuggestedPerson[] = eligible.map((person) => ({
    person,
    lastPrayerDate: lastByPerson.get(person.id) ?? null,
  }));

  withLast.sort((a, b) => {
    const dateA = a.lastPrayerDate ?? '';
    const dateB = b.lastPrayerDate ?? '';
    return dateA.localeCompare(dateB);
  });

  // Shuffle so opening and closing get different order (semantically still "haven't said recently" but randomized)
  const shuffled = [...withLast];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, limit);
}

/** Record that this person was skipped for this Sunday so they are not re-suggested. */
export async function recordPrayerSkipped(
  personId: string,
  prayerType: PrayerType,
  localDate: string
): Promise<void> {
  const now = Date.now();
  await db.prayerSkipped.add({
    id: `ps-${now}-${Math.random().toString(36).slice(2, 9)}`,
    personId,
    prayerType,
    localDate,
    createdAt: now,
  });
}

/**
 * Call when an assignment is marked completed so rotation (least recent) stays accurate.
 */
export async function recordPrayerCompleted(
  personId: string,
  prayerType: PrayerType,
  localDate: string
): Promise<void> {
  const now = Date.now();
  const id = `ph-${now}-${Math.random().toString(36).slice(2, 9)}`;
  await db.prayerHistory.add({
    id,
    personId,
    prayerType,
    localDate,
    status: 'completed',
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}
