import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../db/schema';
import { seedDefaultScheduleTemplate } from '../lib/scheduleSeed';
import { formatTimeAmPm, todayLocalDate } from '../lib/scheduling';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { PageLayout, Section, ListRow, Dialog, DialogContent, DialogTitle } from '../components/ui';
import { ClipboardList, ChevronRight } from 'lucide-react';
import type { ScheduleTemplate, RecurringScheduleItem, ScheduleItemException, Person } from '../db/schema';

const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4';
const labelClass = 'block text-sm font-medium text-muted mb-1';
const inputClass = 'border border-border rounded-lg px-3 py-2 w-full';

const WEEK_LABELS: Record<number, string> = {
  0: 'Every Sunday',
  1: '1st Sunday',
  2: '2nd Sunday',
  3: '3rd Sunday',
  4: '4th Sunday',
  5: '5th Sunday',
};

export function ScheduleTemplates() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await seedDefaultScheduleTemplate();
      const list = await db.scheduleTemplates.toArray();
      setTemplates(list);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <PageLayout title="Schedule templates">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout back="auto" title="Schedule templates">
      <Section heading="Templates">
        <p className="text-sm text-muted mb-4">Recurring Sunday meeting schedules. Edit items, set reminders, or remove an item from a specific day.</p>
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {templates.map((t) => (
            <li key={t.id}>
              <ListRow
                to={`/schedules/${t.id}`}
                avatar={<ClipboardList size={20} />}
                primary={t.name}
                trailing={<ChevronRight size={18} />}
              />
            </li>
          ))}
        </ul>
      </Section>
    </PageLayout>
  );
}

