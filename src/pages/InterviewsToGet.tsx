import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { REACH_OUT_INTERVIEW_TYPES, buildReachOutMessage } from '../lib/reachOutTemplate';
import { getYouthReachOutBody } from '../lib/templates';
import { getBishopLastNameForMessage } from '../lib/bishopForMessages';
import { getHouseholdMembersWithPhones } from '../lib/contactRecipient';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { User, Plus, ChevronDown, ChevronRight, Check, Calendar, X } from 'lucide-react';
import type { Person } from '../db/schema';

const PERIOD_KEY = `${new Date().getFullYear()}-H1`;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type ReachOutTarget =
  | { kind: 'advancement'; candidate: AdvancementCandidate }
  | { kind: 'baptism'; candidate: BaptismCandidate }
  | { kind: 'youth'; item: YouthDueItem };

export function InterviewsToGet() {
  const navigate = useNavigate();
  const [youthDue, setYouthDue] = useState<YouthDueItem[]>([]);
  const [advancement, setAdvancement] = useState<AdvancementCandidate[]>([]);
  const [baptism, setBaptism] = useState<BaptismCandidate[]>([]);
  const [custom, setCustom] = useState<{ id: string; label: string; personId?: string; completedAt?: number }[]>([]);
  const [dismissals, setDismissals] = useState<Set<string>>(new Set());
  const [youthCollapsed, setYouthCollapsed] = useState(true);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [customPerson, setCustomPerson] = useState<Person | null>(null);
  const [customType, setCustomType] = useState(REACH_OUT_INTERVIEW_TYPES[0]?.type ?? 'temple_recommend');
  const [reachOutTarget, setReachOutTarget] = useState<ReachOutTarget | null>(null);
  const [scheduleMenu, setScheduleMenu] = useState<string | null>(null);
  const [bulkAddQueue, setBulkAddQueue] = useState<YouthDueItem[]>([]);
  const [youthCompletions, setYouthCompletions] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const year = new Date().getFullYear();
    const [people, customList, dismissList, advDone, bapDone, youthDone, advDismissed, bapDismissed] = await Promise.all([
      db.people.toArray(),
      db.customInterviewToGet.toArray().then((list) => list.filter((c) => !c.completedAt)),
      db.interviewToGetDismissals.where('periodKey').equals(PERIOD_KEY).toArray(),
      db.advancementCompletions.toArray(),
      db.baptismCompletions.toArray(),
      db.youthInterviewCompletions.where('year').equals(year).toArray(),
      db.advancementDismissals.toArray(),
      db.baptismDismissals.toArray(),
    ]);
    const youthItems = people.flatMap((p) => getYouthDueThisYear(p));
    setYouthDue(youthItems);
    const advCompleted = new Set(advDone.map((a) => `${a.personId}-${a.office}`));
    const bapCompleted = new Set(bapDone.map((b) => b.personId));
    const youthCompleted = new Set(youthDone.map((y) => `${y.personId}-${y.reasonKey}`));
    const advDismissSet = new Set(advDismissed.map((a) => `${a.personId}-${a.office}`));
    const bapDismissSet = new Set(bapDismissed.map((b) => b.personId));
    setAdvancement(getAdvancementCandidates(people).filter((c) => !advCompleted.has(`${c.person.id}-${c.office}`) && !advDismissSet.has(`${c.person.id}-${c.office}`)));
    setBaptism(getBaptismCandidates(people).filter((c) => !bapCompleted.has(c.person.id) && !bapDismissSet.has(c.person.id)));
    setCustom(customList.map((c) => ({ id: c.id, label: c.label, personId: c.personId, completedAt: c.completedAt })));
    setDismissals(new Set(dismissList.map((d) => `${d.personId}-${d.reasonKey}`)));
    setYouthCompletions(youthCompleted);
  }

  const filteredYouth = youthDue.filter((item) => !dismissals.has(`${item.person.id}-${item.reason}`) && !youthCompletions.has(`${item.person.id}-${item.reason}`));
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

  async function completeAdvancement(c: AdvancementCandidate) {
    const now = Date.now();
    await db.advancementCompletions.add({
      id: `adv-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: c.person.id,
      office: c.office,
      completedAt: now,
      createdAt: now,
    });
    setScheduleMenu(null);
    load();
  }

  async function completeBaptism(c: BaptismCandidate) {
    const now = Date.now();
    await db.baptismCompletions.add({
      id: `bap-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: c.person.id,
      completedAt: now,
      createdAt: now,
    });
    setScheduleMenu(null);
    load();
  }

  async function completeYouth(item: YouthDueItem) {
    const now = Date.now();
    await db.youthInterviewCompletions.add({
      id: `youth-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: item.person.id,
      reasonKey: item.reason,
      year: item.year,
      completedAt: now,
      createdAt: now,
    });
    setScheduleMenu(null);
    load();
  }

  async function clearYouth(item: YouthDueItem) {
    const now = Date.now();
    await db.interviewToGetDismissals.add({
      id: `d-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: item.person.id,
      reasonKey: item.reason,
      periodKey: PERIOD_KEY,
      createdAt: now,
    });
    setScheduleMenu(null);
    load();
  }

  async function clearAdvancement(c: AdvancementCandidate) {
    const now = Date.now();
    await db.advancementDismissals.add({
      id: `advd-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: c.person.id,
      office: c.office,
      createdAt: now,
    });
    setScheduleMenu(null);
    load();
  }

  async function clearBaptism(c: BaptismCandidate) {
    const now = Date.now();
    await db.baptismDismissals.add({
      id: `bapd-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId: c.person.id,
      createdAt: now,
    });
    setScheduleMenu(null);
    load();
  }

  function openReachOut(target: ReachOutTarget) {
    setScheduleMenu(null);
    setReachOutTarget(target);
  }

  function scheduleCalendar(target: ReachOutTarget) {
    setScheduleMenu(null);
    const personId = target.kind === 'advancement' ? target.candidate.person.id : target.kind === 'baptism' ? target.candidate.person.id : target.item.person.id;
    navigate('/schedule', { state: { personId } });
  }

  async function pickRecipientForReachOut(recipient: Person) {
    if (!reachOutTarget) return;
    await addReachOutToQueue(reachOutTarget, recipient);
    setReachOutTarget(null);
  }

  async function addReachOutToQueue(target: ReachOutTarget, recipient: Person) {
    const bishopLastName = await getBishopLastNameForMessage();
    const recipientName = recipient.nameListPreferred;
    const phone = recipient.phones?.[0];
    if (!phone) return;
    let interviewTypeDisplay: string;
    if (target.kind === 'advancement') {
      interviewTypeDisplay = `${target.candidate.office} ordination interview`;
    } else if (target.kind === 'baptism') {
      interviewTypeDisplay = 'baptism interview';
    } else {
      const item = target.item;
      interviewTypeDisplay = item.reason === 'birthday_month'
        ? 'youth annual with the bishop'
        : 'youth semi-annual with a counselor';
      if (item.leader === 'bishop') interviewTypeDisplay = item.reason === 'birthday_month' ? 'youth annual with the bishop' : 'youth semi-annual with the bishop';
      else interviewTypeDisplay = 'youth semi-annual with a counselor';
    }
    let message: string;
    if (target.kind === 'youth') {
      const body = await getYouthReachOutBody();
      message = body
        .replace(/\{recipient\}/g, recipientName)
        .replace(/\{bishopPhrase\}/g, bishopLastName ? `bishop ${bishopLastName}` : 'the bishop')
        .replace(/\{interviewType\}/g, interviewTypeDisplay);
    } else {
      message = buildReachOutMessage(recipientName, bishopLastName, interviewTypeDisplay);
    }
    const now = Date.now();
    await db.messageQueue.add({
      id: `msg-${now}-${Math.random().toString(36).slice(2, 9)}`,
      recipientPhone: phone,
      renderedMessage: message,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  function startBulkAddToQueue(items: YouthDueItem[]) {
    setBulkAddQueue(items);
  }

  async function pickRecipientForBulk(recipient: Person) {
    if (bulkAddQueue.length === 0) return;
    const first = bulkAddQueue[0];
    await addReachOutToQueue({ kind: 'youth', item: first }, recipient);
    setBulkAddQueue((prev) => prev.slice(1));
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
                      <div className="px-4 py-1.5 bg-slate-50 text-muted text-xs font-medium capitalize flex items-center justify-between gap-2">
                        <span>{leader}</span>
                        <button type="button" onClick={() => startBulkAddToQueue(list)} className="text-primary text-xs font-semibold min-h-tap py-1 px-2 rounded hover:bg-primary/10">Add all to queue</button>
                      </div>
                      <ul className="list-none p-0 m-0">
                        {list.map((item, i) => (
                          <li key={`${item.person.id}-${item.reason}-${i}`}>
                            <div className="card-row flex items-center gap-2">
                              <User size={18} className="text-muted shrink-0" />
                              <Link to={`/contacts/person/${item.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
                                {item.person.nameListPreferred}
                              </Link>
                              <span className="text-muted text-sm shrink-0">{reasonLabel(item)}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="relative">
                                  <button type="button" onClick={() => setScheduleMenu(scheduleMenu === `y-${item.person.id}-${item.reason}` ? null : `y-${item.person.id}-${item.reason}`)} className="p-2 rounded-lg text-primary hover:bg-primary/10 min-h-tap" title="Schedule or reach out"><Calendar size={18} /></button>
                                  {scheduleMenu === `y-${item.person.id}-${item.reason}` && (
                                    <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-border rounded-lg shadow-lg z-10 min-w-[140px]">
                                      <button type="button" onClick={() => openReachOut({ kind: 'youth', item })} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Reach out</button>
                                      <button type="button" onClick={() => scheduleCalendar({ kind: 'youth', item })} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Schedule</button>
                                    </div>
                                  )}
                                </div>
                                <button type="button" onClick={() => completeYouth(item)} className="p-2 rounded-lg text-accent hover:bg-accent/10 min-h-tap" title="Mark complete"><Check size={18} /></button>
                                <button type="button" onClick={() => clearYouth(item)} className="p-2 rounded-lg text-muted hover:bg-slate-100 min-h-tap" title="Clear (won&apos;t happen)"><X size={18} /></button>
                              </div>
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
            <li key={`${c.person.id}-${c.office}`} className="card flex items-center gap-2 py-2 px-3 rounded-xl border border-border">
              <Link to={`/contacts/person/${c.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
                {c.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm shrink-0">{c.office} (turning {c.turningAge})</span>
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setScheduleMenu(scheduleMenu === `adv-${c.person.id}-${c.office}` ? null : `adv-${c.person.id}-${c.office}`)}
                    className="p-2 rounded-lg text-primary hover:bg-primary/10 min-h-tap"
                    title="Schedule or reach out"
                    aria-label="Schedule or reach out"
                  >
                    <Calendar size={18} />
                  </button>
                  {scheduleMenu === `adv-${c.person.id}-${c.office}` && (
                    <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-border rounded-lg shadow-lg z-10 min-w-[140px]">
                      <button type="button" onClick={() => openReachOut({ kind: 'advancement', candidate: c })} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Reach out</button>
                      <button type="button" onClick={() => scheduleCalendar({ kind: 'advancement', candidate: c })} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Schedule</button>
                      <button type="button" onClick={() => clearAdvancement(c)} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-muted">Clear (won&apos;t happen)</button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => completeAdvancement(c)} className="p-2 rounded-lg text-accent hover:bg-accent/10 min-h-tap" title="Mark complete"><Check size={18} /></button>
                <button type="button" onClick={() => clearAdvancement(c)} className="p-2 rounded-lg text-muted hover:bg-slate-100 min-h-tap" title="Clear"><X size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
        {advancement.length === 0 && <p className="text-muted text-sm">None.</p>}
      </Section>

      <Section heading="Baptism (8th birthday)">
        <ul className="list-none p-0 m-0 space-y-2">
          {baptism.map((c) => (
            <li key={c.person.id} className="card flex items-center gap-2 py-2 px-3 rounded-xl border border-border">
              <Link to={`/contacts/person/${c.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
                {c.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm shrink-0">{c.eighthBirthday}</span>
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative">
                  <button type="button" onClick={() => setScheduleMenu(scheduleMenu === `bap-${c.person.id}` ? null : `bap-${c.person.id}`)} className="p-2 rounded-lg text-primary hover:bg-primary/10 min-h-tap" title="Schedule or reach out"><Calendar size={18} /></button>
                  {scheduleMenu === `bap-${c.person.id}` && (
                    <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-border rounded-lg shadow-lg z-10 min-w-[140px]">
                      <button type="button" onClick={() => openReachOut({ kind: 'baptism', candidate: c })} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Reach out</button>
                      <button type="button" onClick={() => scheduleCalendar({ kind: 'baptism', candidate: c })} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Schedule</button>
                      <button type="button" onClick={() => clearBaptism(c)} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-muted">Clear (won&apos;t happen)</button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => completeBaptism(c)} className="p-2 rounded-lg text-accent hover:bg-accent/10 min-h-tap" title="Mark complete"><Check size={18} /></button>
                <button type="button" onClick={() => clearBaptism(c)} className="p-2 rounded-lg text-muted hover:bg-slate-100 min-h-tap" title="Clear"><X size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
        {baptism.length === 0 && <p className="text-muted text-sm">None.</p>}
      </Section>

      {reachOutTarget && (
        <RecipientPickerModal
          person={reachOutTarget.kind === 'advancement' ? reachOutTarget.candidate.person : reachOutTarget.kind === 'baptism' ? reachOutTarget.candidate.person : reachOutTarget.item.person}
          onSelect={(p) => pickRecipientForReachOut(p)}
          onClose={() => setReachOutTarget(null)}
        />
      )}
      {bulkAddQueue.length > 0 && (
        <RecipientPickerModal
          person={bulkAddQueue[0].person}
          onSelect={(p) => pickRecipientForBulk(p)}
          onClose={() => setBulkAddQueue([])}
          title={`Who should get the text? (${bulkAddQueue.length} left)`}
        />
      )}
    </PageLayout>
  );
}

function RecipientPickerModal({
  person,
  onSelect,
  onClose,
  title,
}: { person: Person; onSelect: (p: Person) => void; onClose: () => void; title?: string }) {
  const [members, setMembers] = useState<Person[]>([]);
  useEffect(() => {
    getHouseholdMembersWithPhones(person).then(setMembers);
  }, [person]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[70vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-lg m-0">{title ?? 'Who should get the text?'}</h3>
          <p className="text-muted text-sm mt-1">Household members with a phone number. Selecting adds one message to the queue.</p>
        </div>
        <ul className="list-none p-0 m-0 overflow-y-auto flex-1">
          {members.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onSelect(p)} className="card-row w-full text-left">
                <span className="font-medium">{p.nameListPreferred}</span>
                {p.phones?.[0] && <span className="text-muted text-sm">{p.phones[0]}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="p-4 border-t border-border">
          <button type="button" onClick={onClose} className="w-full border border-border py-2.5 rounded-xl font-medium">Cancel</button>
        </div>
      </div>
    </div>
  );
}
