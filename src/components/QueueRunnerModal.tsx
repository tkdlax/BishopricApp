import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { db } from '../db/schema';
import { openSms, copyToClipboard } from '../lib/sms';
import type { MessageQueueItem } from '../db/schema';

const STORAGE_KEY_LAST_OPENED = 'queueLastOpenedId';

export function QueueRunnerModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<MessageQueueItem[]>([]);
  const [showSentConfirm, setShowSentConfirm] = useState(false);
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [showSkipReason, setShowSkipReason] = useState(false);
  const [lastSentId, setLastSentId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState(false);
  const [editText, setEditText] = useState('');

  const index = 0;
  const current = items[index];

  useEffect(() => {
    db.messageQueue.where('status').equals('pending').toArray().then(setItems);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY_LAST_OPENED);
    if (stored) setLastOpenedId(stored);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && lastOpenedId) {
        setShowSentConfirm(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lastOpenedId]);

  function handleOpenMessages() {
    if (!current) return;
    sessionStorage.setItem(STORAGE_KEY_LAST_OPENED, current.id);
    setLastOpenedId(current.id);
    const now = Date.now();
    db.messageQueue.update(current.id, { status: 'opened', openedAt: now, updatedAt: now });
    openSms(current.recipientPhone, current.renderedMessage);
  }

  function handleCopy() {
    if (!current) return;
    copyToClipboard(current.renderedMessage);
  }

  function startEdit() {
    if (!current) return;
    setEditText(current.renderedMessage);
    setEditingMessage(true);
  }

  function cancelEdit() {
    setEditingMessage(false);
    setEditText('');
  }

  async function saveEdit() {
    if (!current) return;
    const now = Date.now();
    await db.messageQueue.update(current.id, { renderedMessage: editText, updatedAt: now });
    setItems((prev) => prev.map((i) => (i.id === current.id ? { ...i, renderedMessage: editText, updatedAt: now } : i)));
    setEditingMessage(false);
    setEditText('');
  }

  function handleDone() {
    if (!current) return;
    const now = Date.now();
    setLastSentId(current.id);
    db.messageQueue.update(current.id, { status: 'sent', sentAt: now, updatedAt: now });
    sessionStorage.removeItem(STORAGE_KEY_LAST_OPENED);
    setLastOpenedId(null);
    setShowSentConfirm(false);
    setItems((prev) => prev.filter((i) => i.id !== current.id));
    if (items.length <= 1) onClose();
  }

  function handleSendAgain() {
    if (!current) return;
    setShowSentConfirm(false);
    handleOpenMessages();
  }

  function handleSkip() {
    if (!current) return;
    setShowSkipReason(true);
  }

  function confirmSkip() {
    if (!current) return;
    const now = Date.now();
    db.messageQueue.update(current.id, {
      status: 'skipped',
      skippedAt: now,
      skipReason: skipReason || 'Skipped',
      updatedAt: now,
    });
    setShowSkipReason(false);
    setSkipReason('');
    setItems((prev) => prev.filter((i) => i.id !== current.id));
    if (items.length <= 1) onClose();
  }

  function handleUndoLast() {
    if (!lastSentId) return;
    const now = Date.now();
    db.messageQueue.update(lastSentId, { status: 'pending', sentAt: undefined, updatedAt: now }).then(() => {
      db.messageQueue.where('status').equals('pending').toArray().then(setItems);
      setLastSentId(null);
    });
  }

  function renderContent() {
    const btnPrimary = 'bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap';
    const btnSecondary = 'border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap';
    const inputClass = 'border border-border rounded-lg px-3 py-2 w-full';
    const actionsClass = 'flex flex-wrap gap-2';

    if (items.length === 0 && !current) {
      return (
        <>
          <DialogTitle>Message queue</DialogTitle>
          <p className="text-sm text-muted">No pending messages.</p>
          <button type="button" onClick={onClose} className={btnSecondary + ' mt-4'}>Close</button>
        </>
      );
    }

    if (showSentConfirm && lastOpenedId === current?.id) {
      return (
        <>
          <DialogTitle>Was this message sent?</DialogTitle>
          <p className="text-sm text-muted">{current?.recipientPhone}</p>
          <div className={actionsClass + ' mt-4'}>
            <button type="button" onClick={handleDone} className={btnPrimary}>Done</button>
            <button type="button" onClick={handleSendAgain} className={btnSecondary}>Send again</button>
          </div>
        </>
      );
    }

    if (showSkipReason && current) {
      return (
        <>
          <DialogTitle>Skip reason</DialogTitle>
          <select className={inputClass + ' mt-2'} value={skipReason} onChange={(e) => setSkipReason(e.target.value)}>
            <option value="">Select…</option>
            <option value="no response">No response</option>
            <option value="wrong number">Wrong number</option>
            <option value="asked verbally">Asked verbally</option>
          </select>
          <div className={actionsClass + ' mt-4'}>
            <button type="button" onClick={confirmSkip} className={btnPrimary}>Skip</button>
            <button type="button" onClick={() => setShowSkipReason(false)} className={btnSecondary}>Cancel</button>
          </div>
        </>
      );
    }

    return (
      <>
        <DialogTitle>Message {index + 1} of {items.length}</DialogTitle>
        {current && (
          <>
            <p className="text-sm"><strong>To:</strong> {current.recipientPhone}</p>
            {editingMessage ? (
              <>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={5}
                  className="border border-border rounded-lg p-3 mt-2 w-full text-sm font-sans resize-y"
                  aria-label="Edit message"
                />
                <div className={actionsClass + ' mt-2'}>
                  <button type="button" onClick={saveEdit} className={btnPrimary}>Save</button>
                  <button type="button" onClick={cancelEdit} className={btnSecondary}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <pre className="text-sm bg-slate-50 border border-border rounded-lg p-3 mt-2 overflow-auto max-h-[200px] whitespace-pre-wrap font-sans">{current.renderedMessage}</pre>
                <div className={actionsClass + ' mt-4'}>
                  <button type="button" onClick={handleOpenMessages} className={btnPrimary}>Open Messages</button>
                  <button type="button" onClick={handleCopy} className={btnSecondary}>Copy message</button>
                  <button type="button" onClick={startEdit} className={btnSecondary}>Edit</button>
                  <button type="button" onClick={handleSkip} className={btnSecondary}>Skip</button>
                </div>
              </>
            )}
          </>
        )}
        <div className={actionsClass + ' mt-4'}>
          <button type="button" onClick={handleUndoLast} className={btnSecondary}>Undo last</button>
          <button type="button" onClick={onClose} className={btnSecondary}>Close</button>
        </div>
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
