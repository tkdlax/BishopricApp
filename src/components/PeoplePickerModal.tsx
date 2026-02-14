import { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import type { Person } from '../db/schema';

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function PeoplePickerModal({
  onSelect,
  onClose,
  filter,
  extraContent,
}: {
  onSelect: (person: Person) => void;
  onClose: () => void;
  /** Optional: only show people for whom filter(person) is true. Default: !inactive */
  filter?: (p: Person) => boolean;
  /** Optional: render above the search (e.g. queue checkbox). Not auto-focused. */
  extraContent?: React.ReactNode;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    db.people.toArray().then((list) => {
      const f = filter ?? ((p: Person) => !p.inactive);
      setPeople(list.filter(f));
    });
  }, [filter]);

  const q = normalizeSearch(search);
  const filtered = q
    ? people.filter((p) => p.normalizedName.includes(q))
    : people;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle>Select person</DialogTitle>
        {extraContent && <div className="mb-4">{extraContent}</div>}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="border border-border rounded-lg px-3 py-2 w-full mb-3"
          aria-label="Search"
          autoFocus={false}
        />
        <ul className="list-none p-0 m-0 max-h-[60vh] overflow-auto space-y-1">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                className="w-full text-left py-2 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 min-h-tap font-medium"
              >
                {p.nameListPreferred}
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="text-muted text-sm py-2">No one found.</p>}
      </DialogContent>
    </Dialog>
  );
}
