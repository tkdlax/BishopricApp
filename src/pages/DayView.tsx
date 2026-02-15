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
import { formatLongDate } from '../lib/monthInterviews';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import type { Person } from '../db/schema';
import { getRenderedTemplate } from '../lib/templates';
import { getMessageRecipientPhone, isUnder18 } from '../lib/contactRecipient';
import { RecipientPickerModal } from '../components/RecipientPickerModal';
import { getLocationSuffix } from '../lib/templates';
import { REACH_OUT_INTERVIEW_TYPES, getMessageTextForType } from '../lib/reachOutTemplate';
import { getBishopPerson } from '../lib/bishopForMessages';
import { getDayScheduleText } from '../lib/dayScheduleExport';
import { openSms, openWhatsApp } from '../lib/sms';

const DURATION = 20;
const INTERVIEW_KIND = REACH_OUT_INTERVIEW_TYPES[0]?.type ?? 'temple_recommend';
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const TOTAL_MINUTES = DAY_END - DAY_START;
const SLOT_HEIGHT = 36; /* px per 30-min row; same value used in Dashboard calendar */
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingRecipient, setPendingRecipient] = useState<{
    person: Person;
    id: string;
    localDate: string;
    minutesFromMidnight: number;
  } | null>(null);
  const [sendToBishopDate, setSendToBishopDate] = useState(defaultDate);
  const [sendToBishopError, setSendToBishopError] = useState<string | null>(null);

  const nextSun = nextSunday(today);
  const isThisSunday = selectedDate === defaultDate;
  const isNextSunday = selectedDate === nextSun;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const week = getWeekOfMonth(selectedDate);
      const [appointments, dayBlocks, recurring, peopleList, exceptions] = await Promise.all([
        db.appointments.where('localDate').equals(selectedDate).toArray(),
        db.dayBlocks.where('localDate').equals(selectedDate).toArray(),
        db.recurringScheduleItems.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
        db.people.toArray(),
        db.scheduleItemExceptions.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
      ]);
      if (cancelled) return;
      const exceptionItemIds = new Set(exceptions.filter((e) => e.localDate === selectedDate).map((e) => e.itemId));
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
        if (exceptionItemIds.has(r.id)) continue;
        if (r.weekOfMonth !== 0 && r.weekOfMonth !== week) continue;
        list.push({ type: 'recurring', id: r.id, start: r.startMinutes, end: r.endMinutes, label: r.label });
      }
      list.sort((a, b) => a.start - b.start);
      setEvents(list);
    })();
    return () => { cancelled = true; };
  }, [selectedDate, refreshKey]);

  function getOverlapping(ev: DayEvent, evIndex: number): { index: number; total: number } {
    const overlapping = events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.start < ev.end && e.end > ev.start)
      .sort((a, b) => a.e.start - b.e.start);
    const idx = overlapping.findIndex(({ i }) => i === evIndex);
    return { index: idx < 0 ? 0 : idx, total: Math.max(1, overlapping.length) };
  }

  async function dismissRecurring(itemId: string) {
    const now = Date.now();
    await db.scheduleItemExceptions.add({
      id: crypto.randomUUID(),
      templateId: DEFAULT_TEMPLATE_ID,
      itemId,
      localDate: selectedDate,
      createdAt: now,
      updatedAt: now,
    });
    setRefreshKey((k) => k + 1);
  }

  async function removeBlock(blockId: string) {
    await db.dayBlocks.delete(blockId);
    setEvents((prev) => prev.filter((e) => !(e.type === 'block' && e.id === blockId)));
  }

  const handleSelectPerson = async (person: Person) => {
    if (!slotPicker) return;
    const slotStart = slotPicker.minutesFromMidnight;
    const slotEnd = slotPicker.minutesFromMidnight + DURATION;
    const conflict = events.find((e) => e.start < slotEnd && e.end > slotStart);
    if (conflict && !window.confirm(`You already have "${conflict.label}" at this time. Schedule anyway?`)) return;
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
    const finishAndAddEvent = () => {
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
    if (addToQueue && isUnder18(person)) {
      setPendingRecipient({ person, id, localDate: slotPicker.localDate, minutesFromMidnight: slotPicker.minutesFromMidnight });
      setSlotPicker(null);
      return;
    }
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
    finishAndAddEvent();
  };

  const handleRecipientChosen = async (phone: string | null) => {
    const p = pendingRecipient;
    if (!p) return;
    setPendingRecipient(null);
    const { person, id, localDate, minutesFromMidnight } = p;
    if (phone) {
      const now = Date.now();
      const dateLabel = localDate.replace(/-/g, '/');
      const timeLabel = formatTimeAmPm(minutesFromMidnight);
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
    const newEv: DayEvent = {
      type: 'appointment',
      id,
      personId: person.id,
      personName: person.nameListPreferred,
      start: minutesFromMidnight,
      end: minutesFromMidnight + DURATION,
      label: person.nameListPreferred,
    };
    setEvents((prev) => [...prev, newEv].sort((a, b) => a.start - b.start));
  };

  async function addBlock() {
    if (!newBlockLabel.trim() || newBlockEnd <= newBlockStart) return;
    const conflict = events.find((e) => e.start < newBlockEnd && e.end > newBlockStart);
    if (conflict && !window.confirm(`You already have "${conflict.label}" at this time. Add anyway?`)) return;
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
      <Section heading="">
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
            <p className="text-lg font-semibold text-slate-800 m-0">{formatLongDate(selectedDate)}</p>
            <div className="flex gap-2 flex-wrap mt-2">
              <button
                type="button"
                onClick={() => setSelectedDate(defaultDate)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-tap transition-colors ${isThisSunday ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                This Sunday
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(nextSun)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-tap transition-colors ${isNextSunday ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Next Sunday
              </button>
            </div>
          </div>
          <div className="flex min-h-[400px]">
            <div className="w-[4.5rem] shrink-0 border-r border-slate-100 bg-slate-50/50 py-2 pr-1">
              {timeSlots.map((m) => (
                <div key={m} className="text-[11px] text-slate-500 font-medium tabular-nums flex items-center" style={{ height: SLOT_HEIGHT }}>
                  {formatTimeAmPm(m)}
                </div>
              ))}
            </div>
            <div className="flex-1 relative bg-slate-50/30" style={{ height: timeSlots.length * SLOT_HEIGHT, minHeight: 400 }}>
              {/* Hour grid lines */}
              {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-slate-200/70"
                  style={{ top: `${(i * 60 / TOTAL_MINUTES) * 100}%` }}
                />
              ))}
              {/* Current time line (today only) */}
              {selectedDate === today && (() => {
                const d = new Date();
                const nowMinutes = d.getHours() * 60 + d.getMinutes();
                if (nowMinutes < DAY_START || nowMinutes > DAY_END) return null;
                return (
                  <div
                    className="absolute left-0 right-0 z-10 h-0.5 bg-emerald-500 shadow-sm"
                    style={{ top: `${((nowMinutes - DAY_START) / TOTAL_MINUTES) * 100}%` }}
                    aria-hidden
                  />
                );
              })()}
              {events.map((ev, evIndex) => {
                const topPct = ((ev.start - DAY_START) / TOTAL_MINUTES) * 100;
                const heightPct = ((ev.end - ev.start) / TOTAL_MINUTES) * 100;
                const { index, total } = getOverlapping(ev, evIndex);
                const gap = 2;
                const widthPct = (100 - (total - 1) * gap) / total;
                const leftPct = index * (widthPct + gap);
                const isAppointment = ev.type === 'appointment';
                const isBlock = ev.type === 'block';
                const leftBorder = isAppointment ? '#6366f1' : isBlock ? '#10b981' : '#94a3b8';
                return (
                  <div
                    key={ev.type === 'recurring' ? `r-${ev.id}` : ev.id}
                    className="absolute rounded-lg border border-slate-200/80 overflow-hidden shadow-sm"
                    style={{
                      top: `${topPct}%`,
                      height: `${Math.max(heightPct, 4)}%`,
                      minHeight: 32,
                      left: `calc(${leftPct}% + 6px)`,
                      width: `calc(${widthPct}% - ${6 + gap}px)`,
                      backgroundColor: isAppointment ? '#eef2ff' : isBlock ? '#ecfdf5' : '#f8fafc',
                      borderColor: isAppointment ? '#c7d2fe' : isBlock ? '#a7f3d0' : '#e2e8f0',
                      borderLeftWidth: '3px',
                      borderLeftColor: leftBorder,
                    }}
                  >
                    {ev.type === 'appointment' ? (
                      <Link
                        to={`/appointment/${ev.id}`}
                        className="block p-2 truncate no-underline text-inherit text-[13px] font-medium text-slate-800"
                      >
                        {formatTimeAmPm(ev.start)} – {ev.label}
                      </Link>
                    ) : ev.type === 'recurring' ? (
                      <div className="p-2 flex items-center gap-1 min-h-0">
                        <span className="truncate flex-1 text-[13px] font-medium text-slate-700">{formatTimeAmPm(ev.start)} – {ev.label}</span>
                        <button
                          type="button"
                          onClick={() => dismissRecurring(ev.id)}
                          className="shrink-0 text-[10px] text-amber-700 font-medium px-1.5 py-0.5 rounded hover:bg-amber-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 flex items-center gap-1 min-h-0">
                        <span className="truncate flex-1 text-[13px] font-medium text-slate-700">{formatTimeAmPm(ev.start)} – {ev.label}</span>
                        <button
                          type="button"
                          onClick={() => removeBlock(ev.id)}
                          className="shrink-0 text-[10px] text-amber-700 font-medium px-1.5 py-0.5 rounded hover:bg-amber-100"
                        >
                          Remove
                        </button>
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

      <Section heading="Send day to Bishop">
        <div className="card p-4">
          <p className="text-sm text-muted mb-3">Pre-filled message with the day&apos;s schedule (interviews, recurring meetings, custom events). Opens your messaging app or WhatsApp.</p>
          <label className="block mb-3">
            <span className="text-sm font-medium text-muted block mb-1">Date</span>
            <input
              type="date"
              value={sendToBishopDate}
              onChange={(e) => { setSendToBishopDate(e.target.value); setSendToBishopError(null); }}
              className="border border-border rounded-xl px-3 py-2.5 w-full max-w-xs"
            />
          </label>
          {sendToBishopError && <p className="text-red-600 text-sm mb-2">{sendToBishopError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                setSendToBishopError(null);
                const bishop = await getBishopPerson();
                const phone = bishop?.phones?.[0];
                if (!phone) {
                  setSendToBishopError('Set Bishop in Settings and add a phone number for him.');
                  return;
                }
                const body = await getDayScheduleText(sendToBishopDate);
                openSms(phone, body);
              }}
              className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold min-h-tap"
            >
              Send via Text
            </button>
            <button
              type="button"
              onClick={async () => {
                setSendToBishopError(null);
                const bishop = await getBishopPerson();
                const phone = bishop?.phones?.[0];
                if (!phone) {
                  setSendToBishopError('Set Bishop in Settings and add a phone number for him.');
                  return;
                }
                const body = await getDayScheduleText(sendToBishopDate);
                openWhatsApp(phone, body);
              }}
              className="border-2 border-green-600 text-green-700 px-4 py-2.5 rounded-xl font-semibold min-h-tap hover:bg-green-50"
            >
              Send via WhatsApp
            </button>
          </div>
        </div>
      </Section>

      {slotPicker && (
        <PeoplePickerModal
          onSelect={handleSelectPerson}
          onClose={() => setSlotPicker(null)}
          filter={(p) => !p.doNotInterview && !p.inactive}
          extraContent={
            <>
              <p className="text-sm text-muted mb-2">Add confirmation to message queue?</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={addToQueue} onChange={(e) => setAddToQueue(e.target.checked)} />
                <span>Add confirmation to queue</span>
              </label>
            </>
          }
        />
      )}

      {pendingRecipient && (
        <RecipientPickerModal
          person={pendingRecipient.person}
          onSelect={handleRecipientChosen}
          onClose={() => handleRecipientChosen(null)}
        />
      )}

      {showAddOther && (
        <>
          <div className="fixed inset-0 z-10 bg-black/30" aria-hidden />
          <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-border p-4 w-[80vw] max-w-[480px]">
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
