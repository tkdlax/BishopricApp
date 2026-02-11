import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { getDueNowCounts } from '../lib/dueRules';
import { getMonthInterviews, formatSundayLabel, formatTimeAmPm, type MonthInterviewRow } from '../lib/monthInterviews';
import { upcomingSunday, todayLocalDate } from '../lib/scheduling';
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

interface CustomItem { id: string; label: string; personId?: string }

export function Dashboard() {
  const [dueNow, setDueNow] = useState({ confirmations: 0, queue: 0 });
  const [monthInterviews, setMonthInterviews] = useState<MonthInterviewRow[]>([]);
  const [upcomingSundayCount, setUpcomingSundayCount] = useState(0);
  const [customInterviews, setCustomInterviews] = useState<CustomItem[]>([]);
  const [otherExpanded, setOtherExpanded] = useState(false);

  const upcomingSun = upcomingSunday(todayLocalDate());

  useEffect(() => {
    getDueNowCounts().then(setDueNow);
  }, []);

  useEffect(() => {
    getMonthInterviews().then(setMonthInterviews);
  }, []);

  useEffect(() => {
    db.customInterviewToGet
      .toArray()
      .then((list) => list.filter((c) => !c.completedAt))
      .then((list) => setCustomInterviews(list.map((c) => ({ id: c.id, label: c.label, personId: c.personId }))));
  }, []);

  useEffect(() => {
    db.appointments
      .where('localDate')
      .equals(upcomingSun)
      .filter((a) => a.type === 'bishop_interview' && a.status !== 'canceled')
      .count()
      .then(setUpcomingSundayCount);
  }, [upcomingSun]);

  const today = todayLocalDate();
  const monthUpcoming = monthInterviews.filter((row) => row.localDate >= today);
  const bySunday: Record<string, MonthInterviewRow[]> = monthUpcoming.reduce((acc, row) => {
    if (!acc[row.localDate]) acc[row.localDate] = [];
    acc[row.localDate].push(row);
    return acc;
  }, {} as Record<string, MonthInterviewRow[]>);
  const sundayDates = Object.keys(bySunday).sort();

  const dueTotal = dueNow.confirmations + dueNow.queue;

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
            to="/day"
            className="card flex items-center justify-between gap-4 p-4 no-underline text-inherit hover:shadow-md active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <List size={24} className="text-primary" />
              </div>
              <div>
                <span className="font-semibold block">Upcoming Sunday</span>
                <span className="text-muted text-sm">{formatSundayLabel(upcomingSun)}</span>
              </div>
            </div>
            <span className="text-muted text-sm shrink-0">
              {upcomingSundayCount} interview{upcomingSundayCount !== 1 ? 's' : ''}
            </span>
            <ChevronRight size={20} className="text-muted shrink-0" />
          </Link>
        </div>
      </section>

      {customInterviews.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide m-0">My interviews to get</h3>
            <Link to="/interviews-to-get" className="text-primary font-medium text-sm min-h-tap">View all</Link>
          </div>
          <div className="card">
            <ul className="list-none p-0 m-0">
              {customInterviews.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to={c.personId ? `/contacts/person/${c.personId}` : '/interviews-to-get'}
                    className="card-row flex items-center gap-3 no-underline text-inherit"
                  >
                    <span className="flex-1 min-w-0 font-medium truncate">{c.label}</span>
                    <ChevronRight size={18} className="text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
            {customInterviews.length > 5 && (
              <Link to="/interviews-to-get" className="card-row flex items-center gap-3 no-underline text-inherit text-muted text-sm">
                <span className="flex-1">+{customInterviews.length - 5} more</span>
                <ChevronRight size={18} className="shrink-0" />
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">This month&apos;s interviews</h3>
        <div className="card">
          {sundayDates.length === 0 ? (
            <div className="p-5 text-center text-muted text-sm">
              No interviews this month. Schedule someone or open Hallway from More below.
            </div>
          ) : (
            <ul className="list-none p-0 m-0">
              {sundayDates.map((localDate) => (
                <li key={localDate}>
                  <div className="px-4 pt-3 pb-1 text-muted text-xs font-semibold uppercase tracking-wide">
                    {formatSundayLabel(localDate)}
                  </div>
                  {bySunday[localDate].map((row: MonthInterviewRow) => (
                    <Link
                      key={row.appointmentId}
                      to={`/appointment/${row.appointmentId}`}
                      className="card-row flex items-center gap-3 no-underline text-inherit"
                    >
                      <span className="flex-1 min-w-0 font-medium">
                        {formatTimeAmPm(row.minutesFromMidnight)} – {row.personName}
                      </span>
                      <ChevronRight size={18} className="text-muted shrink-0" />
                    </Link>
                  ))}
                </li>
              ))}
            </ul>
          )}
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
