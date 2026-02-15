import { useState, useEffect } from 'react';
import { db } from '../db/schema';
import type { Campaign, Household, Person } from '../db/schema';
import type { TithingHouseholdStatus } from '../db/schema';
import { PageLayout, Section, EmptyState } from '../components/ui';

const TITHING_INVITE = 'Tithing declaration is coming up. Please schedule a time with the bishop.';

const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4';
const inputClass = 'border border-border rounded-lg px-3 py-2 w-full';

export function TithingDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TithingHouseholdStatus>>({});
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customMessageStatus, setCustomMessageStatus] = useState<string | null>(null);

  useEffect(() => {
    db.campaigns.toArray().then(setCampaigns);
  }, []);

  useEffect(() => {
    db.households.toArray().then(setHouseholds);
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    db.tithingHouseholds.where('campaignId').equals(selectedCampaignId).toArray().then((list) => {
      const map: Record<string, TithingHouseholdStatus> = {};
      list.forEach((t) => { map[t.householdId] = t.status; });
      setStatuses(map);
    });
  }, [selectedCampaignId]);

  async function createCampaign() {
    if (!newCampaignName || !newStart || !newEnd) return;
    const now = Date.now();
    const id = `camp-${now}`;
    await db.campaigns.add({
      id,
      name: newCampaignName,
      startDate: newStart,
      endDate: newEnd,
      createdAt: now,
      updatedAt: now,
    });
    setCampaigns(await db.campaigns.toArray());
    setNewCampaignName('');
    setNewStart('');
    setNewEnd('');
  }

  async function setStatus(householdId: string, status: TithingHouseholdStatus) {
    if (!selectedCampaignId) return;
    const now = Date.now();
    const id = `th-${selectedCampaignId}-${householdId}`;
    await db.tithingHouseholds.put({
      id,
      campaignId: selectedCampaignId,
      householdId: householdId,
      status,
      updatedAt: now,
    });
    setStatuses((prev) => ({ ...prev, [householdId]: status }));
  }

  const includedHouseholds = households.filter((h) => !h.excludeFromTithingDeclaration);

  async function batchInvite() {
    if (!selectedCampaignId) return;
    const notContacted = includedHouseholds.filter((h) => (statuses[h.id] ?? 'not_contacted') === 'not_contacted');
    const now = Date.now();
    for (const h of notContacted) {
      const peopleInHh = await db.people.where('householdId').equals(h.id).toArray();
      const withPhone = peopleInHh.filter((p) => p.phones?.length);
      const first = withPhone[0] as Person | undefined;
      if (!first?.phones?.[0]) continue;
      await db.messageQueue.add({
        id: `mq-${now}-${h.id}-${Math.random().toString(36).slice(2, 9)}`,
        recipientPhone: first.phones[0],
        renderedMessage: TITHING_INVITE,
        relatedObjectType: 'tithing',
        relatedObjectId: selectedCampaignId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      await setStatus(h.id, 'invited');
    }
  }

  async function sendCustomToNotCompleted() {
    if (!selectedCampaignId || !customMessage.trim()) {
      setCustomMessageStatus('Enter a message first.');
      return;
    }
    const notCompleted = includedHouseholds.filter((h) => (statuses[h.id] ?? 'not_contacted') !== 'completed');
    let sent = 0;
    const now = Date.now();
    for (const h of notCompleted) {
      const peopleInHh = await db.people.where('householdId').equals(h.id).toArray();
      const withPhone = peopleInHh.filter((p) => p.phones?.length);
      const first = withPhone[0] as Person | undefined;
      if (!first?.phones?.[0]) continue;
      await db.messageQueue.add({
        id: `mq-${now}-${h.id}-${Math.random().toString(36).slice(2, 9)}`,
        recipientPhone: first.phones[0],
        renderedMessage: customMessage.trim(),
        relatedObjectType: 'tithing',
        relatedObjectId: selectedCampaignId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      sent++;
    }
    setCustomMessageStatus(`Added ${sent} message(s) to the queue.`);
    setTimeout(() => setCustomMessageStatus(null), 4000);
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <PageLayout title="Tithing Declaration">
      <Section heading="Campaigns">
        <div className={cardClass}>
          {campaigns.length === 0 ? (
            <EmptyState message="No campaigns yet." />
          ) : (
            <ul className="space-y-2 list-none p-0 m-0 mb-4">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={`w-full text-left min-h-tap py-3 px-3 rounded-lg border font-medium ${selectedCampaignId === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white hover:bg-slate-50'}`}
                  >
                    {c.name} ({c.startDate} – {c.endDate})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            <input placeholder="Name" className={inputClass} value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} />
            <input type="date" placeholder="Start" className={inputClass} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            <input type="date" placeholder="End" className={inputClass} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            <button type="button" onClick={createCampaign} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap">
              Create campaign
            </button>
          </div>
        </div>
      </Section>

      {selectedCampaign && (
        <Section heading={selectedCampaign.name}>
          <div className={cardClass}>
            <button type="button" onClick={batchInvite} className="mb-4 border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap">
              Batch invite (not contacted → queue)
            </button>
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-1">Custom message to those who haven&apos;t finished</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your message…"
                rows={3}
                className={`${inputClass} resize-y`}
              />
              <button type="button" onClick={sendCustomToNotCompleted} disabled={!customMessage.trim()} className="mt-2 border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap disabled:opacity-50">
                Send to all not completed
              </button>
              {customMessageStatus && <p className="text-sm text-muted mt-2">{customMessageStatus}</p>}
            </div>
            {includedHouseholds.length === 0 ? (
              <EmptyState message="No households (or all excluded from tithing declaration)." />
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {includedHouseholds.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
                    <span className="font-medium">{h.name}</span>
                    <select
                      className="border border-border rounded-lg px-2 py-1.5 text-sm"
                      value={statuses[h.id] ?? 'not_contacted'}
                      onChange={(e) => setStatus(h.id, e.target.value as TithingHouseholdStatus)}
                    >
                      <option value="not_contacted">Not contacted</option>
                      <option value="invited">Invited</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="declined">Declined</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}
    </PageLayout>
  );
}
