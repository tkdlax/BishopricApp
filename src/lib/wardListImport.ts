/**
 * Ward list import: normalize JSON and merge into DB.
 * Minimal stub so ImportWardList compiles; extend with real LCR/member-list parsing as needed.
 */

import { db } from '../db/schema';
import type { Household, Person } from '../db/schema';
import type { HouseholdRole, PersonRole } from '../db/schema';

function normalizeName(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NormalizedWardList {
  households: Household[];
  people: Person[];
}

/** Normalize raw ward list JSON to Household[] and Person[]. */
export function normalizeWardListJson(raw: unknown[]): NormalizedWardList {
  const now = Date.now();
  const households: Household[] = [];
  const people: Person[] = [];
  const seenHouseholds = new Set<string>();

  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const nameFormats = r.nameFormats as Record<string, unknown> | undefined;
    const household = r.household as Record<string, unknown> | undefined;
    const hhUuid = String(r.householdUuid ?? r.sourceHouseholdUuid ?? r.householdId ?? '');
    const name = String(r.name ?? r.houseHoldMemberNameForList ?? r.nameListPreferred ?? 'Unknown').trim();
    const listName = String(nameFormats?.listPreferredLocal ?? r.nameListPreferredLocal ?? name).trim();
    const givenName = String(nameFormats?.givenPreferredLocal ?? r.houseHoldMemberNameForList ?? '').trim();
    const familyName = String(nameFormats?.familyPreferredLocal ?? '').trim();
    const phones: string[] = Array.isArray(r.phones) ? (r.phones as string[]).filter(Boolean) : [];
    const email = typeof r.email === 'string' ? r.email.trim() : undefined;
    const householdRole = (['HEAD', 'SPOUSE', 'OTHER'].includes(String(r.householdRole)) ? r.householdRole : 'OTHER') as HouseholdRole;
    const role = (['adult', 'youth', 'primary'].includes(String(r.role)) ? r.role : 'adult') as PersonRole;

    const hhId = hhUuid ? `hh-${hhUuid.slice(0, 20)}` : `hh-${now}-${households.length}`;
    if (!seenHouseholds.has(hhId)) {
      seenHouseholds.add(hhId);
      households.push({
        id: hhId,
        sourceHouseholdUuid: hhUuid || undefined,
        name: String(r.householdName ?? household?.name ?? 'Household').trim() || 'Household',
        createdAt: now,
        updatedAt: now,
      });
    }

    const personId = String(r.personUuid ?? r.sourcePersonUuid ?? r.id ?? `p-${now}-${people.length}`);
    people.push({
      id: personId,
      householdId: hhId,
      sourcePersonUuid: String(r.personUuid ?? r.sourcePersonUuid ?? ''),
      nameListPreferred: listName || name,
      nameGiven: givenName || undefined,
      nameFamily: familyName || undefined,
      normalizedName: normalizeName(listName || name),
      phones,
      email: email || undefined,
      householdRole,
      role,
      eligibleForInterview: true,
      eligibleForPrayer: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { households, people };
}

/** Merge normalized households and people into DB (replace or merge by source id). */
export async function mergeWardListIntoDb(normalized: NormalizedWardList): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.households, db.people, async () => {
    for (const h of normalized.households) {
      await db.households.put({ ...h, updatedAt: now });
    }
    for (const p of normalized.people) {
      await db.people.put({ ...p, updatedAt: now });
    }
  });
}