export function ScheduleTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<ScheduleTemplate | null>(null);
  const [items, setItems] = useState<RecurringScheduleItem[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleItemException[]>([]);
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>({});
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddException, setShowAddException] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    db.scheduleTemplates.get(id).then((t) => setTemplate(t ?? null));
    db.recurringScheduleItems.where('templateId').equals(id).sortBy('order').then(setItems);
    db.scheduleItemExceptions.where('templateId').equals(id).toArray().then(setExceptions);
  }, [id]);

  useEffect(() => {
    const ids = [...new Set(items.map((i) => i.reminderRecipientPersonId).filter(Boolean))] as string[];
    if (ids.length === 0) {
      setRecipientNames({});
      return;
    }
    db.people.bulkGet(ids).then((people) => {
      const map: Record<string, string> = {};
      people.forEach((p, idx) => {
        if (p && ids[idx]) map[ids[idx]!] = p.nameListPreferred;
      });
      setRecipientNames(map);
    });
  }, [items]);

  async function refreshItems() {
    if (!id) return;
    const list = await db.recurringScheduleItems.where('templateId').equals(id).sortBy('order');
    setItems(list);
  }

  async function refreshExceptions() {
    if (!id) return;
    const list = await db.scheduleItemExceptions.where('templateId').equals(id).toArray();
    setExceptions(list);
  }

  async function removeItem(item: RecurringScheduleItem) {
    if (!window.confirm(`Remove "${item.label}" from this schedule? This cannot be undone.`)) return;
    await db.recurringScheduleItems.delete(item.id);
    await db.scheduleItemExceptions.where('itemId').equals(item.id).delete();
    await refreshItems();
    await refreshExceptions();
  }

  if (!template) {
    return (
      <PageLayout back="auto" title="Schedule template">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  const itemsByWeek = items.reduce<Record<number, RecurringScheduleItem[]>>((acc, item) => {
    const w = item.weekOfMonth;
    if (!acc[w]) acc[w] = [];
    acc[w].push(item);
    return acc;
  }, {});

  return (
    <PageLayout back="auto" title={template.name}>
      {template.description && <p className="text-sm text-muted mb-4">{template.description}</p>}

      <Section heading="Recurring items">
        <div className={cardClass}>
          {[0, 1, 2, 3, 4, 5].map((week) => {
            const weekItems = itemsByWeek[week] ?? [];
            if (weekItems.length === 0) return null;
            return (
              <div key={week} className="mb-4 last:mb-0">
                <h4 className="text-sm font-medium text-muted mb-2">{WEEK_LABELS[week]}</h4>
                <ul className="space-y-2 list-none p-0 m-0">
                  {weekItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg border border-border bg-slate-50/50"
                    >
                      <span className="font-mono text-sm text-muted shrink-0">
                        {formatTimeAmPm(item.startMinutes)}–{formatTimeAmPm(item.endMinutes)}
                      </span>
                      <span className="font-medium">{item.label}</span>
                      {item.reminderDaysBefore != null && item.reminderDaysBefore > 0 && (
                        <span className="text-sm text-muted">
                          Reminder: {item.reminderDaysBefore}d before → {item.reminderRecipientPersonId ? (recipientNames[item.reminderRecipientPersonId] ?? 'Unknown') : 'None'}
                        </span>
                      )}
                      <span className="flex-1" />
                      <button type="button" className="text-primary font-medium text-sm min-h-tap" onClick={() => setEditingId(item.id)}>Edit</button>
                      <button type="button" className="text-muted font-medium text-sm min-h-tap" onClick={() => removeItem(item)}>Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {showAddItem ? (
            <AddItemForm
              templateId={template.id}
              onDone={() => { setShowAddItem(false); refreshItems(); }}
              onCancel={() => setShowAddItem(false)}
            />
          ) : (
            <button type="button" onClick={() => setShowAddItem(true)} className="mt-2 text-primary font-medium min-h-tap">Add item</button>
          )}
        </div>
      </Section>

      {editingId && (
        <EditItemModal
          item={items.find((i) => i.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); refreshItems(); }}
        />
      )}

      <Section heading="Exceptions">
        <p className="text-sm text-muted mb-2">Remove an item from a specific Sunday.</p>
        <div className={cardClass}>
          <ul className="space-y-2 list-none p-0 m-0 mb-4">
            {exceptions.filter((ex) => ex.localDate >= todayLocalDate()).map((ex) => {
              const item = items.find((i) => i.id === ex.itemId);
              return (
                <li key={ex.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-border bg-slate-50/50">
                  <span><span className="font-medium">{ex.localDate}</span>: {item?.label ?? ex.itemId}</span>
                  <button type="button" className="text-muted font-medium text-sm min-h-tap" onClick={async () => { await db.scheduleItemExceptions.delete(ex.id); refreshExceptions(); }}>Remove</button>
                </li>
              );
            })}
          </ul>
          {showAddException ? (
            <AddExceptionForm
              templateId={template.id}
              items={items}
              onDone={() => { setShowAddException(false); refreshExceptions(); }}
              onCancel={() => setShowAddException(false)}
            />
          ) : (
            <button type="button" onClick={() => setShowAddException(true)} className="text-primary font-medium min-h-tap">Add exception</button>
          )}
        </div>
      </Section>
    </PageLayout>
  );
}

function AddItemForm({
  templateId,
  onDone,
  onCancel,
}: {
  templateId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [weekOfMonth, setWeekOfMonth] = useState(0);
  const [startMinutes, setStartMinutes] = useState(9 * 60);
  const [endMinutes, setEndMinutes] = useState(9 * 60 + 30);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number | ''>('');
  const [reminderRecipientPerson, setReminderRecipientPerson] = useState<Person | null>(null);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const maxOrder = 100;
  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => i * 30); // 0, 30, 60, ...

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    const now = Date.now();
    const id = `item-${now}-${Math.random().toString(36).slice(2, 9)}`;
    await db.recurringScheduleItems.add({
      id,
      templateId,
      label: label.trim(),
      weekOfMonth,
      startMinutes,
      endMinutes,
      order: maxOrder,
      reminderDaysBefore: reminderDaysBefore === '' ? null : Number(reminderDaysBefore),
      reminderRecipientKind: reminderRecipientPerson ? 'custom' : 'none',
      reminderRecipientPersonId: reminderRecipientPerson?.id ?? null,
      yearEffective: null,
      createdAt: now,
      updatedAt: now,
    });
    setSaving(false);
    onDone();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Label</label>
          <input type="text" className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Week</label>
          <select className={inputClass} value={weekOfMonth} onChange={(e) => setWeekOfMonth(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>{WEEK_LABELS[w]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Start</label>
          <select className={inputClass} value={startMinutes} onChange={(e) => setStartMinutes(Number(e.target.value))}>
            {timeOptions.map((m) => (
              <option key={m} value={m}>{formatTimeAmPm(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>End</label>
          <select className={inputClass} value={endMinutes} onChange={(e) => setEndMinutes(Number(e.target.value))}>
            {timeOptions.map((m) => (
              <option key={m} value={m}>{formatTimeAmPm(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Reminder (days before)</label>
          <input type="number" className={inputClass} min={0} value={reminderDaysBefore} onChange={(e) => setReminderDaysBefore(e.target.value === '' ? '' : Number(e.target.value))} placeholder="None" />
        </div>
        <div>
          <label className={labelClass}>Reminder recipient</label>
          <div className="flex items-center gap-2 flex-wrap">
            {reminderRecipientPerson ? (
              <>
                <span className="text-sm">{reminderRecipientPerson.nameListPreferred}</span>
                <button type="button" className="text-primary font-medium text-sm min-h-tap" onClick={() => setShowRecipientPicker(true)}>Change</button>
                <button type="button" className="text-muted font-medium text-sm min-h-tap" onClick={() => setReminderRecipientPerson(null)}>Clear</button>
              </>
            ) : (
              <button type="button" className="text-primary font-medium min-h-tap" onClick={() => setShowRecipientPicker(true)}>Select from contacts</button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap disabled:opacity-60">{saving ? 'Saving…' : 'Add'}</button>
          <button type="button" onClick={onCancel} className="border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap">Cancel</button>
        </div>
      </form>
      {showRecipientPicker && (
        <PeoplePickerModal
          onSelect={(p) => { setReminderRecipientPerson(p); setShowRecipientPicker(false); }}
          onClose={() => setShowRecipientPicker(false)}
        />
      )}
    </>
  );
}

function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: RecurringScheduleItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [startMinutes, setStartMinutes] = useState(item.startMinutes);
  const [endMinutes, setEndMinutes] = useState(item.endMinutes);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number | ''>(item.reminderDaysBefore ?? '');
  const [reminderRecipientPerson, setReminderRecipientPerson] = useState<Person | null>(null);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => i * 30);

  useEffect(() => {
    if (!item.reminderRecipientPersonId) {
      setReminderRecipientPerson(null);
      return;
    }
    db.people.get(item.reminderRecipientPersonId).then((p) => setReminderRecipientPerson(p ?? null));
  }, [item.reminderRecipientPersonId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const now = Date.now();
    await db.recurringScheduleItems.update(item.id, {
      label: label.trim(),
      startMinutes,
      endMinutes,
      reminderDaysBefore: reminderDaysBefore === '' ? null : Number(reminderDaysBefore),
      reminderRecipientKind: reminderRecipientPerson ? 'custom' : 'none',
      reminderRecipientPersonId: reminderRecipientPerson?.id ?? null,
      updatedAt: now,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle>Edit item</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Label</label>
            <input type="text" className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Start</label>
            <select className={inputClass} value={startMinutes} onChange={(e) => setStartMinutes(Number(e.target.value))}>
              {timeOptions.map((m) => (
                <option key={m} value={m}>{formatTimeAmPm(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>End</label>
            <select className={inputClass} value={endMinutes} onChange={(e) => setEndMinutes(Number(e.target.value))}>
              {timeOptions.map((m) => (
                <option key={m} value={m}>{formatTimeAmPm(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reminder (days before)</label>
            <input type="number" className={inputClass} min={0} value={reminderDaysBefore} onChange={(e) => setReminderDaysBefore(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Reminder recipient</label>
            <div className="flex items-center gap-2 flex-wrap">
              {reminderRecipientPerson ? (
                <>
                  <span className="text-sm">{reminderRecipientPerson.nameListPreferred}</span>
                  <button type="button" className="text-primary font-medium text-sm min-h-tap" onClick={() => setShowRecipientPicker(true)}>Change</button>
                  <button type="button" className="text-muted font-medium text-sm min-h-tap" onClick={() => setReminderRecipientPerson(null)}>Clear</button>
                </>
              ) : (
                <button type="button" className="text-primary font-medium min-h-tap" onClick={() => setShowRecipientPicker(true)}>Select from contacts</button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap disabled:opacity-60">Save</button>
            <button type="button" onClick={onClose} className="border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap">Cancel</button>
          </div>
        </form>
      </DialogContent>
      {showRecipientPicker && (
        <PeoplePickerModal
          onSelect={(p) => { setReminderRecipientPerson(p); setShowRecipientPicker(false); }}
          onClose={() => setShowRecipientPicker(false)}
        />
      )}
    </Dialog>
  );
}

function AddExceptionForm({
  templateId,
  items,
  onDone,
  onCancel,
}: {
  templateId: string;
  items: RecurringScheduleItem[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [localDate, setLocalDate] = useState('');
  const [itemId, setItemId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!localDate || !itemId) return;
    setSaving(true);
    const now = Date.now();
    const id = `ex-${now}-${Math.random().toString(36).slice(2, 9)}`;
    await db.scheduleItemExceptions.add({
      id,
      templateId,
      itemId,
      localDate,
      createdAt: now,
      updatedAt: now,
    });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Date (Sunday to remove item from)</label>
        <input type="date" className={inputClass} value={localDate} onChange={(e) => setLocalDate(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Item to hide</label>
        <select className={inputClass} value={itemId} onChange={(e) => setItemId(e.target.value)} required>
          <option value="">Select…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{WEEK_LABELS[i.weekOfMonth]} – {i.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap disabled:opacity-60">{saving ? 'Saving…' : 'Add exception'}</button>
        <button type="button" onClick={onCancel} className="border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap">Cancel</button>
      </div>
    </form>
  );
}
