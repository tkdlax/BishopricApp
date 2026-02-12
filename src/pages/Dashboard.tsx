import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { getDueNowCounts } from '../lib/dueRules';
import { formatTimeAmPm, formatLongDate } from '../lib/monthInterviews';
import { upcomingSunday, todayLocalDate, getWeekOfMonth } from '../lib/scheduling';
import {
  CalendarPlus,
  List,
  Calendar,
  MessageCircle,
  Users,
  Settings,
  ClipboardList,
  CircleDollarSign,
  Heart,
  CloudUpload,
  ChevronRight,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const DEFAULT_TEMPLATE_ID = 'schedule-monthly-sunday';
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const TOTAL_MINUTES = DAY_END - DAY_START;

type DayEvent =
  | { type: 'appointment'; id: string; personId?: string; personName?: string; start: number; end: number; label: string }
  | { type: 'block'; id: string; start: number; end: number; label: string }
  | { type: 'recurring'; id: string; start: number; end: number; label: string };

export function Dashboard() {
  const [dueNow, setDueNow] = useState({ confirmations: 0, queue: 0 });
  const [customInterviews, setCustomInterviews] = useState<{ id: string; label: string; personId?: string }[]>([]);
  const [otherExpanded, setOtherExpanded] = useState(false);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);

  const upcomingSun = upcomingSunday(todayLocalDate());

  useEffect(() => {
    getDueNowCounts().then(setDueNow);
  }, []);

  useEffect(() => {
    db.customInterviewToGet
      .toArray()
      .then((list) => list.filter((c) => !c.completedAt))
      .then((list) => setCustomInterviews(list.map((c) => ({ id: c.id, label: c.label, personId: c.personId }))));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const week = getWeekOfMonth(upcomingSun);
      const [appointments, dayBlocks, recurring, peopleList, exceptions] = await Promise.all([
        db.appointments.where('localDate').equals(upcomingSun).toArray(),
        db.dayBlocks.where('localDate').equals(upcomingSun).toArray(),
        db.recurringScheduleItems.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
        db.people.toArray(),
        db.scheduleItemExceptions.where('templateId').equals(DEFAULT_TEMPLATE_ID).toArray(),
      ]);
      if (cancelled) return;
      const exceptionItemIds = new Set(exceptions.filter((e) => e.localDate === upcomingSun).map((e) => e.itemId));
      const nameBy = new Map(peopleList.map((p) => [p.id, p.nameListPreferred]));
      const list: DayEvent[] = [];
      const DURATION = 20;
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
      setDayEvents(list);
    })();
    return () => { cancelled = true; };
  }, [upcomingSun]);

  const dueTotal = dueNow.confirmations + dueNow.queue;
  const timeSlots: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += 30) timeSlots.push(m);
  const today = todayLocalDate();
  function getOverlapping(ev: DayEvent, evIndex: number): { index: number; total: number } {
    const overlapping = dayEvents
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.start < ev.end && e.end > ev.start)
      .sort((a, b) => a.e.start - b.e.start);
    const idx = overlapping.findIndex(({ i }) => i === evIndex);
    return { index: idx < 0 ? 0 : idx, total: Math.max(1, overlapping.length) };
  }

  return (
    <div className="max-w-[640px] mx-auto pb-6">
      <p className="text-muted text-sm mb-5 mt-0 pt-4">All data stays on this device unless you export it.</p>

      <section className="mb-6">
        <div className="flex flex-col gap-3">
          <Link
            to="/schedule"
            className="schedule-cta card flex items-center gap-4 p-4 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all text-white border-primary border-l-4 border-l-accent"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CalendarPlus size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-lg block">Schedule an interview</span>
              <span className="text-white/85 text-sm">Reach out or pick a time</span>
            </div>
            <ChevronRight size={22} className="text-white/80 shrink-0" />
          </Link>

          <Link
            to="/messages"
            className="card flex items-center justify-between gap-4 p-4 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all border-l-4 border-l-transparent"
            style={dueTotal > 0 ? { borderLeftColor: 'var(--color-accent)' } : undefined}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${dueTotal > 0 ? 'bg-accent/15' : 'bg-primary/10'}`}>
                <MessageCircle size={24} className={dueTotal > 0 ? 'text-accent' : 'text-primary'} />
              </div>
              <div>
                <span className="font-semibold block">Message queue</span>
                <span className="text-muted text-sm">{dueTotal > 0 ? `${dueTotal} due` : 'Open'}</span>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted shrink-0" />
          </Link>

          <Link
            to="/interviews-to-get"
            className="card flex items-center justify-between gap-4 p-4 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardCheck size={24} className="text-primary" />
              </div>
              <div>
                <span className="font-semibold block">Interviews to get</span>
                <span className="text-muted text-sm">
                  {customInterviews.length > 0 ? `${customInterviews.length} on your list` : 'Custom list, youth, advancement, baptism'}
                </span>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted shrink-0" />
          </Link>
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide m-0">Upcoming interviews</h3>
          <Link to="/day" className="text-primary font-medium text-sm min-h-tap">Full day view</Link>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
            <p className="text-base font-semibold text-slate-800 m-0">{formatLongDate(upcomingSun)}</p>
          </div>
          <div className="flex min-h-[200px]">
            <div className="w-[4rem] shrink-0 border-r border-slate-100 bg-slate-50/50 py-1.5 pr-1">
              {timeSlots.map((m) => (
                <div key={m} className="text-[10px] text-slate-500 font-medium tabular-nums leading-5 h-5" style={{ height: 20 }}>
                  {formatTimeAmPm(m)}
                </div>
              ))}
            </div>
            <div className="flex-1 relative bg-slate-50/30" style={{ height: Math.max(timeSlots.length * 20, 200) }}>
              {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => (
                <div
                  key={`h-${i}`}
                  className="absolute left-0 right-0 border-t border-slate-200/70"
                  style={{ top: `${(i * 60 / TOTAL_MINUTES) * 100}%` }}
                />
              ))}
              {upcomingSun === today && (() => {
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
              {dayEvents.map((ev, evIndex) => {
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
                      height: `${Math.max(heightPct, 3)}%`,
                      minHeight: 20,
                      left: `calc(${leftPct}% + 4px)`,
                      width: `calc(${widthPct}% - ${4 + gap}px)`,
                      backgroundColor: isAppointment ? '#eef2ff' : isBlock ? '#ecfdf5' : '#f8fafc',
                      borderColor: isAppointment ? '#c7d2fe' : isBlock ? '#a7f3d0' : '#e2e8f0',
                      borderLeftWidth: '3px',
                      borderLeftColor: leftBorder,
                    }}
                  >
                    {ev.type === 'appointment' ? (
                      <Link to={`/appointment/${ev.id}`} className="block p-1.5 truncate no-underline text-inherit text-xs font-medium text-slate-800">
                        {formatTimeAmPm(ev.start)} – {ev.label}
                      </Link>
                    ) : (
                      <div className="p-1.5 truncate text-xs font-medium text-slate-700">{formatTimeAmPm(ev.start)} – {ev.label}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setOtherExpanded(!otherExpanded)}
          className="w-full flex items-center justify-between gap-2 py-3 px-0 bg-transparent border-0 text-left font-semibold text-muted min-h-tap rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <span>More</span>
          {otherExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {otherExpanded && (
          <div className="grid grid-cols-2 gap-3">
            <Link to="/hallway" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <Calendar size={22} className="shrink-0 text-primary" /> <span className="font-medium">Hallway</span>
            </Link>
            <Link to="/day" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <List size={22} className="shrink-0 text-primary" /> <span className="font-medium">Day view</span>
            </Link>
            <Link to="/schedules" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <ClipboardList size={22} className="shrink-0 text-primary" /> <span className="font-medium">Schedules</span>
            </Link>
            <Link to="/interviews-to-get" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <ClipboardCheck size={22} className="shrink-0 text-primary" /> <span className="font-medium">Interviews to get</span>
            </Link>
            <Link to="/messages" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <MessageCircle size={22} className="shrink-0 text-primary" /> <span className="font-medium">Messages</span>
            </Link>
            <Link to="/tithing" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <CircleDollarSign size={22} className="shrink-0 text-primary" /> <span className="font-medium">Tithing</span>
            </Link>
            <Link to="/prayer" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <Heart size={22} className="shrink-0 text-primary" /> <span className="font-medium">Prayer</span>
            </Link>
            <Link to="/contacts" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <Users size={22} className="shrink-0 text-primary" /> <span className="font-medium">Contacts</span>
            </Link>
            <Link to="/settings" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <Settings size={22} className="shrink-0 text-primary" /> <span className="font-medium">Settings</span>
            </Link>
            <Link to="/backup" className="card flex items-center gap-3 p-3 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all">
              <CloudUpload size={22} className="shrink-0 text-primary" /> <span className="font-medium">Backup</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
