import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { getHouseholdMembersWithPhones } from '../lib/contactRecipient';
import type { Person } from '../db/schema';

/**
 * Shown when scheduling an interview for someone under 18 and a text is being added to the queue.
 * Lets the user choose which household member's number to send the confirmation to.
 */
export function RecipientPickerModal({
  person,
  onSelect,
  onClose,
}: {
  person: Person;
  onSelect: (phone: string | null) => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHouseholdMembersWithPhones(person).then((list) => {
      setMembers(list);
      setLoading(false);
    });
  }, [person]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle>Send confirmation text to</DialogTitle>
        <p className="text-sm text-muted mb-3">
          Choose which household number should receive the interview confirmation for {person.nameListPreferred}.
        </p>
        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-muted text-sm mb-3">No phone numbers in this household.</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2 mb-4">
            {members.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(p.phones?.[0] ?? null); onClose(); }}
                  className="w-full text-left py-2.5 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 min-h-tap font-medium flex flex-col gap-0.5"
                >
                  <span>{p.nameListPreferred}</span>
                  {p.phones?.[0] && <span className="text-muted text-sm font-normal">{p.phones[0]}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onSelect(null); onClose(); }}
            className="flex-1 border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap hover:bg-slate-50"
          >
            Don&apos;t add to queue
          </button>
          <button type="button" onClick={() => { onSelect(null); onClose(); }} className="border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
