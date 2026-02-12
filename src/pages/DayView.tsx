import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import {
  upcomingSunday,
  todayLocalDate,
  nextSunday,
  formatTimeAmPm,
  getWeekOfMonth,
} from '../lib/scheduling';
import { formatSundayLabel } from '../lib/monthInterviews';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import type { Person } from '../db/schema';
import { getRenderedTemplate } from '../lib/templates';
import { getMessageRecipientPhone } from '../lib/contactRecipient';
import { getLocationSuffix } from '../lib/templates';
import { REACH_OUT_INTERVIEW_TYPES, getMessageTextForType } from '../lib/reachOutTemplate';

const DURATION = 20;
const INTERVIEW_KIND = REACH_OUT_INTERVIEW_TYPES[0]?.type ?? 'temple_recommend';
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const TOTAL_MINUTES = DAY_END - DAY_START;
const DEFAULT_TEMPLATE_ID = 'schedule-monthly-sunday';

type DayEvent =
  | { type: 'appointment'; id: string; personId?: string; personName?: string; start: number; end: number; label: string }
  | { type: 'block'; id: string; start: number; end: number; label: string }
  | { type: 'recurring'; id: string; start: number; end: number; label: string };

export function DayView() {
  const today = todayLocalDate();
  const defaultDate = upcomingSunday(today);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [slotPicker, setSlotPicker] = useState<{ localDate: string; minutesFromMidnight: number } | null>(null);
  const [addToQueue, setAddToQueue] = useState(true);
  const [showAddOther, setShowAddOther] = useState(false);
  const [newBlockLabel, setNewBlockLabel] = useState('');
  const [newBlockStart, setNewBlockStart] = useState(14 * 60);
  const [newBlockEnd, setNewBlockEnd] = useState(14 * 60 + 30);

  const nextSun = nextSunday(today);
  const isThisSunday = selectedDate === defaultDate;
  const isNextSunday = selectedDate === nextSun;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const week = getWeekOfMonth(selectedDate);
      const [appointments, dayBlocks, recurring, peopleList] = await Promise.all([
        db.appointments.where('localDate').equals(selectedDate).toArray(),
        db.dayBlocks.where('localDate').equals(selectedDate).toArray(),
        db.recurringScheduleItems.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
        db.people.toArray(),
      ]);
      if (cancelled) return;
      const nameBy = new Map(peopleList.map((p) => [p.id, p.nameListPreferred]));
      const list: DayEvent[] = [];
      for (const a of appointments) {
        if (a.status === 'canceled') continue;
        const end = a.minutesFromMidnight + (a.durationMinutes ?? DURATION);
        list.push({
          type: 'appointment',
          id: a.id,
          personId: a.personId,
          personName: nameBy.get(a.personId),
          start: a.minutesFromMidnight,
          end,
          label: nameBy.get(a.personId) ?? 'Interview',
        });
      }
      for (const b of dayBlocks) {
        list.push({ type: 'block', id: b.id, start: b.startMinutes, end: b.endMinutes, label: b.label });
      }
      for (const r of recurring) {
        if (r.weekOfMonth !== 0 && r.weekOfMonth !== week) continue;
        list.push({ type: 'recurring', id: r.id, start: r.startMinutes, end: r.endMinutes, label: r.label });
      }
      list.sort((a, b) => a.start - b.start);
      setEvents(list);
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  const handleSelectPerson = async (person: Person) => {
    if (!slotPicker) return;
    const now = Date.now();
    const id = `apt-${slotPicker.localDate}-${slotPicker.minutesFromMidnight}-${now}`;
    await db.appointments.add({
      id,
      type: 'bishop_interview',
      personId: person.id,
      localDate: slotPicker.localDate,
      minutesFromMidnight: slotPicker.minutesFromMidnight,
      durationMinutes: DURATION,
      status: 'hold',
      historyLog: [],
      interviewKind: INTERVIEW_KIND,
      createdAt: now,
      updatedAt: now,
    });
    if (addToQueue) {
      const phone = await getMessageRecipientPhone(person);
      if (phone) {
        const dateLabel = slotPicker.localDate.replace(/-/g, '/');
        const timeLabel = formatTimeAmPm(slotPicker.minutesFromMidnight);
        const locationSuffix = getLocationSuffix();
        const typeName = getMessageTextForType(INTERVIEW_KIND);
        const body = await getRenderedTemplate(INTERVIEW_KIND, {
          name: person.nameListPreferred,
          date: dateLabel,
          time: timeLabel,
          interviewType: typeName,
          locationSuffix,
        });
        await db.messageQueue.add({
          id: `msg-${now}-${Math.random().toString(36).slice(2, 9)}`,
          recipientPhone: phone,
          renderedMessage: body,
          relatedObjectType: 'appointment',
          relatedObjectId: id,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    setSlotPicker(null);
    const newEv: DayEvent = {
      type: 'appointment',
      id,
      personId: person.id,
      personName: person.nameListPreferred,
      start: slotPicker.minutesFromMidnight,
      end: slotPicker.minutesFromMidnight + DURATION,
      label: person.nameListPreferred,
    };
    setEvents((prev) => [...prev, newEv].sort((a, b) => a.start - b.start));
  };

  async function addBlock() {
    if (!newBlockLabel.trim() || newBlockEnd <= newBlockStart) return;
    const now = Date.now();
    const id = `block-${selectedDate}-${now}`;
    await db.dayBlocks.add({
      id,
      localDate: selectedDate,
      startMinutes: newBlockStart,
      endMinutes: newBlockEnd,
      label: newBlockLabel.trim(),
      createdAt: now,
      updatedAt: now,
    });
    const newBlock: DayEvent = { type: 'block', id, start: newBlockStart, end: newBlockEnd, label: newBlockLabel.trim() };
    setEvents((prev) => [...prev, newBlock].sort((a, b) => a.start - b.start));
    setNewBlockLabel('');
    setNewBlockStart(14 * 60);
    setNewBlockEnd(14 * 60 + 30);
    setShowAddOther(false);
  }

  const timeSlots: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += 30) timeSlots.push(m);

  return (
    <PageLayout back="auto" title="Day view" fullWidth>
      <Section heading="Date">
        <div className="card p-4">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedDate(defaultDate)}
              className={`px-4 py-2.5 rounded-xl border min-h-tap font-semibold transition-colors ${isThisSunday ? 'bg-primary text-white border-primary' : 'bg-white border-border hover:bg-slate-50'}`}
            >
              This Sunday
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(nextSun)}
              className={`px-4 py-2.5 rounded-xl border min-h-tap font-semibold transition-colors ${isNextSunday ? 'bg-primary text-white border-primary' : 'bg-white border-border hover:bg-slate-50'}`}
            >
              Next Sunday
            </button>
          </div>
          <p className="text-muted text-sm mt-3 font-medium">{formatSundayLabel(selectedDate)}</p>
        </div>
      </Section>

      <Section heading="">
        <div className="card overflow-hidden">
          <div className="flex">
            <div className="w-16 shrink-0 border-r border-border py-1">
              {timeSlots.map((m) => (
                <div key={m} className="text-[10px] text-muted font-mono leading-6 h-6" style={{ height: 24 }}>
                  {formatTimeAmPm(m)}
                </div>
              ))}
            </div>
            <div className="flex-1 relative bg-slate-50/50" style={{ height: timeSlots.length * 24 }}>
              {events.map((ev) => {
                const topPct = ((ev.start - DAY_START) / TOTAL_MINUTES) * 100;
                const heightPct = ((ev.end - ev.start) / TOTAL_MINUTES) * 100;
                return (
                  <div
                    key={ev.id}
                    className="absolute left-1 right-1 rounded-lg border overflow-hidden text-xs font-medium shadow-sm"
                    style={{
                      top: `${topPct}%`,
                      height: `${Math.max(heightPct, 4)}%`,
                      minHeight: 22,
                      backgroundColor: ev.type === 'appointment' ? '#e0e7ff' : ev.type === 'block' ? '#d1fae5' : '#f3f4f6',
                      borderColor: ev.type === 'appointment' ? '#a5b4fc' : ev.type === 'block' ? '#6ee7b7' : '#e5e7eb',
                    }}
                  >
                    {ev.type === 'appointment' ? (
                      <Link
                        to={`/appointment/${ev.id}`}
                        className="block p-1.5 truncate no-underline text-inherit"
                      >
                        {formatTimeAmPm(ev.start)} – {ev.label}
                      </Link>
                    ) : (
                      <div className="p-1.5 truncate">
                        {formatTimeAmPm(ev.start)} – {ev.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={() => setSlotPicker({ localDate: selectedDate, minutesFromMidnight: 14 * 60 })}
          className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold min-h-tap"
        >
          Add interview
        </button>
        <button
          type="button"
          onClick={() => setShowAddOther(true)}
          className="border border-border px-4 py-2.5 rounded-xl font-semibold min-h-tap hover:bg-slate-50"
        >
          Add other event
        </button>
      </div>

      {slotPicker && (
        <>
          <div className="fixed inset-0 z-10 bg-black/30 backdrop-blur-[2px]" aria-hidden />
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-border rounded-t-2xl p-4 max-h-[70vh] overflow-auto shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <p className="text-sm text-muted mb-2">Add confirmation to message queue?</p>
            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={addToQueue} onChange={(e) => setAddToQueue(e.target.checked)} />
              <span>Add confirmation to queue</span>
            </label>
            <PeoplePickerModal
              onSelect={handleSelectPerson}
              onClose={() => setSlotPicker(null)}
              filter={(p) => !p.doNotInterview && !p.inactive}
            />
          </div>
        </>
      )}

      {showAddOther && (
        <>
          <div className="fixed inset-0 z-10 bg-black/30" aria-hidden />
          <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-border p-4 w-full max-w-sm">
              <h3 className="font-bold text-lg mt-0 mb-3">Add event</h3>
              <input
                type="text"
                value={newBlockLabel}
                onChange={(e) => setNewBlockLabel(e.target.value)}
                placeholder="Event name"
                className="border border-border rounded-xl px-3 py-2 w-full mb-3"
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="text-sm text-muted">Start</label>
                <label className="text-sm text-muted">End</label>
                <select
                  value={newBlockStart}
                  onChange={(e) => setNewBlockStart(Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1.5"
                >
                  {timeSlots.map((m) => (
                    <option key={m} value={m}>{formatTimeAmPm(m)}</option>
                  ))}
                </select>
                <select
                  value={newBlockEnd}
                  onChange={(e) => setNewBlockEnd(Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1.5"
                >
                  {timeSlots.map((m) => (
                    <option key={m} value={m}>{formatTimeAmPm(m)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addBlock} disabled={!newBlockLabel.trim()} className="bg-primary text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-50">
                  Add
                </button>
                <button type="button" onClick={() => setShowAddOther(false)} className="border border-border px-4 py-2 rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}
