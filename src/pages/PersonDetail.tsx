import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { normalizeName } from '../lib/nameUtils';
import type { Person as PersonType, Household } from '../db/schema';

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
      <PageLayout back={{ to: '/contacts', label: 'Contacts' }} title="Person">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout back={{ to: '/contacts', label: 'Contacts' }} title="Person">
      <Section heading="Preferred name (list)">
        <input
          type="text"
          value={nameList}
          onChange={(e) => setNameList(e.target.value)}
          placeholder="Name as shown in lists"
          className="border border-border rounded-lg px-3 py-2 w-full"
        />
      </Section>
      <Section heading="Given name">
        <input
          type="text"
          value={nameGiven}
          onChange={(e) => setNameGiven(e.target.value)}
          placeholder="First name"
          className="border border-border rounded-lg px-3 py-2 w-full"
        />
      </Section>
      <Section heading="Family name">
        <input
          type="text"
          value={nameFamily}
          onChange={(e) => setNameFamily(e.target.value)}
          placeholder="Last name"
          className="border border-border rounded-lg px-3 py-2 w-full"
        />
      </Section>
      <Section heading="Address">
        <p className="text-muted text-sm">
          {household?.addressFormatted || 'No address.'}{' '}
          <Link to={`/contacts/household/${person.householdId}`} className="text-primary font-medium">
            Edit household
          </Link>
        </p>
      </Section>
      <Section heading="Birth date">
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 w-full max-w-xs"
        />
      </Section>
      <Section heading="Gender">
        <select
          value={gender}
          onChange={(e) => setGender((e.target.value || '') as 'male' | 'female' | '')}
          className="border border-border rounded-lg px-3 py-2 w-full max-w-xs"
        >
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </Section>
      <Section heading="Phones">
        <input
          type="text"
          value={phones}
          onChange={(e) => setPhones(e.target.value)}
          placeholder="Comma-separated"
          className="border border-border rounded-lg px-3 py-2 w-full"
        />
      </Section>
      <Section heading="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="border border-border rounded-lg px-3 py-2 w-full"
        />
      </Section>
      <Section heading="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="border border-border rounded-lg px-3 py-2 w-full min-h-[80px]"
          rows={3}
        />
      </Section>
      <Section heading="Options">
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={doNotInterview} onChange={(e) => setDoNotInterview(e.target.checked)} />
          <span>Do not include in interview suggestions</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={doNotAskForPrayer} onChange={(e) => setDoNotAskForPrayer(e.target.checked)} />
          <span>Do not ask for prayer</span>
        </label>
      </Section>
      <div className="mb-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white rounded-lg px-4 py-2 font-medium min-h-tap disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </PageLayout>
  );
}
