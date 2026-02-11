import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import {
  getSlotsForDate,
  getInterviewSlotMinutes,
  upcomingSunday,
  todayLocalDate,
  nextSunday,
  minutesToTime,
} from '../lib/scheduling';
import { getBlackoutDates } from '../lib/blackouts';
import { formatSundayLabel } from '../lib/monthInterviews';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import type { Person } from '../db/schema';
import type { SlotInfo } from '../lib/scheduling';
import { getRenderedTemplate } from '../lib/templates';
import { getMessageRecipientPhone } from '../lib/contactRecipient';
import { getLocationSuffix } from '../lib/templates';

const DURATION = 20;
const INTERVIEW_KIND = 'standard_interview';

export function DayView() {
  const today = todayLocalDate();
  const defaultDate = upcomingSunday(today);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [appointments, setAppointments] = useState<{ id: string; personId: string; minutesFromMidnight: number; durationMinutes: number }[]>([]);
  const [personByName, setPersonByName] = useState<Record<string, string>>({});
  const [slotPicker, setSlotPicker] = useState<{ localDate: string; minutesFromMidnight: number } | null>(null);
  const [addToQueue, setAddToQueue] = useState(true);

  const nextSun = nextSunday(today);
  const isThisSunday = selectedDate === defaultDate;
  const isNextSunday = selectedDate === nextSun;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [slotMinutes, blackouts, dayAppointments] = await Promise.all([
        getInterviewSlotMinutes(),
        getBlackoutDates(),
        db.appointments.where('localDate').equals(selectedDate).toArray(),
      ]);
      if (cancelled) return;
      const appts = dayAppointments.map((a) => ({
        id: a.id,
        personId: a.personId,
        localDate: a.localDate,
        minutesFromMidnight: a.minutesFromMidnight,
        durationMinutes: a.durationMinutes ?? DURATION,
      }));
      const slotsResult = await getSlotsForDate(selectedDate, appts, blackouts, slotMinutes);
      setSlots(slotsResult);
      setAppointments(appts);
      const ids = [...new Set(appts.map((a) => a.personId))];
      const people = await db.people.bulkGet(ids);
      const byId: Record<string, string> = {};
      people.forEach((p) => {
        if (p) byId[p.id] = p.nameListPreferred;
      });
      setPersonByName(byId);
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
        const timeLabel = minutesToTime(slotPicker.minutesFromMidnight);
        const locationSuffix = getLocationSuffix();
        const body = await getRenderedTemplate(INTERVIEW_KIND, {
          name: person.nameListPreferred,
          date: dateLabel,
          time: timeLabel,
          interviewType: 'Bishop interview',
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
    setAppointments((prev) => [
      ...prev,
      {
        id,
        personId: person.id,
        minutesFromMidnight: slotPicker.minutesFromMidnight,
        durationMinutes: DURATION,
      },
    ]);
    setSlots((prev) =>
      prev.map((s) =>
        s.minutesFromMidnight === slotPicker.minutesFromMidnight ? { ...s, taken: true } : s
      )
    );
  };

  const getAppointmentAt = (minutesFromMidnight: number) =>
    appointments.find((a) => {
      const end = a.minutesFromMidnight + (a.durationMinutes ?? DURATION);
      return minutesFromMidnight >= a.minutesFromMidnight && minutesFromMidnight < end;
    });

  return (
    <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Day view">
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

      <Section heading="Slots">
        <div className="card">
          {slots.length === 0 ? (
            <p className="p-5 text-muted text-sm">No slots (blackout or no window).</p>
          ) : (
            <ul className="list-none p-0 m-0">
              {slots.map((slot) => {
                const appt = getAppointmentAt(slot.minutesFromMidnight);
                return (
                  <li key={`${slot.localDate}-${slot.minutesFromMidnight}`}>
                    <div className="card-row flex items-center gap-3">
                      <span className="font-mono text-sm w-14 shrink-0 text-muted">{slot.label}</span>
                      {appt ? (
                        <Link
                          to={`/appointment/${appt.id}`}
                          className="flex-1 font-semibold text-primary min-h-tap no-underline"
                        >
                          {personByName[appt.personId] ?? '—'}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSlotPicker({ localDate: slot.localDate, minutesFromMidnight: slot.minutesFromMidnight })}
                          className="flex-1 text-left text-muted font-medium min-h-tap hover:text-slate-900"
                        >
                          Available
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>

      {slotPicker && (
        <>
          <div className="fixed inset-0 z-10 bg-black/30 backdrop-blur-[2px]" aria-hidden />
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-border rounded-t-2xl p-4 max-h-[70vh] overflow-auto shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <p className="text-sm text-muted mb-2">
              Add to message queue after scheduling?
            </p>
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={addToQueue}
                onChange={(e) => setAddToQueue(e.target.checked)}
              />
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
    </PageLayout>
  );
}
