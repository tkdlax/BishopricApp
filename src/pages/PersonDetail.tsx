import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout } from '../components/ui';
import { normalizeName } from '../lib/nameUtils';
import type { Person as PersonType, Household, PrayerHistoryRecord } from '../db/schema';
import { User, Phone, Mail, Home, Calendar, Edit2, BookOpen } from 'lucide-react';

export function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<PersonType | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [nameList, setNameList] = useState('');
  const [nameGiven, setNameGiven] = useState('');
  const [nameFamily, setNameFamily] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [phones, setPhones] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [doNotInterview, setDoNotInterview] = useState(false);
  const [doNotAskForPrayer, setDoNotAskForPrayer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prayerHistory, setPrayerHistory] = useState<PrayerHistoryRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    db.people.get(id).then((p) => {
      setPerson(p ?? null);
      if (p) {
        setNameList(p.nameListPreferred ?? '');
        setNameGiven(p.nameGiven ?? '');
        setNameFamily(p.nameFamily ?? '');
        setBirthDate(p.birthDate ?? '');
        setGender(p.gender ?? '');
        setPhones((p.phones ?? []).join(', '));
        setEmail(p.email ?? '');
        setNotes(p.notes ?? '');
        setDoNotInterview(!!p.doNotInterview);
        setDoNotAskForPrayer(!!p.doNotAskForPrayer);
        db.households.get(p.householdId).then((h) => setHousehold(h ?? null));
        db.prayerHistory.where('personId').equals(p.id).toArray().then((list) => {
          setPrayerHistory(list.sort((a, b) => (b.localDate > a.localDate ? 1 : b.localDate < a.localDate ? -1 : 0)));
        });
      }
    });
  }, [id]);

  const handleSave = async () => {
    if (!person) return;
    setSaving(true);
    const now = Date.now();
    const listName = nameList.trim() || 'Unnamed';
    const normalized = normalizeName(listName);
    await db.people.update(person.id, {
      nameListPreferred: listName,
      nameGiven: nameGiven.trim() || undefined,
      nameFamily: nameFamily.trim() || undefined,
      normalizedName: normalized,
      birthDate: birthDate.trim() || undefined,
      gender: gender || undefined,
      phones: phones.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      doNotInterview,
      doNotAskForPrayer,
      updatedAt: now,
    });
    setPerson((prev) => prev ? { ...prev, nameListPreferred: listName, normalizedName: normalized, updatedAt: now } : null);
    setSaving(false);
  };

  if (!person) {
    return (
      <PageLayout back="auto" title="Contact">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout back="auto" title="Contact">
      {/* Name hero */}
      <div className="card border-l-4 border-l-accent overflow-hidden mb-6">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <User size={26} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">Preferred name</label>
              <input
                type="text"
                value={nameList}
                onChange={(e) => setNameList(e.target.value)}
                placeholder="Name as shown in lists"
                className="text-xl font-bold text-slate-900 border-0 border-b-2 border-transparent focus:border-accent focus:outline-none bg-transparent w-full py-1"
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted">
                <input type="text" value={nameGiven} onChange={(e) => setNameGiven(e.target.value)} placeholder="First" className="w-24 border-0 border-b border-border focus:border-accent focus:outline-none bg-transparent py-0.5" />
                <input type="text" value={nameFamily} onChange={(e) => setNameFamily(e.target.value)} placeholder="Last" className="w-28 border-0 border-b border-border focus:border-accent focus:outline-none bg-transparent py-0.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prayer in sacrament */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium mb-3">
          <BookOpen size={18} className="text-accent shrink-0" />
          Prayer in sacrament
        </div>
        {prayerHistory.length === 0 ? (
          <p className="text-muted text-sm">No sacrament prayer recorded.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-slate-700 text-sm font-medium">Last prayer: {prayerHistory[0]!.localDate.replace(/-/g, '/')} ({prayerHistory[0]!.prayerType === 'opening' ? 'Opening' : 'Closing'})</p>
            {prayerHistory.length > 1 && (
              <ul className="list-none p-0 m-0 text-muted text-sm">
                {prayerHistory.slice(1, 11).map((r) => (
                  <li key={r.id}>{r.localDate.replace(/-/g, '/')} – {r.prayerType === 'opening' ? 'Opening' : 'Closing'}</li>
                ))}
                {prayerHistory.length > 11 && <li>…and {prayerHistory.length - 11} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium mb-3">
          <Phone size={18} className="text-accent shrink-0" />
          Contact
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted block mb-1">Phone(s)</span>
            <input
              type="text"
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              placeholder="Comma-separated"
              className="border border-border rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted block mb-1">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="border border-border rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </label>
        </div>
      </div>

      {/* Personal */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium mb-3">
          <Calendar size={18} className="text-accent shrink-0" />
          Personal
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted block mb-1">Birth date</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="border border-border rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted block mb-1">Gender</span>
            <select
              value={gender}
              onChange={(e) => setGender((e.target.value || '') as 'male' | 'female' | '')}
              className="border border-border rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>
      </div>

      {/* Household */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium mb-2">
          <Home size={18} className="text-accent shrink-0" />
          Household
        </div>
        <p className="text-slate-600 text-sm">{household?.addressFormatted || 'No address'}</p>
        <Link to={`/contacts/household/${person.householdId}`} className="inline-flex items-center gap-1.5 mt-2 text-accent font-medium text-sm min-h-tap">
          <Edit2 size={16} />
          Edit household
        </Link>
      </div>

      {/* Notes */}
      <div className="card p-4 mb-4">
        <label className="block">
          <span className="flex items-center gap-2 text-muted text-sm font-medium mb-2">
            <Mail size={18} className="text-accent shrink-0" />
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes about this contact…"
            className="border border-border rounded-xl px-3 py-2.5 w-full min-h-[88px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-y"
            rows={3}
          />
        </label>
      </div>

      {/* Preferences */}
      <div className="card p-4 mb-6">
        <p className="text-muted text-sm font-medium mb-3">Preferences</p>
        <label className="flex items-center gap-3 py-2 min-h-tap cursor-pointer">
          <input type="checkbox" checked={doNotInterview} onChange={(e) => setDoNotInterview(e.target.checked)} className="rounded border-border text-accent focus:ring-accent/40 w-5 h-5" />
          <span className="text-slate-700">Do not include in interview suggestions</span>
        </label>
        <label className="flex items-center gap-3 py-2 min-h-tap cursor-pointer">
          <input type="checkbox" checked={doNotAskForPrayer} onChange={(e) => setDoNotAskForPrayer(e.target.checked)} className="rounded border-border text-accent focus:ring-accent/40 w-5 h-5" />
          <span className="text-slate-700">Do not ask for prayer</span>
        </label>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-accent w-full max-w-[200px] flex items-center justify-center gap-2"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </PageLayout>
  );
}
