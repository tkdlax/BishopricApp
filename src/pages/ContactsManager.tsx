import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { normalizeName } from '../lib/nameUtils';
import { Plus, ChevronRight, Users, User, Search } from 'lucide-react';

type ViewMode = 'everyone' | 'household';

export function ContactsManager() {
  const [mode, setMode] = useState<ViewMode>('everyone');
  const [households, setHouseholds] = useState<{ id: string; name: string; count: number }[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string; householdId: string; householdName: string }[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [hList, pList] = await Promise.all([
        db.households.toArray(),
        db.people.toArray(),
      ]);
      const countByHousehold: Record<string, number> = {};
      pList.forEach((p) => {
        countByHousehold[p.householdId] = (countByHousehold[p.householdId] ?? 0) + 1;
      });
      setHouseholds(
        hList.map((h) => ({ id: h.id, name: h.name, count: countByHousehold[h.id] ?? 0 }))
      );
      const hByName = new Map(hList.map((h) => [h.id, h.name]));
      setPeople(
        pList.map((p) => ({
          id: p.id,
          name: p.nameListPreferred,
          householdId: p.householdId,
          householdName: hByName.get(p.householdId) ?? '—',
        }))
      );
    })();
  }, []);

  const q = normalizeName(search);
  const filteredHouseholds = useMemo(
    () => (q ? households.filter((h) => normalizeName(h.name).includes(q)) : households),
    [households, q]
  );
  const filteredPeople = useMemo(
    () =>
      q
        ? people.filter(
            (p) =>
              normalizeName(p.name).includes(q) ||
              normalizeName(p.householdName).includes(q)
          )
        : people,
    [people, q]
  );

  const peopleByLetter = useMemo(() => {
    const map: Record<string, typeof filteredPeople> = {};
    const sorted = [...filteredPeople].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    for (const p of sorted) {
      const letter = (p.name[0] ?? '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [filteredPeople]);
  const letters = useMemo(() => Object.keys(peopleByLetter).sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))), [peopleByLetter]);

  return (
    <PageLayout back="auto" title="Contacts">
      <div className="mb-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or household"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            aria-label="Search"
          />
        </div>
      </div>

      <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
        <button
          type="button"
          onClick={() => setMode('everyone')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm min-h-tap transition-all ${
            mode === 'everyone' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          Everyone
        </button>
        <button
          type="button"
          onClick={() => setMode('household')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm min-h-tap transition-all ${
            mode === 'household' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          Household
        </button>
      </div>

      {mode === 'household' ? (
        <Section heading="">
          <div className="card">
            <ul className="list-none p-0 m-0">
              {filteredHouseholds.map((h) => (
                <li key={h.id}>
                  <Link
                    to={`/contacts/household/${h.id}`}
                    className="card-row flex items-center gap-3 no-underline text-inherit"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users size={20} className="text-primary" />
                    </div>
                    <span className="flex-1 font-medium min-w-0 truncate">{h.name}</span>
                    <span className="text-muted text-sm shrink-0">{h.count} member{h.count !== 1 ? 's' : ''}</span>
                    <ChevronRight size={18} className="text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
            {filteredHouseholds.length === 0 && (
              <div className="p-6 text-center text-muted text-sm">No households found.</div>
            )}
          </div>
          <Link
            to="/contacts/household/new"
            className="inline-flex items-center gap-2 mt-4 text-primary font-semibold min-h-tap py-2"
          >
            <Plus size={20} /> Add household
          </Link>
        </Section>
      ) : (
        <Section heading="">
          {letters.length === 0 ? (
            <div className="card p-6 text-center text-muted text-sm">No people found.</div>
          ) : (
            <div className="relative">
              <div className="card contacts-list-scroll pr-10">
                {letters.map((letter) => (
                  <div key={letter} id={`letter-${letter}`}>
                    <div className="px-4 py-2 bg-slate-50 text-muted text-xs font-bold uppercase tracking-wider sticky top-0 z-10">
                      {letter}
                    </div>
                    <ul className="list-none p-0 m-0">
                      {peopleByLetter[letter].map((p) => (
                        <li key={p.id}>
                          <Link
                            to={`/contacts/person/${p.id}`}
                            className="card-row flex items-center gap-3 no-underline text-inherit"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User size={20} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate">{p.name}</span>
                              <span className="text-muted text-sm truncate block">{p.householdName}</span>
                            </div>
                            <ChevronRight size={18} className="text-muted shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div
                className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0 py-1 z-20 pointer-events-auto"
                aria-label="Jump to letter"
              >
                {letters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => document.getElementById(`letter-${letter}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
                    className="text-[10px] font-bold text-primary min-h-tap min-w-[20px] flex items-center justify-center rounded hover:bg-primary/10 active:bg-primary/20"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-muted text-sm mt-4">Add people from a household (open household → Add member).</p>
        </Section>
      )}
    </PageLayout>
  );
}
