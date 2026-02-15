import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { getBishopPerson } from '../lib/bishopForMessages';
import { BISHOP_PERSON_ID_KEY } from '../lib/bishopForMessages';
import { ALL_NAV_ITEMS, DEFAULT_NAV_ORDER, NAV_SETTINGS_KEY } from '../lib/navConfig';
import {
  INTERVIEW_SLOT_START_KEY,
  INTERVIEW_SLOT_END_KEY,
  INTERVIEW_SLOT_INTERVAL_KEY,
  EXCLUDE_OCCUPIED_SLOTS_KEY,
  minutesToTime,
} from '../lib/scheduling';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { PageLayout, Section } from '../components/ui';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Person } from '../db/schema';

function minutesFromTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s ?? '0', 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

const cardClass = 'card p-4';

const DEFAULT_SLOT_START = '14:00';
const DEFAULT_SLOT_END = '16:00';
const DEFAULT_SLOT_INTERVAL = 20;

export function Settings() {
  const [bishopPerson, setBishopPerson] = useState<Person | null>(null);
  const [showBishopPicker, setShowBishopPicker] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(DEFAULT_NAV_ORDER);
  const [slotStart, setSlotStart] = useState(DEFAULT_SLOT_START);
  const [slotEnd, setSlotEnd] = useState(DEFAULT_SLOT_END);
  const [slotInterval, setSlotInterval] = useState(DEFAULT_SLOT_INTERVAL);
  const [excludeOccupiedSlots, setExcludeOccupiedSlots] = useState(true);

  useEffect(() => {
    getBishopPerson().then(setBishopPerson);
  }, []);

  useEffect(() => {
    Promise.all([
      db.settings.get(INTERVIEW_SLOT_START_KEY),
      db.settings.get(INTERVIEW_SLOT_END_KEY),
      db.settings.get(INTERVIEW_SLOT_INTERVAL_KEY),
      db.settings.get(EXCLUDE_OCCUPIED_SLOTS_KEY),
    ]).then(([s, e, i, ex]) => {
      if (typeof s?.value === 'number') setSlotStart(minutesToTime(s.value));
      if (typeof e?.value === 'number') setSlotEnd(minutesToTime(e.value));
      if (typeof i?.value === 'number') setSlotInterval(i.value);
      setExcludeOccupiedSlots(typeof ex?.value === 'boolean' ? ex.value : true);
    });
  }, []);

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

  function saveNavOrder(order: string[]) {
    const now = Date.now();
    db.settings.put({ id: NAV_SETTINGS_KEY, value: JSON.stringify(order), updatedAt: now });
    setNavOrder(order);
    window.dispatchEvent(new CustomEvent('navOrderUpdated'));
  }

  function navMoveUp(i: number) {
    if (i <= 0) return;
    const next = [...navOrder];
    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    saveNavOrder(next);
  }

  function navMoveDown(i: number) {
    if (i >= navOrder.length - 1) return;
    const next = [...navOrder];
    [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
    saveNavOrder(next);
  }

  function navRemove(i: number) {
    saveNavOrder(navOrder.filter((_, idx) => idx !== i));
  }

  function navAdd(id: string) {
    if (navOrder.includes(id)) return;
    saveNavOrder([...navOrder, id]);
  }

  const navAvailableToAdd = ALL_NAV_ITEMS.filter((item) => !navOrder.includes(item.id));

  async function setBishop(p: Person | null) {
    const now = Date.now();
    if (p) {
      await db.settings.put({ id: BISHOP_PERSON_ID_KEY, value: p.id, updatedAt: now });
      setBishopPerson(p);
    } else {
      await db.settings.delete(BISHOP_PERSON_ID_KEY);
      setBishopPerson(null);
    }
    setShowBishopPicker(false);
  }

  async function saveSlotWindow() {
    const now = Date.now();
    await Promise.all([
      db.settings.put({ id: INTERVIEW_SLOT_START_KEY, value: minutesFromTime(slotStart), updatedAt: now }),
      db.settings.put({ id: INTERVIEW_SLOT_END_KEY, value: minutesFromTime(slotEnd), updatedAt: now }),
      db.settings.put({ id: INTERVIEW_SLOT_INTERVAL_KEY, value: slotInterval, updatedAt: now }),
    ]);
  }

  return (
    <PageLayout back="auto" title="Settings">
      <Section heading="Bishop (for messages)">
        <div className={cardClass}>
          <p className="text-sm text-muted mb-2">Used in reach-out messages: &quot;on behalf of bishop [last name]&quot;. For &quot;Send day to Bishop&quot; via WhatsApp, include country code on the bishop&apos;s contact phone (e.g. 1 for US).</p>
          <p className="mb-2">Bishop: {bishopPerson ? bishopPerson.nameListPreferred : 'Not set'}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowBishopPicker(true)} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap">
              {bishopPerson ? 'Change bishop' : 'Select bishop'}
            </button>
            {bishopPerson && (
              <button type="button" onClick={() => setBishop(null)} className="border border-border rounded-lg px-4 py-2.5 min-h-tap">Clear</button>
            )}
          </div>
        </div>
      </Section>
      <Section heading="Message templates">
        <div className={cardClass}>
          <p className="text-sm text-muted mb-2">Edit default text for queue messages and insert tokens (e.g. name, date, time). You can also edit any message in the queue before sending.</p>
          <Link to="/settings/templates" className="text-primary font-semibold min-h-tap inline-block">Edit templates</Link>
        </div>
      </Section>
      <Section heading="Interview slot window">
        <p className="text-sm text-muted mb-2">Used by Hallway and Day view for available slots. Start/end in 24-hour time.</p>
        <div className={cardClass}>
          <div className="grid gap-3 mb-4">
            <label className="block">
              <span className="text-sm font-medium text-muted block mb-1">Start time</span>
              <input
                type="time"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="border border-border rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-muted block mb-1">End time</span>
              <input
                type="time"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="border border-border rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-muted block mb-1">Interval (minutes)</span>
              <input
                type="number"
                min={5}
                max={60}
                value={slotInterval}
                onChange={(e) => setSlotInterval(parseInt(e.target.value, 10) || DEFAULT_SLOT_INTERVAL)}
                className="border border-border rounded-xl px-3 py-2.5 w-full max-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>
            <label className="flex items-center gap-3 py-2 min-h-tap cursor-pointer">
              <input
                type="checkbox"
                checked={excludeOccupiedSlots}
                onChange={(e) => {
                  const v = e.target.checked;
                  setExcludeOccupiedSlots(v);
                  const now = Date.now();
                  db.settings.put({ id: EXCLUDE_OCCUPIED_SLOTS_KEY, value: v, updatedAt: now });
                }}
                className="rounded border-border text-primary focus:ring-primary/40 w-5 h-5"
              />
              <span className="text-slate-700">Don&apos;t suggest times that are already used (recurring/custom events)</span>
            </label>
          </div>
          <button type="button" onClick={saveSlotWindow} className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold min-h-tap hover:opacity-95 active:opacity-90 transition-opacity">
            Save slot window
          </button>
        </div>
      </Section>
      <Section heading="Bottom menu">
        <p className="text-sm text-muted mb-2">Choose which items appear in the bottom nav and their order.</p>
        <div className={cardClass}>
          <ul className="list-none p-0 m-0">
            {navOrder.map((id, i) => {
              const item = ALL_NAV_ITEMS.find((n) => n.id === id);
              if (!item) return null;
              const { Icon, label } = item;
              return (
                <li key={id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <Icon size={20} className="shrink-0 text-muted" />
                  <span className="flex-1 font-medium">{label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => navMoveUp(i)} aria-label="Move up" disabled={i === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronUp size={18} /></button>
                    <button type="button" onClick={() => navMoveDown(i)} aria-label="Move down" disabled={i === navOrder.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronDown size={18} /></button>
                    <button type="button" onClick={() => navRemove(i)} className="text-sm text-primary font-medium" aria-label="Remove from menu">Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {navAvailableToAdd.length > 0 && (
            <>
              <p className="text-sm text-muted mt-3 mb-2">Add to menu:</p>
              <div className="flex flex-wrap gap-2">
                {navAvailableToAdd.map((item) => (
                  <button key={item.id} type="button" onClick={() => navAdd(item.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white hover:bg-slate-50 text-sm font-medium">
                    <item.Icon size={18} /> {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Section>
      <Section heading="">
        <Link to="/" className="text-primary font-medium min-h-tap">Back to Dashboard</Link>
      </Section>
      {showBishopPicker && (
        <PeoplePickerModal
          onSelect={(p) => setBishop(p)}
          onClose={() => setShowBishopPicker(false)}
        />
      )}
    </PageLayout>
  );
}
