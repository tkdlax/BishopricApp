import { useState } from 'react';
import { db } from '../db/schema';
import { nextSunday, todayLocalDate } from '../lib/scheduling';
import { addBlackout, getGeneralConferenceDates } from '../lib/blackouts';
import { PageLayout, Section } from '../components/ui';

const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4';

export function TestHarness() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function generateFakeData() {
    setBusy(true);
    setMessage('');
    try {
      const now = Date.now();
      const h1 = `hh-${now}-1`;
      const h2 = `hh-${now}-2`;
      await db.households.bulkAdd([
        { id: h1, name: 'Fake Family 1', createdAt: now, updatedAt: now },
        { id: h2, name: 'Fake Family 2', createdAt: now, updatedAt: now },
      ]);
      await db.people.bulkAdd([
        { id: `p-${now}-1`, householdId: h1, nameListPreferred: 'Fake, Alice', normalizedName: 'fake alice', phones: ['5550000001'], householdRole: 'HEAD', role: 'adult', eligibleForInterview: true, eligibleForPrayer: true, createdAt: now, updatedAt: now },
        { id: `p-${now}-2`, householdId: h1, nameListPreferred: 'Fake, Bob', normalizedName: 'fake bob', phones: ['5550000002'], householdRole: 'SPOUSE', role: 'adult', eligibleForInterview: true, eligibleForPrayer: true, createdAt: now, updatedAt: now },
        { id: `p-${now}-3`, householdId: h2, nameListPreferred: 'Test, Carol', normalizedName: 'test carol', phones: ['5550000003'], householdRole: 'HEAD', role: 'adult', eligibleForInterview: true, eligibleForPrayer: true, createdAt: now, updatedAt: now },
      ]);
      const thisSun = nextSunday(todayLocalDate());
      await db.appointments.add({
        id: `apt-${now}-1`,
        type: 'bishop_interview',
        personId: `p-${now}-1`,
        localDate: thisSun,
        minutesFromMidnight: 600,
        durationMinutes: 30,
        status: 'hold',
        historyLog: [{ at: now, who: 'user', what: 'Test harness' }],
        createdAt: now,
        updatedAt: now,
      });
      await db.messageQueue.add({
        id: `mq-${now}-1`,
        recipientPhone: '5550000001',
        renderedMessage: 'Test message',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      setMessage('Fake data added: 2 households, 3 people, 1 appointment, 1 queue item.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
    setBusy(false);
  }

  async function simulateBlackouts() {
    setBusy(true);
    setMessage('');
    try {
      const year = new Date().getFullYear();
      for (const d of getGeneralConferenceDates(year)) {
        await addBlackout(d, 'General Conference (test)');
      }
      setMessage(`Added General Conference blackouts for ${year}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
    setBusy(false);
  }

  async function resetAll() {
    if (!window.confirm('Delete ALL data? This cannot be undone.')) return;
    setBusy(true);
    setMessage('');
    try {
      await db.households.clear();
      await db.people.clear();
      await db.appointments.clear();
      await db.prayerAssignments.clear();
      await db.messageQueue.clear();
      await db.templates.clear();
      await db.settings.clear();
      await db.campaigns.clear();
      await db.prayerHistory.clear();
      await db.blackoutDates.clear();
      await db.tithingHouseholds.clear();
      setMessage('All data cleared.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
    setBusy(false);
  }

  return (
    <PageLayout back={{ to: '/settings', label: 'Settings' }} title="Test Harness">
      <p className="text-sm text-muted mb-4">Generate fake data, blackouts, or reset. For development only.</p>
      <Section heading="Actions">
        <div className={cardClass}>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={generateFakeData} disabled={busy} className="border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap disabled:opacity-60">
              Generate fake data
            </button>
            <button type="button" onClick={simulateBlackouts} disabled={busy} className="border border-border rounded-lg px-4 py-2.5 font-medium min-h-tap disabled:opacity-60">
              Simulate blackout Sundays
            </button>
            <button type="button" onClick={resetAll} disabled={busy} className="border border-red-600 text-red-600 rounded-lg px-4 py-2.5 font-medium min-h-tap disabled:opacity-60">
              Reset all data
            </button>
          </div>
          {message && <p className="text-sm mt-4 text-muted">{message}</p>}
        </div>
      </Section>
    </PageLayout>
  );
}
