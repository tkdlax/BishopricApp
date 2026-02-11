import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import {
  getYouthDueThisYear,
  getAdvancementCandidates,
  getBaptismCandidates,
  type YouthDueItem,
  type AdvancementCandidate,
  type BaptismCandidate,
} from '../lib/youthInterviews';
import { REACH_OUT_INTERVIEW_TYPES } from '../lib/reachOutTemplate';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { User, Plus, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { Person } from '../db/schema';

const PERIOD_KEY = `${new Date().getFullYear()}-H1`;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function InterviewsToGet() {
  const [youthDue, setYouthDue] = useState<YouthDueItem[]>([]);
  const [advancement, setAdvancement] = useState<AdvancementCandidate[]>([]);
  const [baptism, setBaptism] = useState<BaptismCandidate[]>([]);
  const [custom, setCustom] = useState<{ id: string; label: string; personId?: string; completedAt?: number }[]>([]);
  const [dismissals, setDismissals] = useState<Set<string>>(new Set());
  const [youthCollapsed, setYouthCollapsed] = useState(true);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [customPerson, setCustomPerson] = useState<Person | null>(null);
  const [customType, setCustomType] = useState(REACH_OUT_INTERVIEW_TYPES[0]?.type ?? 'standard_interview');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [people, customList, dismissList] = await Promise.all([
      db.people.toArray(),
      db.customInterviewToGet.toArray().then((list) => list.filter((c) => !c.completedAt)),
      db.interviewToGetDismissals.where('periodKey').equals(PERIOD_KEY).toArray(),
    ]);
    const youthItems = people.flatMap((p) => getYouthDueThisYear(p));
    setYouthDue(youthItems);
    setAdvancement(getAdvancementCandidates(people));
    setBaptism(getBaptismCandidates(people));
    setCustom(customList.map((c) => ({ id: c.id, label: c.label, personId: c.personId, completedAt: c.completedAt })));
    setDismissals(new Set(dismissList.map((d) => `${d.personId}-${d.reasonKey}`)));
  }

  const filteredYouth = youthDue.filter((item) => !dismissals.has(`${item.person.id}-${item.reason}`));
  const reasonLabel = (item: YouthDueItem) =>
    item.reason === 'birthday_month' ? 'Birthday month' : 'Semi-annual';

  const youthByMonthThenLeader = (() => {
    const byMonth: Record<number, { bishop: YouthDueItem[]; counselor: YouthDueItem[] }> = {};
    for (const item of filteredYouth) {
      if (!byMonth[item.month]) byMonth[item.month] = { bishop: [], counselor: [] };
      if (item.leader === 'bishop') byMonth[item.month].bishop.push(item);
      else byMonth[item.month].counselor.push(item);
    }
    return byMonth;
  })();
  const monthsWithYouth = Object.keys(youthByMonthThenLeader).map(Number).sort((a, b) => a - b);

  async function addCustom() {
    if (!customPerson) return;
    const typeName = REACH_OUT_INTERVIEW_TYPES.find((t) => t.type === customType)?.name ?? 'Interview';
    const label = `${customPerson.nameListPreferred} – ${typeName}`;
    const now = Date.now();
    await db.customInterviewToGet.add({
      id: `custom-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: customPerson.id,
      label,
      createdAt: now,
    });
    setCustomPerson(null);
    setShowAddCustom(false);
    load();
  }

  async function completeCustom(id: string) {
    await db.customInterviewToGet.update(id, { completedAt: Date.now() });
    load();
  }

  return (
    <PageLayout back="auto" title="Interviews to get">
      <Section heading="My checklist">
        <div className="card p-4 mb-3">
          {custom.length === 0 && !showAddCustom && (
            <p className="text-muted text-sm mb-3">Add any person and interview type to track.</p>
          )}
          <ul className="list-none p-0 m-0 space-y-2">
            {custom.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 px-3 rounded-xl border border-border bg-white">
                <span className="flex-1 font-medium min-w-0">{c.label}</span>
                {c.personId && (
                  <Link to={`/contacts/person/${c.personId}`} className="text-primary text-sm shrink-0">View</Link>
                )}
                <button
                  type="button"
                  onClick={() => completeCustom(c.id)}
                  className="p-2 rounded-lg text-primary hover:bg-primary/10 min-h-tap"
                  title="Mark done"
                >
                  <Check size={18} />
                </button>
              </li>
            ))}
          </ul>
          {showAddCustom ? (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-border">
              <p className="text-sm font-medium text-muted mb-2">Add to checklist</p>
              <div className="flex flex-wrap gap-2 items-center mb-2">
                {customPerson ? (
                  <span className="font-medium">{customPerson.nameListPreferred}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowPersonPicker(true)}
                  className="text-primary font-medium text-sm min-h-tap"
                >
                  {customPerson ? 'Change person' : 'Pick person'}
                </button>
              </div>
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 w-full max-w-xs mb-2"
              >
                {REACH_OUT_INTERVIEW_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>{t.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={!customPerson}
                  className="bg-primary text-white px-3 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  Add
                </button>
                <button type="button" onClick={() => { setShowAddCustom(false); setCustomPerson(null); }} className="border border-border px-3 py-2 rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddCustom(true)}
              className="inline-flex items-center gap-2 mt-3 text-primary font-semibold min-h-tap"
            >
              <Plus size={18} /> Add to checklist
            </button>
          )}
        </div>
        {showPersonPicker && (
          <PeoplePickerModal
            onSelect={(p) => { setCustomPerson(p); setShowPersonPicker(false); }}
            onClose={() => setShowPersonPicker(false)}
            filter={(p) => !p.doNotInterview && !p.inactive}
          />
        )}
      </Section>

      <Section heading="Youth due this year">
        <button
          type="button"
          onClick={() => setYouthCollapsed(!youthCollapsed)}
          className="w-full flex items-center justify-between gap-2 py-2 px-0 bg-transparent border-0 text-left font-semibold text-muted min-h-tap"
        >
          <span>{filteredYouth.length} youth</span>
          {youthCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
        </button>
        {!youthCollapsed && (
          <div className="space-y-4">
            {monthsWithYouth.map((month) => (
              <div key={month} className="card overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 text-muted text-xs font-bold uppercase">
                  {MONTH_NAMES[month - 1]}
                </div>
                {(['bishop', 'counselor'] as const).map((leader) => {
                  const list = youthByMonthThenLeader[month]?.[leader] ?? [];
                  if (list.length === 0) return null;
                  return (
                    <div key={leader} className="border-t border-border">
                      <div className="px-4 py-1.5 bg-slate-50 text-muted text-xs font-medium capitalize">
                        {leader}
                      </div>
                      <ul className="list-none p-0 m-0">
                        {list.map((item, i) => (
                          <li key={`${item.person.id}-${item.reason}-${i}`}>
                            <div className="card-row flex items-center gap-2">
                              <User size={18} className="text-muted shrink-0" />
                              <Link to={`/contacts/person/${item.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
                                {item.person.nameListPreferred}
                              </Link>
                              <span className="text-muted text-sm">{reasonLabel(item)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
            {filteredYouth.length === 0 && <p className="text-muted text-sm">None or all dismissed.</p>}
          </div>
        )}
      </Section>

      <Section heading="Advancement (priesthood)">
        <ul className="list-none p-0 m-0 space-y-2">
          {advancement.map((c) => (
            <li key={`${c.person.id}-${c.office}`} className="card-row flex items-center gap-2 py-2 px-3">
              <Link to={`/contacts/person/${c.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
                {c.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm">{c.office} (turning {c.turningAge})</span>
            </li>
          ))}
        </ul>
        {advancement.length === 0 && <p className="text-muted text-sm">None.</p>}
      </Section>

      <Section heading="Baptism (8th birthday)">
        <ul className="list-none p-0 m-0 space-y-2">
          {baptism.map((c) => (
            <li key={c.person.id} className="card-row flex items-center gap-2 py-2 px-3">
              <Link to={`/contacts/person/${c.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
                {c.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm">{c.eighthBirthday}</span>
            </li>
          ))}
        </ul>
        {baptism.length === 0 && <p className="text-muted text-sm">None.</p>}
      </Section>
    </PageLayout>
  );
}
