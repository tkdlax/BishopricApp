import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../db/schema';
import { getMessageRecipientPhone, isUnder18 } from '../lib/contactRecipient';
import { RecipientPickerModal } from '../components/RecipientPickerModal';
import { getBishopLastNameForMessage } from '../lib/bishopForMessages';
import { buildReachOutMessage, REACH_OUT_INTERVIEW_TYPES, getMessageTextForType } from '../lib/reachOutTemplate';
import { PeoplePickerModal } from '../components/PeoplePickerModal';
import { PageLayout, Section } from '../components/ui';
import { MessageCircle, Calendar } from 'lucide-react';
import type { Person } from '../db/schema';

const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4';
const labelClass = 'block text-sm font-medium text-muted mb-1';
const inputClass = 'border border-border rounded-lg px-3 py-2 w-full';

type Mode = 'chooser' | 'reach_out' | 'reach_out_done';

export function ScheduleInterview() {
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('chooser');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string>(REACH_OUT_INTERVIEW_TYPES[0]?.type ?? 'standard_interview');
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);

  const personIdFromState = (location.state as { personId?: string } | null)?.personId;
  useEffect(() => {
    if (!personIdFromState) return;
    db.people.get(personIdFromState).then((p) => {
      if (p) {
        setSelectedPerson(p);
        setMode('reach_out');
      }
    });
  }, [personIdFromState]);

  const interviewTypeDisplay = getMessageTextForType(selectedTypeKey);

  async function addToQueueWithPhone(phone: string) {
    if (!selectedPerson) return;
    const bishopLastName = await getBishopLastNameForMessage();
    const recipientName = selectedPerson.nameGiven || selectedPerson.nameListPreferred;
    const message = buildReachOutMessage(recipientName, bishopLastName, interviewTypeDisplay);
    const now = Date.now();
    await db.messageQueue.add({
      id: `mq-${now}-${Math.random().toString(36).slice(2, 9)}`,
      recipientPhone: phone,
      renderedMessage: message,
      relatedObjectType: 'person',
      relatedObjectId: selectedPerson.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    setMode('reach_out_done');
  }

  async function handleAddToQueue() {
    if (!selectedPerson) return;
    if (isUnder18(selectedPerson)) {
      setShowRecipientPicker(true);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const phone = await getMessageRecipientPhone(selectedPerson);
      if (!phone) {
        setError('No phone number found for this contact. Add a phone number in Contacts.');
        setAdding(false);
        return;
      }
      await addToQueueWithPhone(phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add to queue');
    }
    setAdding(false);
  }

  function startReachOut() {
    setMode('reach_out');
    setSelectedPerson(null);
    setSelectedTypeKey(REACH_OUT_INTERVIEW_TYPES[0]?.type ?? 'standard_interview');
    setError(null);
  }

  if (mode === 'chooser') {
    return (
      <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Schedule an interview">
        <p className="text-muted text-sm mb-4">Choose how you want to schedule.</p>
        <Section heading="">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={startReachOut}
              className="bg-white rounded-lg p-4 shadow-sm border border-border flex items-center gap-3 min-h-tap font-semibold text-left hover:bg-slate-50"
            >
              <MessageCircle size={28} className="shrink-0 text-primary" />
              <span>Reach out to schedule</span>
            </button>
            <Link
              to="/hallway"
              className="bg-white rounded-lg p-4 shadow-sm border border-border flex items-center gap-3 min-h-tap font-semibold no-underline text-inherit hover:bg-slate-50"
            >
              <Calendar size={28} className="shrink-0 text-primary" />
              <span>Schedule on calendar</span>
            </Link>
          </div>
        </Section>
      </PageLayout>
    );
  }

  if (mode === 'reach_out_done') {
    return (
      <PageLayout back={{ to: '/schedule', label: 'Schedule an interview' }} title="Message added to queue">
        <div className={cardClass}>
          <p className="text-sm text-muted mb-4">You can edit the message before sending.</p>
          <Link to="/messages" className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap inline-block">
            Open Message Center
          </Link>
          <button
            type="button"
            onClick={startReachOut}
            className="block mt-3 text-primary font-medium text-sm min-h-tap"
          >
            Add another reach-out
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout back={{ to: '/schedule', label: 'Schedule an interview' }} title="Reach out to schedule">
      <Section heading="">
        <div className={cardClass}>
          <div className="mb-4">
            <label className={labelClass}>Person</label>
            {selectedPerson ? (
              <div className="flex items-center justify-between gap-2 py-2">
                <span className="font-medium">{selectedPerson.nameListPreferred}</span>
                <button type="button" onClick={() => setShowPersonPicker(true)} className="text-primary font-medium text-sm min-h-tap">Change</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowPersonPicker(true)} className="border border-border rounded-lg px-3 py-2 w-full text-left text-muted min-h-tap">Select person</button>
            )}
          </div>
          <div className="mb-4">
            <label className={labelClass}>Interview type</label>
            <select className={inputClass} value={selectedTypeKey} onChange={(e) => setSelectedTypeKey(e.target.value)} aria-label="Interview type">
              {REACH_OUT_INTERVIEW_TYPES.map((t) => (
                <option key={t.type} value={t.type}>{t.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={!selectedPerson || adding}
            className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add to queue'}
          </button>
        </div>
      </Section>
      {showPersonPicker && (
        <PeoplePickerModal
          onSelect={(p) => { setSelectedPerson(p); setShowPersonPicker(false); }}
          onClose={() => setShowPersonPicker(false)}
          filter={(p) => !p.inactive && !p.doNotInterview}
        />
      )}
      {showRecipientPicker && selectedPerson && (
        <RecipientPickerModal
          person={selectedPerson}
          onSelect={(phone) => {
            if (phone) void addToQueueWithPhone(phone);
            setShowRecipientPicker(false);
          }}
          onClose={() => setShowRecipientPicker(false)}
        />
      )}
    </PageLayout>
  );
}
