import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { QueueRunnerModal } from '../components/QueueRunnerModal';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { getHouseholdMembersWithPhones } from '../lib/contactRecipient';
import type { MessageQueueItem } from '../db/schema';
import type { Person } from '../db/schema';
import { Play, Plus } from 'lucide-react';

const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4';

export function MessageCenter() {
  const [pending, setPending] = useState<MessageQueueItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showRunner, setShowRunner] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customRecipient, setCustomRecipient] = useState<Person | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [householdPickList, setHouseholdPickList] = useState<Person[]>([]);

  const load = () => db.messageQueue.where('status').equals('pending').toArray().then(setPending);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener('focus', onUpdate);
    return () => window.removeEventListener('focus', onUpdate);
  }, []);

  function startEdit(item: MessageQueueItem) {
    setEditingId(item.id);
    setEditText(item.renderedMessage);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit() {
    if (!editingId) return;
    const now = Date.now();
    await db.messageQueue.update(editingId, { renderedMessage: editText, updatedAt: now });
    setPending((prev) => prev.map((i) => (i.id === editingId ? { ...i, renderedMessage: editText, updatedAt: now } : i)));
    setEditingId(null);
    setEditText('');
  }

  return (
    <PageLayout back="auto" title="Message Center">
      <Section heading="Pending messages">
        <p className="text-sm text-muted mb-3">Edit any message below, then run the queue to open your messaging app and send.</p>
        {pending.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRunner(true)}
            className="btn-accent flex items-center justify-center gap-2 w-full mb-4"
          >
            <Play size={20} />
            Run queue ({pending.length})
          </button>
        )}
        {pending.length === 0 ? (
          <p className="text-muted text-sm">No pending messages.</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-3">
            {pending.map((item) => (
              <li key={item.id} className={cardClass}>
                <p className="text-sm text-muted mb-1">To: {item.recipientPhone}</p>
                {editingId === item.id ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="border border-border rounded-lg px-3 py-2 w-full text-sm font-sans resize-y"
                      aria-label="Message text"
                    />
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={saveEdit} className="bg-primary text-white px-3 py-2 rounded-lg font-medium text-sm min-h-tap">Save</button>
                      <button type="button" onClick={cancelEdit} className="border border-border rounded-lg px-3 py-2 text-sm min-h-tap">Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <pre className="text-sm whitespace-pre-wrap font-sans bg-slate-50 border border-border rounded p-2 max-h-32 overflow-auto">{item.renderedMessage}</pre>
                    <button type="button" onClick={() => startEdit(item)} className="text-primary font-medium text-sm min-h-tap mt-2">Edit message</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section heading="Add custom message">
        <p className="text-sm text-muted mb-3">Pick any contact, type your message, and add it to the queue. Send when you run the queue.</p>
        {!showAddCustom ? (
          <button type="button" onClick={() => setShowAddCustom(true)} className="flex items-center gap-2 text-primary font-medium min-h-tap">
            <Plus size={20} /> Compose and add to queue
          </button>
        ) : (
          <div className={cardClass}>
            <p className="text-sm font-medium text-muted mb-2">Recipient</p>
            {customRecipient ? (
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-medium">{customRecipient.nameListPreferred}</span>
                <button type="button" onClick={() => setCustomRecipient(null)} className="text-muted text-sm">Change</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowRecipientPicker(true)} className="border border-border rounded-lg px-3 py-2 w-full text-left text-muted">Pick contact</button>
            )}
            <label className="block mt-3">
              <span className="text-sm font-medium text-muted block mb-1">Message</span>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Type your message…"
                rows={4}
                className="border border-border rounded-lg px-3 py-2 w-full text-sm resize-y"
              />
            </label>
            {householdPickList.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-muted mb-2">Send to which number?</p>
                <ul className="list-none p-0 m-0 space-y-1">
                  {householdPickList.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          const phone = p.phones?.[0];
                          if (!phone) return;
                          const now = Date.now();
                          await db.messageQueue.add({
                            id: `msg-${now}-${Math.random().toString(36).slice(2, 9)}`,
                            recipientPhone: phone,
                            renderedMessage: customMessage.trim() || '(No message)',
                            status: 'pending',
                            createdAt: now,
                            updatedAt: now,
                          });
                          setCustomRecipient(null);
                          setCustomMessage('');
                          setShowAddCustom(false);
                          setHouseholdPickList([]);
                          load();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border bg-white hover:bg-slate-50"
                      >
                        {p.nameListPreferred} {p.phones?.[0]}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setHouseholdPickList([])} className="text-muted text-sm mt-2">Cancel</button>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={!customRecipient || householdPickList.length > 0}
                onClick={async () => {
                  if (!customRecipient) return;
                  const members = await getHouseholdMembersWithPhones(customRecipient);
                  if (members.length === 0) {
                    alert('No one in this household has a phone number saved.');
                    return;
                  }
                  if (members.length > 1) {
                    setHouseholdPickList(members);
                    return;
                  }
                  const p = members[0]!;
                  const phone = p.phones?.[0];
                  if (!phone) return;
                  const now = Date.now();
                  await db.messageQueue.add({
                    id: `msg-${now}-${Math.random().toString(36).slice(2, 9)}`,
                    recipientPhone: phone,
                    renderedMessage: customMessage.trim() || '(No message)',
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now,
                  });
                  setCustomRecipient(null);
                  setCustomMessage('');
                  setShowAddCustom(false);
                  load();
                }}
                className="btn-accent px-4 py-2"
              >
                Add to queue
              </button>
              <button type="button" onClick={() => { setShowAddCustom(false); setCustomRecipient(null); setCustomMessage(''); setHouseholdPickList([]); }} className="border border-border rounded-lg px-4 py-2">Cancel</button>
            </div>
          </div>
        )}
      </Section>

      <Section heading="">
        <Link to="/" className="text-primary font-medium min-h-tap inline-block">Back to Dashboard</Link>
      </Section>

      {showRunner && <QueueRunnerModal onClose={() => { setShowRunner(false); load(); }} />}

      {showRecipientPicker && (
        <PeoplePickerModal
          onSelect={(p) => { setCustomRecipient(p); setShowRecipientPicker(false); }}
          onClose={() => setShowRecipientPicker(false)}
          filter={() => true}
        />
      )}
    </PageLayout>
  );
}
