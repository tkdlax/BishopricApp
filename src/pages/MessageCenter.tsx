import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import type { MessageQueueItem } from '../db/schema';

const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4';

export function MessageCenter() {
  const [pending, setPending] = useState<MessageQueueItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const load = () => db.messageQueue.where('status').equals('pending').toArray().then(setPending);
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
    <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Message Center">
      <Section heading="Pending messages">
        <p className="text-sm text-muted mb-3">Edit any message below before sending. Use the queue runner to open Messages and send.</p>
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
      <Section heading="">
        <Link to="/" className="text-primary font-medium min-h-tap inline-block">Back to Dashboard</Link>
      </Section>
    </PageLayout>
  );
}
