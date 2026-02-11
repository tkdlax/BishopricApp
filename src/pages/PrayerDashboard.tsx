import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { getSuggestedPeopleForPrayer, recordPrayerSkipped } from '../lib/prayerSuggestions';
import { upcomingSunday, todayLocalDate, addDays } from '../lib/scheduling';
import { formatSundayLabel } from '../lib/monthInterviews';
import { getMessageRecipientPhone } from '../lib/contactRecipient';
import { getPrayerAskMessage } from '../lib/templates';
import type { SuggestedPerson } from '../lib/prayerSuggestions';
import type { PrayerType, PrayerAssignment } from '../db/schema';
import { MessageCircle, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

export function PrayerDashboard() {
  const today = todayLocalDate();
  const defaultSunday = upcomingSunday(today);
  const [selectedSunday, setSelectedSunday] = useState(defaultSunday);
  const [opening, setOpening] = useState<SuggestedPerson[]>([]);
  const [closing, setClosing] = useState<SuggestedPerson[]>([]);
  const [assignments, setAssignments] = useState<PrayerAssignment[]>([]);
  const [peopleById, setPeopleById] = useState<Map<string, { nameListPreferred: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  const prevSunday = addDays(selectedSunday, -7);
  const nextSun = addDays(selectedSunday, 7);
  const isFirstSunday = selectedSunday <= defaultSunday;
  const selectedLabel = formatSundayLabel(selectedSunday);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [open, close, assigns, people] = await Promise.all([
        getSuggestedPeopleForPrayer('opening', { forSunday: selectedSunday, limit: 10 }),
        getSuggestedPeopleForPrayer('closing', { forSunday: selectedSunday, limit: 10 }),
        db.prayerAssignments.where('localDate').equals(selectedSunday).toArray(),
        db.people.toArray(),
      ]);
      setOpening(open);
      setClosing(close);
      setAssignments(assigns);
      setPeopleById(new Map(people.map((p) => [p.id, { nameListPreferred: p.nameListPreferred }])));
      setLoading(false);
    })();
  }, [selectedSunday]);

  const openingAssignment = assignments.find((a) => a.prayerType === 'opening');
  const closingAssignment = assignments.find((a) => a.prayerType === 'closing');
  const assignedIds = new Set(assignments.map((a) => a.personId));

  const handleAsk = async (personId: string, prayerType: PrayerType) => {
    const person = [...opening, ...closing].find((s) => s.person.id === personId)?.person;
    if (!person) return;
    const phone = await getMessageRecipientPhone(person);
    if (!phone) return;
    const now = Date.now();
    const message = await getPrayerAskMessage(person.nameListPreferred, prayerType, selectedLabel);
    await db.messageQueue.add({
      id: `prayer-${now}-${Math.random().toString(36).slice(2, 9)}`,
      recipientPhone: phone,
      renderedMessage: message,
      relatedObjectType: 'prayer',
      relatedObjectId: personId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    await db.prayerAssignments.add({
      id: `pa-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId,
      localDate: selectedSunday,
      prayerType,
      status: 'asked',
      askedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    setAssignments(await db.prayerAssignments.where('localDate').equals(selectedSunday).toArray());
    setOpening((prev) => prev.filter((s) => s.person.id !== personId));
    setClosing((prev) => prev.filter((s) => s.person.id !== personId));
  };

  const handleRemoveAssignment = async (assignment: PrayerAssignment) => {
    await db.prayerAssignments.delete(assignment.id);
    setAssignments(await db.prayerAssignments.where('localDate').equals(selectedSunday).toArray());
  };

  const handleConfirmAssignment = async (assignment: PrayerAssignment) => {
    const now = Date.now();
    await db.prayerAssignments.update(assignment.id, { status: 'accepted', acceptedAt: now, updatedAt: now });
    setAssignments(await db.prayerAssignments.where('localDate').equals(selectedSunday).toArray());
  };

  const handleNotThisSunday = async (personId: string, prayerType: PrayerType) => {
    await recordPrayerSkipped(personId, prayerType, selectedSunday);
    setOpening((prev) => prev.filter((s) => s.person.id !== personId));
    setClosing((prev) => prev.filter((s) => s.person.id !== personId));
  };

  const renderList = (list: SuggestedPerson[], type: PrayerType) => (
    <ul className="list-none p-0 m-0 space-y-2">
      {list.map((s) => (
        <li key={`${s.person.id}-${type}`} className="card flex items-center gap-3 py-2 px-3 rounded-xl border border-border">
          <Link to={`/contacts/person/${s.person.id}`} className="flex-1 font-medium min-h-tap no-underline text-inherit">
            {s.person.nameListPreferred}
          </Link>
          <span className="text-muted text-xs">{s.lastPrayerDate ?? 'Never'}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleAsk(s.person.id, type)}
              className="text-primary font-medium text-sm min-h-tap flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/10"
            >
              <MessageCircle size={16} /> Ask
            </button>
            <button
              type="button"
              onClick={() => handleNotThisSunday(s.person.id, type)}
              className="text-muted text-sm min-h-tap px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              Skip
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  const isDefaultSunday = selectedSunday === defaultSunday;

  if (loading && opening.length === 0 && closing.length === 0 && assignments.length === 0) {
    return (
      <PageLayout back="auto" title="Prayer">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout back="auto" title="Prayer">
      <div className="card p-4 mb-5">
        <p className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Working toward</p>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSelectedSunday(prevSunday)}
            disabled={isFirstSunday}
            className="p-2 rounded-xl border border-border min-h-tap disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50"
            aria-label="Previous Sunday"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <p className="font-bold text-lg text-slate-900">{selectedLabel}</p>
            {isDefaultSunday && <p className="text-muted text-xs">This Sunday</p>}
          </div>
          <button
            type="button"
            onClick={() => setSelectedSunday(nextSun)}
            className="p-2 rounded-xl border border-border min-h-tap hover:bg-slate-50"
            aria-label="Next Sunday"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <p className="text-muted text-sm mb-4">Ask adds a message to the queue. Skip = not this Sunday (use contact record for &quot;never ask&quot;).</p>

      <Section heading="Slots">
        <div className="card divide-y divide-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-muted text-sm font-medium w-24 shrink-0">Opening</span>
            <span className="flex-1 font-medium">{openingAssignment ? peopleById.get(openingAssignment.personId)?.nameListPreferred ?? '—' : '—'}</span>
            {openingAssignment && (
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => handleRemoveAssignment(openingAssignment)} className="p-2 rounded-lg text-muted hover:bg-slate-100 min-h-tap" title="Remove"><X size={18} /></button>
                {openingAssignment.status !== 'accepted' && (
                  <button type="button" onClick={() => handleConfirmAssignment(openingAssignment)} className="p-2 rounded-lg text-accent hover:bg-accent/10 min-h-tap" title="Mark confirmed"><Check size={18} /></button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-muted text-sm font-medium w-24 shrink-0">Closing</span>
            <span className="flex-1 font-medium">{closingAssignment ? peopleById.get(closingAssignment.personId)?.nameListPreferred ?? '—' : '—'}</span>
            {closingAssignment && (
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => handleRemoveAssignment(closingAssignment)} className="p-2 rounded-lg text-muted hover:bg-slate-100 min-h-tap" title="Remove"><X size={18} /></button>
                {closingAssignment.status !== 'accepted' && (
                  <button type="button" onClick={() => handleConfirmAssignment(closingAssignment)} className="p-2 rounded-lg text-accent hover:bg-accent/10 min-h-tap" title="Mark confirmed"><Check size={18} /></button>
                )}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section heading="Opening prayer suggestions">
        {opening.filter((s) => !assignedIds.has(s.person.id)).length === 0 ? <p className="text-muted text-sm">No suggestions.</p> : renderList(opening.filter((s) => !assignedIds.has(s.person.id)), 'opening')}
      </Section>
      <Section heading="Closing prayer suggestions">
        {closing.filter((s) => !assignedIds.has(s.person.id)).length === 0 ? <p className="text-muted text-sm">No suggestions.</p> : renderList(closing.filter((s) => !assignedIds.has(s.person.id)), 'closing')}
      </Section>
      <Link to="/messages" className="text-primary font-semibold min-h-tap inline-block mt-2">Open Message Center</Link>
    </PageLayout>
  );
}
