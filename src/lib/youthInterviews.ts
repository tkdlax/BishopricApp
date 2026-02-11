/**
 * Youth interview rules: who to request and when.
 * Birthday month → bishop; semi-annual (6 months from birthday) → counselor for under 16, bishop for 16+.
 */

import type { Person } from '../db/schema';

export type Leader = 'bishop' | 'counselor';

export interface YouthDueItem {
  person: Person;
  leader: Leader;
  reason: 'birthday_month' | 'semi_annual';
  month: number;
  year: number;
}

function parseBirthDate(p: Person): { year: number; month: number; day: number } | null {
  const b = p.birthDate;
  if (!b || b.length < 10) return null;
  const y = parseInt(b.slice(0, 4), 10);
  const m = parseInt(b.slice(5, 7), 10);
  const d = parseInt(b.slice(8, 10), 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { year: y, month: m, day: d };
}

function ageTurningInYear(birthYear: number, refYear: number): number {
  return refYear - birthYear;
}

function currentYear(): number {
  return new Date().getFullYear();
}

export function isYouth(p: Person): boolean {
  if (p.role === 'youth') return true;
  const b = parseBirthDate(p);
  if (!b) return false;
  const age = ageTurningInYear(b.year, currentYear());
  return age >= 12 && age <= 18;
}

export function getLeaderForYouthInterview(person: Person, reason: 'birthday_month' | 'semi_annual'): Leader {
  if (reason === 'birthday_month') return 'bishop';
  const b = parseBirthDate(person);
  const ageThisYear = b ? ageTurningInYear(b.year, currentYear()) : (person.age ?? null);
  if (ageThisYear !== null && ageThisYear >= 16) return 'bishop';
  return 'counselor';
}

export function getYouthDueThisYear(person: Person): YouthDueItem[] {
  if (person.doNotInterview) return [];
  const b = parseBirthDate(person);
  if (!b) return [];
  const ageThisYear = ageTurningInYear(b.year, currentYear());
  if (ageThisYear < 12 || ageThisYear > 18) return [];
  const year = currentYear();
  const result: YouthDueItem[] = [];
  result.push({ person, leader: 'bishop', reason: 'birthday_month', month: b.month, year });
  const semiMonth = b.month + 6 <= 12 ? b.month + 6 : b.month + 6 - 12;
  const semiYear = b.month + 6 <= 12 ? year : year + 1;
  result.push({
    person,
    leader: getLeaderForYouthInterview(person, 'semi_annual'),
    reason: 'semi_annual',
    month: semiMonth,
    year: semiYear,
  });
  return result;
}

export interface AdvancementCandidate {
  person: Person;
  office: 'Deacon' | 'Teacher' | 'Priest';
  turningAge: number;
}

export function getAdvancementCandidates(people: Person[], refYear?: number): AdvancementCandidate[] {
  const year = refYear ?? currentYear();
  const out: AdvancementCandidate[] = [];
  for (const p of people) {
    if (p.doNotInterview) continue;
    const b = parseBirthDate(p);
    if (!b) continue;
    const age = year - b.year;
    if (p.gender === 'female') continue;
    if (age === 12) out.push({ person: p, office: 'Deacon', turningAge: 12 });
    if (age === 14) out.push({ person: p, office: 'Teacher', turningAge: 14 });
    if (age === 16) out.push({ person: p, office: 'Priest', turningAge: 16 });
  }
  return out;
}

export interface BaptismCandidate {
  person: Person;
  birthDate: string;
  eighthBirthday: string;
}

export function getBaptismCandidates(people: Person[]): BaptismCandidate[] {
  const year = new Date().getFullYear();
  const out: BaptismCandidate[] = [];
  for (const p of people) {
    if (p.doNotInterview) continue;
    if (!p.birthDate || p.birthDate.length < 10) continue;
    const birthYear = parseInt(p.birthDate.slice(0, 4), 10);
    if (year - birthYear !== 8) continue;
    const eighthBirthday = `${year}-${p.birthDate.slice(5, 7)}-${p.birthDate.slice(8, 10)}`;
    out.push({ person: p, birthDate: p.birthDate, eighthBirthday });
  }
  return out.sort((a, b) => a.eighthBirthday.localeCompare(b.eighthBirthday));
}
