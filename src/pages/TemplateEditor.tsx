import { useState, useEffect, useRef } from 'react';
import { db } from '../db/schema';
import { PageLayout, Section } from '../components/ui';
import { INTERVIEW_TEMPLATE_TYPES } from '../lib/templates';

const TOKENS = [
  { key: '{name}', label: 'Name' },
  { key: '{date}', label: 'Date' },
  { key: '{time}', label: 'Time' },
  { key: '{interviewType}', label: 'Interview type' },
  { key: '{locationSuffix}', label: 'Location suffix' },
];

export function TemplateEditor() {
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    (async () => {
      const list = await db.templates.toArray();
      const byType: Record<string, string> = {};
      INTERVIEW_TEMPLATE_TYPES.forEach((t) => {
        const found = list.find((x) => x.type === t.type);
        byType[t.type] = found?.body ?? `Hi {name}, your appointment is on {date} at {time}.`;
      });
      setTemplates(byType);
    })();
  }, []);

  function insertToken(type: string, token: string) {
    const ta = textareaRefs.current[type];
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const body = templates[type] ?? '';
    const newBody = body.slice(0, start) + token + body.slice(end);
    setTemplates((prev) => ({ ...prev, [type]: newBody }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  async function save(type: string) {
    setSaving(type);
    const now = Date.now();
    const body = templates[type] ?? '';
    const existing = await db.templates.where('type').equals(type).first();
    const id = existing?.id ?? `template-${type}`;
    if (existing) {
      await db.templates.update(id, { body, updatedAt: now });
    } else {
      await db.templates.put({
        id,
        name: INTERVIEW_TEMPLATE_TYPES.find((t) => t.type === type)?.name ?? type,
        body,
        type,
        createdAt: now,
        updatedAt: now,
      });
    }
    setSaving(null);
  }

  return (
    <PageLayout back="auto" title="Message templates">
      <p className="text-muted text-sm mb-4">Default text for queue messages. Use tokens below; you can also edit any message in the queue before sending.</p>
      {INTERVIEW_TEMPLATE_TYPES.map((t) => (
        <Section key={t.type} heading={t.name}>
          <div className="card p-4">
            <p className="text-xs text-muted mb-2">Insert token:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {TOKENS.map((tok) => (
                <button
                  key={tok.key}
                  type="button"
                  onClick={() => insertToken(t.type, tok.key)}
                  className="px-2 py-1 rounded-lg border border-border bg-white text-sm font-mono hover:bg-slate-50 min-h-tap"
                >
                  {tok.label}
                </button>
              ))}
            </div>
            <textarea
              ref={(el) => { textareaRefs.current[t.type] = el; }}
              value={templates[t.type] ?? ''}
              onChange={(e) => setTemplates((prev) => ({ ...prev, [t.type]: e.target.value }))}
              rows={4}
              className="border border-border rounded-xl p-3 w-full text-sm font-sans resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Message body..."
            />
            <button
              type="button"
              onClick={() => save(t.type)}
              disabled={saving === t.type}
              className="mt-3 bg-primary text-white px-4 py-2 rounded-xl font-semibold min-h-tap disabled:opacity-50"
            >
              {saving === t.type ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Section>
      ))}
    </PageLayout>
  );
}
