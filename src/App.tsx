import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { db } from './db/schema';
import { getNavItemsByIds, getAllNavPaths, DEFAULT_NAV_ORDER, NAV_SETTINGS_KEY } from './lib/navConfig';
import { Dashboard } from './pages/Dashboard';
import { ScheduleInterview } from './pages/ScheduleInterview';
import { MessageCenter } from './pages/MessageCenter';
import { Settings } from './pages/Settings';
import { HallwayMode } from './pages/HallwayMode';
import { ScheduleTemplates, ScheduleTemplateDetail } from './pages/ScheduleTemplates';
import { TithingDashboard } from './pages/TithingDashboard';
import { ImportWardList } from './pages/ImportWardList';
import { DayView } from './pages/DayView';
import { AppointmentDetail } from './pages/AppointmentDetail';
import { ContactsManager } from './pages/ContactsManager';
import { HouseholdDetail } from './pages/HouseholdDetail';
import { PersonDetail } from './pages/PersonDetail';
import { InterviewsToGet } from './pages/InterviewsToGet';
import { PrayerDashboard } from './pages/PrayerDashboard';
import { BackupRestore } from './pages/BackupRestore';
import { TemplateEditor } from './pages/TemplateEditor';
import { QueueRunnerModal } from './components/QueueRunnerModal';

function AppointmentDetailPage() {
  return <AppointmentDetail />;
}

function AppShell() {
  const location = useLocation();
  const [showQueue, setShowQueue] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(DEFAULT_NAV_ORDER);

  useEffect(() => {
    db.settings.get(NAV_SETTINGS_KEY).then((s) => {
      const raw = s?.value;
      if (typeof raw === 'string') {
        try {
          const arr = JSON.parse(raw) as unknown;
          if (Array.isArray(arr) && arr.length > 0) setNavOrder(arr as string[]);
        } catch {
          // ignore
        }
      }
    });
  }, []);

  useEffect(() => {
    const handler = () => {
      db.settings.get(NAV_SETTINGS_KEY).then((s) => {
        const raw = s?.value;
        if (typeof raw === 'string') {
          try {
            const arr = JSON.parse(raw) as unknown;
            if (Array.isArray(arr) && arr.length > 0) setNavOrder(arr as string[]);
          } catch {
            // ignore
          }
        }
      });
    };
    window.addEventListener('navOrderUpdated', handler);
    return () => window.removeEventListener('navOrderUpdated', handler);
  }, []);

  const navPaths = useMemo(() => new Set(getAllNavPaths()), []);
  const showNav =
    navPaths.has(location.pathname) ||
    location.pathname.startsWith('/contacts/') ||
    location.pathname.startsWith('/schedules/') ||
    location.pathname.startsWith('/settings/');

  const navItems = useMemo(() => getNavItemsByIds(navOrder), [navOrder]);

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="app-header">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Bishopric App</h1>
        <Link to="/settings" className="text-white/90 font-medium text-sm min-h-tap py-2 px-3 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex items-center gap-1" aria-label="Settings"><SettingsIcon size={20} /></Link>
      </header>
      <main className="main-below-header flex-1 overflow-auto p-4 pb-24">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<ScheduleInterview />} />
          <Route path="/messages" element={<MessageCenter />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/templates" element={<TemplateEditor />} />
          <Route path="/hallway" element={<HallwayMode />} />
          <Route path="/schedules" element={<ScheduleTemplates />} />
          <Route path="/schedules/:id" element={<ScheduleTemplateDetail />} />
          <Route path="/tithing" element={<TithingDashboard />} />
          <Route path="/contacts" element={<ContactsManager />} />
          <Route path="/contacts/household/:id" element={<HouseholdDetail />} />
          <Route path="/contacts/person/:id" element={<PersonDetail />} />
          <Route path="/contacts/import" element={<ImportWardList />} />
          <Route path="/day" element={<DayView />} />
          <Route path="/appointment/:id" element={<AppointmentDetailPage />} />
          <Route path="/interviews-to-get" element={<InterviewsToGet />} />
          <Route path="/prayer" element={<PrayerDashboard />} />
          <Route path="/backup" element={<BackupRestore />} />
        </Routes>
      </main>
      {showNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 flex justify-around items-center bg-primary text-white shrink-0 shadow-[0_-1px_6px_rgba(0,0,0,0.08)]"
          style={{ paddingTop: '0.5rem', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {navItems.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1.5 px-2 min-h-tap justify-center font-medium text-[0.7rem] whitespace-nowrap no-underline rounded-lg transition-colors ${isActive ? 'text-white bg-white/20' : 'text-white/75 hover:text-white'}`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
      {showQueue && <QueueRunnerModal onClose={() => setShowQueue(false)} />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
