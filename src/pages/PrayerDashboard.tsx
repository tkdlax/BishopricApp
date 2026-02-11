import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { getSuggestedPeopleForPrayer, recordPrayerSkipped } from '../lib/prayerSuggestions';
import { upcomingSunday } from '../lib/scheduling';
import { getMessageRecipientPhone } from '../lib/contactRecipient';
import type { SuggestedPerson } from '../lib/prayerSuggestions';
import type { PrayerType } from '../db/schema';
import { MessageCircle } from 'lucide-react';

const SUNDAY = upcomingSunday();

export function PrayerDashboard() {
  const [opening, setOpening] = useState<SuggestedPerson[]>([]);
  const [closing, setClosing] = useState<SuggestedPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [open, close] = await Promise.all([
        getSuggestedPeopleForPrayer('opening', { forSunday: SUNDAY, limit: 8 }),
        getSuggestedPeopleForPrayer('closing', { forSunday: SUNDAY, limit: 8 }),
      ]);
      setOpening(open);
      setClosing(close);
      setLoading(false);
    })();
  }, []);

  const handleAsk = async (personId: string, prayerType: PrayerType) => {
    const person = [...opening, ...closing].find((s) => s.person.id === personId)?.person;
    if (!person) return;
    const phone = await getMessageRecipientPhone(person);
    if (!phone) return;
    const now = Date.now();
    const message = `Hi ${person.nameListPreferred}, would you be willing to offer the ${prayerType === 'opening' ? 'opening' : 'closing'} prayer this Sunday?`;
    await db.messageQueue.add({
      id: `prayer-${now}-${Math.random().toString(36).slice(2, 9)}`,
      recipientPhone: phone,
      renderedMessage: message,
      relatedObjectType: 'prayer',
      relatedObjectId: personId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    await db.prayerAssignments.add({
      id: `pa-${now}-${Math.random().toString(36).slice(2, 9)}`,
      personId,
      localDate: SUNDAY,
      prayerType,
      status: 'asked',
      askedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    setOpening((prev) => prev.filter((s) => s.person.id !== personId));
    setClosing((prev) => prev.filter((s) => s.person.id !== personId));
  };

  const handleNotThisSunday = async (personId: string, prayerType: PrayerType) => {
    await recordPrayerSkipped(personId, prayerType, SUNDAY);
    setOpening((prev) => prev.filter((s) => s.person.id !== personId));
    setClosing((prev) => prev.filter((s) => s.person.id !== personId));
  };

  const renderList = (list: SuggestedPerson[], type: PrayerType) => (
    <ul className="list-none p-0 m-0 space-y-2">
      {list.map((s) => (
        <li key={`${s.person.id}-${type}`} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-white">
          <Link to={`/contacts/person/${s.person.id}`} className="flex-1 font-medium min-h-tap">
            {s.person.nameListPreferred}
          </Link>
          <span className="text-muted text-xs">{s.lastPrayerDate ?? 'Never'}</span>
          <button
            type="button"
            onClick={() => handleAsk(s.person.id, type)}
            className="text-primary font-medium text-sm min-h-tap flex items-center gap-1"
          >
            <MessageCircle size={16} /> Ask
          </button>
          <button
            type="button"
            onClick={() => handleNotThisSunday(s.person.id, type)}
            className="text-muted text-sm min-h-tap"
          >
            Not this Sunday
          </button>
        </li>
      ))}
    </ul>
  );

  if (loading) {
    return (
      <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Prayer">
        <p className="text-muted">Loading…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Prayer">
      <p className="text-muted text-sm mb-4">Suggestions for {SUNDAY}. Ask adds a message to the queue.</p>
      <Section heading="Opening prayer">
        {opening.length === 0 ? <p className="text-muted text-sm">No suggestions. Adjust filters or add history.</p> : renderList(opening, 'opening')}
      </Section>
      <Section heading="Closing prayer">
        {closing.length === 0 ? <p className="text-muted text-sm">No suggestions.</p> : renderList(closing, 'closing')}
      </Section>
      <Link to="/messages" className="text-primary font-medium min-h-tap">Open Message Center</Link>
    </PageLayout>
  );
}
