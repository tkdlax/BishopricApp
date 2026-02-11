import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import {
  minutesToTime,
  getNextAvailableSlot,
  getInterviewSlotMinutes,
  addDays,
} from '../lib/scheduling';
import { getBlackoutDates } from '../lib/blackouts';
import { getRenderedTemplate, getLocationSuffix, INTERVIEW_LOCATION_OPTIONS } from '../lib/templates';
import { getMessageRecipientPhone } from '../lib/contactRecipient';
import { buildIcsForAppointment, downloadIcs } from '../lib/calendarExport';
import { REACH_OUT_INTERVIEW_TYPES } from '../lib/reachOutTemplate';
import type { Appointment, Person } from '../db/schema';

const STATUS_OPTIONS = ['hold', 'invited', 'confirmed', 'completed', 'canceled', 'no_show'] as const;

export const AppointmentDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!id) return;
    db.appointments.get(id).then((a) => {
      setAppointment(a ?? null);
      if (a) {
        setLocation(a.location ?? '');
        db.people.get(a.personId).then((p) => setPerson(p ?? null));
      }
    });
  }, [id]);

  const handleStatusChange = async (status: typeof STATUS_OPTIONS[number]) => {
    if (!appointment) return;
    const now = Date.now();
    const log = [...(appointment.historyLog ?? []), { at: now, who: 'user', what: `Status → ${status}` }];
    await db.appointments.update(id!, { status, historyLog: log, updatedAt: now });
    setAppointment((prev) => prev ? { ...prev, status, historyLog: log, updatedAt: now } : null);
  };

  const handleLocationSave = async () => {
    if (!appointment) return;
    const now = Date.now();
    await db.appointments.update(id!, { location: location.trim() || undefined, updatedAt: now });
    setAppointment((prev) => prev ? { ...prev, location: location.trim() || undefined, updatedAt: now } : null);
  };

  const handlePunt = async () => {
    if (!appointment) return;
    const [slotMinutes, blackouts, allAppointments] = await Promise.all([
      getInterviewSlotMinutes(),
      getBlackoutDates(),
      db.appointments.toArray(),
    ]);
    const appts = allAppointments.filter((a) => a.id !== appointment.id).map((a) => ({
      localDate: a.localDate,
      minutesFromMidnight: a.minutesFromMidnight,
      durationMinutes: a.durationMinutes ?? 20,
    }));
    const from = addDays(appointment.localDate, 1);
    const next = getNextAvailableSlot(from, appts, blackouts, slotMinutes);
    if (!next) return;
    const now = Date.now();
    const log = [...(appointment.historyLog ?? []), { at: now, who: 'user', what: `Punted to ${next.localDate} ${minutesToTime(next.minutesFromMidnight)}` }];
    await db.appointments.update(id!, {
      localDate: next.localDate,
      minutesFromMidnight: next.minutesFromMidnight,
      historyLog: log,
      updatedAt: now,
    });
    setAppointment((prev) => prev ? { ...prev, localDate: next.localDate, minutesFromMidnight: next.minutesFromMidnight, historyLog: log, updatedAt: now } : null);
  };

  const handleAddToQueue = async () => {
    if (!appointment || !person) return;
    const phone = await getMessageRecipientPhone(person);
    if (!phone) return;
    const interviewKind = appointment.interviewKind ?? 'standard_interview';
    const typeName = REACH_OUT_INTERVIEW_TYPES.find((t) => t.type === interviewKind)?.name ?? 'interview';
    const dateLabel = appointment.localDate.replace(/-/g, '/');
    const timeLabel = minutesToTime(appointment.minutesFromMidnight);
    const locationSuffix = getLocationSuffix(appointment.location);
    const body = await getRenderedTemplate(interviewKind, {
      name: person.nameListPreferred,
      date: dateLabel,
      time: timeLabel,
      interviewType: typeName,
      locationSuffix,
    });
    const now = Date.now();
    await db.messageQueue.add({
      id: `msg-${now}-${Math.random().toString(36).slice(2, 9)}`,
      recipientPhone: phone,
      renderedMessage: body,
      relatedObjectType: 'appointment',
      relatedObjectId: appointment.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleAddToCalendar = () => {
    if (!appointment || !person) return;
    const typeName = REACH_OUT_INTERVIEW_TYPES.find((t) => t.type === (appointment.interviewKind ?? 'standard_interview'))?.name ?? 'Interview';
    const ics = buildIcsForAppointment(appointment, person.nameListPreferred, typeName);
    const filename = `interview-${person.nameListPreferred.replace(/\s+/g, '-')}-${appointment.localDate}.ics`;
    downloadIcs(ics, filename);
  };

  if (!appointment) {
    return (
      <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Appointment">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  const interviewTypeName = REACH_OUT_INTERVIEW_TYPES.find((t) => t.type === (appointment.interviewKind ?? 'standard_interview'))?.name ?? 'Interview';

  return (
    <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Appointment">
      <Section heading="Person">
        <Link to={`/contacts/person/${appointment.personId}`} className="text-primary font-medium min-h-tap">
          {person?.nameListPreferred ?? '—'} — View person
        </Link>
      </Section>
      <Section heading="When">
        <p className="font-medium">
          {appointment.localDate} at {minutesToTime(appointment.minutesFromMidnight)} ({appointment.durationMinutes ?? 20} min)
        </p>
      </Section>
      <Section heading="Type">
        <p>{interviewTypeName}</p>
      </Section>
      <Section heading="Status">
        <select
          value={appointment.status}
          onChange={(e) => handleStatusChange(e.target.value as typeof STATUS_OPTIONS[number])}
          className="border border-border rounded-lg px-3 py-2"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Section>
      <Section heading="Location">
        <div className="flex gap-2">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={handleLocationSave}
            className="border border-border rounded-lg px-3 py-2 flex-1"
          >
            {INTERVIEW_LOCATION_OPTIONS.map((o) => (
              <option key={o.value || 'none'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="button" onClick={handleLocationSave} className="bg-primary text-white rounded-lg px-3 py-2 min-h-tap">Save</button>
        </div>
      </Section>
      <Section heading="Actions">
        <div className="flex flex-col gap-2">
          <button type="button" onClick={handleAddToQueue} className="rounded-lg border border-border px-3 py-2 text-left font-medium min-h-tap hover:bg-slate-50">
            Add to queue
          </button>
          <button type="button" onClick={handlePunt} className="rounded-lg border border-border px-3 py-2 text-left font-medium min-h-tap hover:bg-slate-50">
            Punt (move to next available slot)
          </button>
          <button type="button" onClick={handleAddToCalendar} className="rounded-lg border border-border px-3 py-2 text-left font-medium min-h-tap hover:bg-slate-50">
            Add to calendar (.ics)
          </button>
        </div>
      </Section>
      {appointment.historyLog && appointment.historyLog.length > 0 && (
        <Section heading="History">
          <ul className="list-none p-0 m-0 text-sm text-muted space-y-1">
            {[...appointment.historyLog].reverse().map((entry, i) => (
              <li key={i}>
                {new Date(entry.at).toLocaleString()} — {entry.what}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageLayout>
  );
};
