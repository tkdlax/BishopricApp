import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { User, Plus, ChevronRight } from 'lucide-react';
import type { Household } from '../db/schema';

export function HouseholdDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [excludeFromTithingDeclaration, setExcludeFromTithingDeclaration] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setName('');
      setAddress('');
      setMembers([]);
      setHousehold(null);
      return;
    }
    if (!id) return;
    db.households.get(id).then((h) => {
      setHousehold(h ?? null);
      if (h) {
        setName(h.name);
        setAddress(h.addressFormatted ?? '');
        setExcludeFromTithingDeclaration(!!h.excludeFromTithingDeclaration);
      }
    });
    db.people.where('householdId').equals(id).toArray().then((list) => {
      setMembers(list.map((p) => ({ id: p.id, name: p.nameListPreferred })));
    });
  }, [id, isNew]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const now = Date.now();
    if (isNew) {
      const newId = `hh-${now}-${Math.random().toString(36).slice(2, 9)}`;
      await db.households.add({
        id: newId,
        name: name.trim(),
        addressFormatted: address.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      setSaving(false);
      navigate(`/contacts/household/${newId}`, { replace: true });
      setHousehold({ id: newId, name: name.trim(), addressFormatted: address.trim() || undefined, createdAt: now, updatedAt: now } as Household);
      return;
    }
    if (!household) {
      setSaving(false);
      return;
    }
    await db.households.update(household.id, {
      name: name.trim(),
      addressFormatted: address.trim() || undefined,
      excludeFromTithingDeclaration,
      updatedAt: now,
    });
    setHousehold((prev) => prev ? { ...prev, name: name.trim(), addressFormatted: address.trim() || undefined, excludeFromTithingDeclaration, updatedAt: now } : null);
    setSaving(false);
  };

  const handleAddMember = async () => {
    if (!id || id === 'new') return;
    const now = Date.now();
    const newId = `person-${now}-${Math.random().toString(36).slice(2, 9)}`;
    await db.people.add({
      id: newId,
      householdId: id,
      nameListPreferred: 'New member',
      normalizedName: 'new member',
      householdRole: 'OTHER',
      role: 'adult',
      phones: [],
      eligibleForInterview: true,
      eligibleForPrayer: true,
      createdAt: now,
      updatedAt: now,
    });
    navigate(`/contacts/person/${newId}`);
  };

  if (!isNew && id && !household && members.length === 0) {
    return (
      <PageLayout back="auto" title="Household">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout back="auto" title={isNew ? 'New household' : 'Household'}>
      <Section heading="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Household name"
          className="border border-border rounded-lg px-3 py-2 w-full"
        />
      </Section>
      <Section heading="Address">
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, city, state"
          className="border border-border rounded-lg px-3 py-2 w-full min-h-[80px]"
          rows={3}
        />
      </Section>
      {!isNew && (
        <Section heading="Tithing declaration">
          <label className="flex items-center gap-3 py-2 min-h-tap cursor-pointer">
            <input
              type="checkbox"
              checked={excludeFromTithingDeclaration}
              onChange={(e) => setExcludeFromTithingDeclaration(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary/40 w-5 h-5"
            />
            <span className="text-slate-700">Exclude from tithing declaration (e.g. will never attend)</span>
          </label>
        </Section>
      )}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-primary text-white rounded-lg px-4 py-2 font-medium min-h-tap disabled:opacity-50"
        >
          {isNew ? 'Create' : 'Save'}
        </button>
      </div>

      {!isNew && id && (
        <Section heading="Members">
          <ul className="list-none p-0 m-0 space-y-1">
            {members.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/contacts/person/${p.id}`}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-white min-h-tap no-underline text-inherit hover:bg-slate-50"
                >
                  <User size={20} className="text-muted shrink-0" />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <ChevronRight size={18} className="text-muted shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleAddMember}
            className="inline-flex items-center gap-2 mt-2 text-primary font-medium min-h-tap"
          >
            <Plus size={18} /> Add member
          </button>
        </Section>
      )}
    </PageLayout>
  );
}
