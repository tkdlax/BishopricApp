import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import {
  getYouthDueThisYear,
  getAdvancementCandidates,
  getBaptismCandidates,
  type YouthDueItem,
  type AdvancementCandidate,
  type BaptismCandidate,
} from '../lib/youthInterviews';
import { User } from 'lucide-react';

const PERIOD_KEY = `${new Date().getFullYear()}-H1`;

export function InterviewsToGet() {
  const [youthDue, setYouthDue] = useState<YouthDueItem[]>([]);
  const [advancement, setAdvancement] = useState<AdvancementCandidate[]>([]);
  const [baptism, setBaptism] = useState<BaptismCandidate[]>([]);
  const [custom, setCustom] = useState<{ id: string; label: string; personId?: string; completedAt?: number }[]>([]);
  const [dismissals, setDismissals] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [people, customList, dismissList] = await Promise.all([
        db.people.toArray(),
        db.customInterviewToGet.toArray().then((list) => list.filter((c) => !c.completedAt)),
        db.interviewToGetDismissals.where('periodKey').equals(PERIOD_KEY).toArray(),
      ]);
      const youthItems = people.flatMap((p) => getYouthDueThisYear(p));
      setYouthDue(youthItems);
      setAdvancement(getAdvancementCandidates(people));
      setBaptism(getBaptismCandidates(people));
      setCustom(customList.map((c) => ({ id: c.id, label: c.label, personId: c.personId, completedAt: c.completedAt })));
      setDismissals(new Set(dismissList.map((d) => `${d.personId}-${d.reasonKey}`)));
    })();
  }, []);

  const filteredYouth = youthDue.filter((item) => !dismissals.has(`${item.person.id}-${item.reason}`));
  const reasonLabel = (item: YouthDueItem) =>
    item.reason === 'birthday_month' ? 'Birthday month' : 'Semi-annual';
  const leaderLabel = (item: YouthDueItem) => (item.leader === 'bishop' ? 'Bishop' : 'Counselor');

  return (
    <PageLayout back={{ to: '/', label: 'Dashboard' }} title="Interviews to get">
      <Section heading="Youth due this year">
        <ul className="list-none p-0 m-0 space-y-2">
          {filteredYouth.slice(0, 30).map((item, i) => (
            <li key={`${item.person.id}-${item.reason}-${item.month}-${i}`} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-white">
              <User size={18} className="text-muted shrink-0" />
              <Link to={`/contacts/person/${item.person.id}`} className="flex-1 font-medium min-h-tap">
                {item.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm">{reasonLabel(item)} → {leaderLabel(item)}</span>
            </li>
          ))}
        </ul>
        {filteredYouth.length === 0 && <p className="text-muted text-sm">None or all dismissed.</p>}
      </Section>

      <Section heading="Advancement (priesthood)">
        <ul className="list-none p-0 m-0 space-y-2">
          {advancement.map((c) => (
            <li key={`${c.person.id}-${c.office}`} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-white">
              <Link to={`/contacts/person/${c.person.id}`} className="flex-1 font-medium min-h-tap">
                {c.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm">{c.office} (turning {c.turningAge})</span>
            </li>
          ))}
        </ul>
        {advancement.length === 0 && <p className="text-muted text-sm">None.</p>}
      </Section>

      <Section heading="Baptism (8th birthday)">
        <ul className="list-none p-0 m-0 space-y-2">
          {baptism.map((c) => (
            <li key={c.person.id} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-white">
              <Link to={`/contacts/person/${c.person.id}`} className="flex-1 font-medium min-h-tap">
                {c.person.nameListPreferred}
              </Link>
              <span className="text-muted text-sm">{c.eighthBirthday}</span>
            </li>
          ))}
        </ul>
        {baptism.length === 0 && <p className="text-muted text-sm">None.</p>}
      </Section>

      <Section heading="Custom">
        <ul className="list-none p-0 m-0 space-y-2">
          {custom.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-white">
              <span className="flex-1 font-medium">{c.label}</span>
              {c.personId && (
                <Link to={`/contacts/person/${c.personId}`} className="text-primary text-sm min-h-tap">View person</Link>
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm mt-2">Add custom items from person detail (future) or here.</p>
      </Section>
    </PageLayout>
  );
}
