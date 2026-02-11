/**
 * Export a one-off interview appointment as an .ics file for the native calendar.
 */

import type { Appointment } from '../db/schema';

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsLocalDateTime(localDate: string, minutesFromMidnight: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const h = Math.floor(minutesFromMidnight / 60);
  const min = minutesFromMidnight % 60;
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}00`;
}

export function buildIcsForAppointment(
  appointment: Appointment,
  personName: string,
  interviewTypeName?: string
): string {
  const start = toIcsLocalDateTime(appointment.localDate, appointment.minutesFromMidnight);
  const endMinutes = appointment.minutesFromMidnight + (appointment.durationMinutes ?? 20);
  const end = toIcsLocalDateTime(appointment.localDate, endMinutes);
  const typeLabel = interviewTypeName?.trim() || 'Interview';
  const summary = `${personName} = ${typeLabel}`;
  const uid = `${appointment.id.replace(/[^a-zA-Z0-9-]/g, '-')}@bishopric-app`;
  const location = appointment.location?.trim() || '';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bishopric App//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Bishopric Interviews',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(summary)}`,
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function downloadIcs(icsContent: string, filename: string = 'interview.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
