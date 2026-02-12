import { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import {
  getSlotsForDate,
  getInterviewSlotMinutes,
  upcomingSunday,
  todayLocalDate,
  nextSunday,
  formatTimeAmPm,
} from '../lib/scheduling';
import { getBlackoutDates } from '../lib/blackouts';
import { formatSundayLabel } from '../lib/monthInterviews';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { getRenderedTemplate, getLocationSuffix, INTERVIEW_LOCATION_OPTIONS } from '../lib/templates';
import { getMessageRecipientPhone } from '../lib/contactRecipient';
import { REACH_OUT_INTERVIEW_TYPES, getMessageTextForType } from '../lib/reachOutTemplate';
import type { Person } from '../db/schema';
import type { SlotInfo } from '../lib/scheduling';

const DEFAULT_DURATION = 20;
const DURATION_OPTIONS = [15, 20, 30];

export function HallwayMode() {
  const today = todayLocalDate();
  const thisSunday = upcomingSunday(today);
  const nextSun = nextSunday(today);
  const [slotsThis, setSlotsThis] = useState<SlotInfo[]>([]);
  const [slotsNext, setSlotsNext] = useState<SlotInfo[]>([]);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [customDuration, setCustomDuration] = useState('');
  const [interviewKind, setInterviewKind] = useState('standard_interview');
  const [location, setLocation] = useState('');
  const [slotPicker, setSlotPicker] = useState<{ localDate: string; minutesFromMidnight: number } | null>(null);
  const [addToQueue, setAddToQueue] = useState(true);

  const effectiveDuration = DURATION_OPTIONS.includes(duration) ? duration : (parseInt(customDuration, 10) || DEFAULT_DURATION);
  const interviewTypeName = getMessageTextForType(interviewKind);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [slotMinutes, blackouts, apptsThis, apptsNext] = await Promise.all([
        getInterviewSlotMinutes(),
        getBlackoutDates(),
        db.appointments.where('localDate').equals(thisSunday).toArray(),
        db.appointments.where('localDate').equals(nextSun).toArray(),
      ]);
      if (cancelled) return;
      const toSlots = (localDate: string, list: { minutesFromMidnight: number; durationMinutes?: number }[]) =>
        getSlotsForDate(localDate, list.map((a) => ({ ...a, localDate })), blackouts, slotMinutes);
      const [sThis, sNext] = await Promise.all([
        toSlots(thisSunday, apptsThis),
        toSlots(nextSun, apptsNext),
      ]);
      if (cancelled) return;
      setSlotsThis(sThis);
      setSlotsNext(sNext);
    })();
    return () => { cancelled = true; };
  }, [thisSunday, nextSun]);

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
      durationMinutes: effectiveDuration,
      status: 'hold',
      historyLog: [],
      interviewKind,
      location: location || undefined,
      createdAt: now,
      updatedAt: now,
    });
    if (addToQueue) {
      const phone = await getMessageRecipientPhone(person);
      if (phone) {
        const dateLabel = slotPicker.localDate.replace(/-/g, '/');
        const timeLabel = formatTimeAmPm(slotPicker.minutesFromMidnight);
        const locationSuffix = getLocationSuffix(location);
        const body = await getRenderedTemplate(interviewKind, {
          name: person.nameListPreferred,
          date: dateLabel,
          time: timeLabel,
          interviewType: interviewTypeName,
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
  };

  const renderSlotGrid = (slots: SlotInfo[], localDate: string) => (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) =>
        slot.taken ? (
          <span
            key={`${slot.localDate}-${slot.minutesFromMidnight}`}
            className="px-3 py-2.5 rounded-xl border border-border bg-slate-100 text-muted text-sm font-medium"
          >
            {slot.label}
          </span>
        ) : (
          <button
            key={`${slot.localDate}-${slot.minutesFromMidnight}`}
            type="button"
            onClick={() => setSlotPicker({ localDate, minutesFromMidnight: slot.minutesFromMidnight })}
            className="px-3 py-2.5 rounded-xl border-2 border-primary bg-white text-primary font-semibold min-h-tap hover:bg-primary/10 active:bg-primary/15 transition-colors"
          >
            {slot.label}
          </button>
        )
      )}
    </div>
  );

  return (
    <PageLayout back="auto" title="Hallway mode">
      <div className="card p-4 mb-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Duration</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`px-4 py-2.5 rounded-xl border min-h-tap font-medium transition-colors ${duration === d ? 'bg-primary text-white border-primary' : 'bg-white border-border hover:bg-slate-50'}`}
            >
              {d} min
            </button>
          ))}
          <label className="flex items-center gap-2">
            <span className="text-muted text-sm">Custom:</span>
            <input
              type="number"
              min={5}
              max={120}
              value={customDuration}
              onChange={(e) => {
                setCustomDuration(e.target.value);
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setDuration(n);
              }}
              placeholder="min"
              className="w-16 border border-border rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
      </div>

      <Section heading="Interview type">
        <select
          value={interviewKind}
          onChange={(e) => setInterviewKind(e.target.value)}
          className="border border-border rounded-xl px-3 py-2.5 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          {REACH_OUT_INTERVIEW_TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.name}</option>
          ))}
        </select>
      </Section>

      <Section heading="Location">
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="border border-border rounded-xl px-3 py-2.5 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          {INTERVIEW_LOCATION_OPTIONS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Section>

      <Section heading={formatSundayLabel(thisSunday)}>
        <div className="card p-4">
          {renderSlotGrid(slotsThis, thisSunday)}
          {slotsThis.length === 0 && <p className="text-muted text-sm">No slots.</p>}
        </div>
      </Section>

      <Section heading={formatSundayLabel(nextSun)}>
        <div className="card p-4">
          {renderSlotGrid(slotsNext, nextSun)}
          {slotsNext.length === 0 && <p className="text-muted text-sm">No slots.</p>}
        </div>
      </Section>

      {slotPicker && (
        <>
          <div className="fixed inset-0 z-10 bg-black/30 backdrop-blur-[2px]" aria-hidden />
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-border rounded-t-2xl p-4 max-h-[70vh] overflow-auto shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <p className="text-sm text-muted mb-2">Add confirmation to message queue?</p>
            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={addToQueue} onChange={(e) => setAddToQueue(e.target.checked)} />
              <span>Add to queue</span>
            </label>
            <PeoplePickerModal
              onSelect={handleSelectPerson}
              onClose={() => setSlotPicker(null)}
              filter={(p) => !p.doNotInterview && !p.inactive}
            />
          </div>
        </>
      )}
    </PageLayout>
  );
}
