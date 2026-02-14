import { useState, useEffect, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout } from '../components/ui';
import {
  formatTimeAmPm,
  getNextAvailableSlot,
  getInterviewSlotMinutes,
  addDays,
} from '../lib/scheduling';
import { getBlackoutDates } from '../lib/blackouts';
import { getRenderedTemplate, getLocationSuffix, INTERVIEW_LOCATION_OPTIONS } from '../lib/templates';
import { getMessageRecipientPhone, isUnder18 } from '../lib/contactRecipient';
import { RecipientPickerModal } from '../components/RecipientPickerModal';
import { buildIcsForAppointment, downloadIcs } from '../lib/calendarExport';
import { REACH_OUT_INTERVIEW_TYPES, getMessageTextForType } from '../lib/reachOutTemplate';
import { formatSundayLabel } from '../lib/monthInterviews';
import type { Appointment, Person } from '../db/schema';
import { Calendar, MessageCircle, CalendarPlus, MapPin, ChevronDown, User } from 'lucide-react';

const STATUS_OPTIONS = ['hold', 'invited', 'confirmed', 'completed', 'canceled', 'no_show'] as const;

export const AppointmentDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [location, setLocation] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);

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
    const log = [...(appointment.historyLog ?? []), { at: now, who: 'user', what: `Punted to ${next.localDate} ${formatTimeAmPm(next.minutesFromMidnight)}` }];
    await db.appointments.update(id!, {
      localDate: next.localDate,
      minutesFromMidnight: next.minutesFromMidnight,
      historyLog: log,
      updatedAt: now,
    });
    setAppointment((prev) => prev ? { ...prev, localDate: next.localDate, minutesFromMidnight: next.minutesFromMidnight, historyLog: log, updatedAt: now } : null);
  };

  const addToQueueWithPhone = async (phone: string) => {
    if (!appointment || !person) return;
    const interviewKind = appointment.interviewKind ?? 'standard_interview';
    const typeName = getMessageTextForType(interviewKind);
    const dateLabel = appointment.localDate.replace(/-/g, '/');
    const timeLabel = formatTimeAmPm(appointment.minutesFromMidnight);
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

  const handleAddToQueue = async () => {
    if (!appointment || !person) return;
    if (isUnder18(person)) {
      setShowRecipientPicker(true);
      return;
    }
    const phone = await getMessageRecipientPhone(person);
    if (!phone) return;
    await addToQueueWithPhone(phone);
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
      <PageLayout back="auto" title="Appointment">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  const interviewTypeName = REACH_OUT_INTERVIEW_TYPES.find((t) => t.type === (appointment.interviewKind ?? 'standard_interview'))?.name ?? 'Interview';
  const dateLabel = formatSundayLabel(appointment.localDate);
  const timeLabel = formatTimeAmPm(appointment.minutesFromMidnight);
  const duration = appointment.durationMinutes ?? 20;
  const isPositiveStatus = appointment.status === 'confirmed' || appointment.status === 'completed';

  return (
    <PageLayout back="auto" title="Interview">
      {/* Hero card */}
      <div className="card border-l-4 border-l-accent overflow-hidden mb-6">
        <div className="p-5">
          <Link
            to={`/contacts/person/${appointment.personId}`}
            className="inline-flex items-center gap-2 font-bold text-xl text-slate-900 no-underline hover:text-primary transition-colors min-h-tap"
          >
            <User size={22} className="text-accent shrink-0" />
            {person?.nameListPreferred ?? '—'}
          </Link>
          <p className="text-muted text-sm mt-1">View contact</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={18} className="text-accent shrink-0" />
              {dateLabel} at {timeLabel}
            </span>
            <span className="text-muted">·</span>
            <span>{duration} min</span>
            <span className="text-muted">·</span>
            <span className="font-medium text-slate-800">{interviewTypeName}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                isPositiveStatus ? 'bg-accent/15 text-accent' : appointment.status === 'canceled' || appointment.status === 'no_show' ? 'bg-slate-200 text-slate-600' : 'bg-primary/10 text-primary'
              }`}
            >
              {appointment.status}
            </span>
            <select
              value={appointment.status}
              onChange={(e) => handleStatusChange(e.target.value as typeof STATUS_OPTIONS[number])}
              className="text-sm border border-border rounded-lg px-2 py-1 bg-white"
              aria-label="Change status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 text-muted text-sm font-medium mb-2">
          <MapPin size={18} className="text-accent shrink-0" />
          Location
        </div>
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
          <button type="button" onClick={handleLocationSave} className="btn-accent shrink-0">
            Save
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="card p-4 mb-6">
        <p className="text-muted text-sm font-medium mb-3">Actions</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAddToQueue}
            className="btn-accent flex items-center gap-2 justify-center"
          >
            <MessageCircle size={20} />
            Add to message queue
          </button>
          <button
            type="button"
            onClick={handlePunt}
            className="flex items-center gap-2 justify-center rounded-xl border border-border px-4 py-3 font-medium min-h-tap hover:bg-slate-50 text-slate-700"
          >
            <CalendarPlus size={20} />
            Move to next available slot
          </button>
          <button
            type="button"
            onClick={handleAddToCalendar}
            className="flex items-center gap-2 justify-center rounded-xl border border-border px-4 py-3 font-medium min-h-tap hover:bg-slate-50 text-slate-700"
          >
            <Calendar size={20} />
            Download .ics for calendar
          </button>
        </div>
      </div>

      {/* History */}
      {appointment.historyLog && appointment.historyLog.length > 0 && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between gap-2 py-3 px-4 text-left font-medium text-muted hover:bg-slate-50 min-h-tap"
          >
            <span>History ({appointment.historyLog.length})</span>
            <ChevronDown size={20} className={`shrink-0 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          {historyOpen && (
            <ul className="list-none p-0 m-0 border-t border-border">
              {[...appointment.historyLog].reverse().map((entry, i) => (
                <li key={i} className="py-2 px-4 text-sm text-muted border-b border-border last:border-0">
                  <span className="text-slate-500">{new Date(entry.at).toLocaleString()}</span>
                  <span className="ml-2">{entry.what}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {showRecipientPicker && person && (
        <RecipientPickerModal
          person={person}
          onSelect={(phone) => {
            if (phone) void addToQueueWithPhone(phone);
            setShowRecipientPicker(false);
          }}
          onClose={() => setShowRecipientPicker(false)}
        />
      )}
    </PageLayout>
  );
};
