import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { db } from '../db/schema';
import { normalizeWardListJson, mergeWardListIntoDb } from '../lib/wardListImport';
import { PageLayout, Section } from '../components/ui';

const LCR_BASE = 'https://lcr.churchofjesuschrist.org/api/umlu/report/member-list?lang=eng&unitNumber=';

type Step = 'input' | 'preview' | 'done';
type ImportMode = 'merge' | 'replace';

export function ImportWardList() {
  const [step, setStep] = useState<Step>('input');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ households: number; people: number } | null>(null);
  const [lcrUrl, setLcrUrl] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  useEffect(() => {
    db.settings.get('lcrUnitNumber').then((s) => {
      const unit = String(s?.value ?? '').trim();
      setLcrUrl(unit ? `${LCR_BASE}${encodeURIComponent(unit)}` : '');
    });
  }, []);

  function handleParse() {
    setError(null);
    try {
      const raw = JSON.parse(pasteText) as unknown;
      const arr = toPersonArray(raw);
      if (!Array.isArray(arr)) {
        setError('JSON must be an array of person records (or an object with .data or .rows).');
        return;
      }
      const normalized = normalizeWardListJson(arr);
      setPreview({ households: normalized.households.length, people: normalized.people.length });
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  function toPersonArray(raw: unknown): unknown[] | null {
    if (Array.isArray(raw)) return raw;
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.rows)) return o.rows;
    return null;
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    try {
      const raw = JSON.parse(pasteText) as unknown;
      const arr = toPersonArray(raw);
      if (!Array.isArray(arr)) return;
      const normalized = normalizeWardListJson(arr);

      if (importMode === 'replace') {
        await db.transaction('rw', db.households, db.people, async () => {
          await db.households.clear();
          await db.people.clear();
          await db.households.bulkPut(normalized.households);
          await db.people.bulkPut(normalized.people);
        });
      } else {
        await mergeWardListIntoDb(normalized);
      }
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  const cardClass = 'bg-white rounded-lg border border-border shadow-sm p-4 mb-4';
  const labelClass = 'block text-sm font-medium text-muted mb-1';
  const inputClass = 'border border-border rounded-lg px-3 py-2 w-full';

  return (
    <PageLayout back={{ to: '/contacts', label: 'Contacts' }} title="Import ward list">
      <p className="text-muted text-sm mb-4">Data is stored locally only. Raw JSON is never saved.</p>

      <Section heading="Update from LCR">
        <div className={cardClass}>
          {lcrUrl ? (
            <>
              <p className="text-sm text-muted mb-2">Open the link below, sign in if needed, then copy the entire JSON. Paste it in the box below.</p>
              <p className="mb-2"><code className="text-xs bg-slate-100 px-2 py-1 rounded break-all">{lcrUrl}</code></p>
              <button type="button" onClick={() => window.open(lcrUrl, '_blank')} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap">Open LCR member list</button>
            </>
          ) : (
            <p className="text-sm text-muted">Set your <Link to="/settings" className="text-primary">unit number in Settings</Link> to get a link to the LCR member list.</p>
          )}
        </div>
      </Section>

      {step === 'input' && (
        <Section heading="Paste JSON">
          <label className={labelClass}>Ward directory JSON (array of person records)</label>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder='[ { "uuid": "...", "householdUuid": "...", ... }, ... ]' rows={8} className={`${inputClass} font-mono text-sm mb-3`} />
          <button type="button" onClick={handleParse} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap">Parse & preview</button>
          {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        </Section>
      )}

      {step === 'preview' && preview && (
        <Section heading="Preview">
          <div className={cardClass}>
            <p className="font-medium">Households: {preview.households}, People: {preview.people}</p>
            <p className="text-sm font-medium text-muted mt-2 mb-1">Import mode</p>
            <label className="flex items-start gap-2 mb-2">
              <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="mt-1" />
              <span className="text-sm">Merge (add new, update existing). Does not remove anyone.</span>
            </label>
            <label className="flex items-start gap-2 mb-4">
              <input type="radio" name="importMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="mt-1" />
              <span className="text-sm">Replace all — clears current households and people. Use with caution.</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={handleConfirm} className="bg-primary text-white px-4 py-2.5 rounded-lg font-semibold min-h-tap">Import now</button>
              <button type="button" onClick={() => setStep('input')} className="text-primary font-medium">Back</button>
            </div>
            {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
          </div>
        </Section>
      )}

      {step === 'done' && (
        <Section heading="Done">
          <p className="mb-3">Import complete.</p>
          <Link to="/contacts" className="flex items-center gap-3 min-h-tap py-3 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 no-underline text-inherit">
            <span className="flex-1 font-semibold">View contacts</span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Link>
        </Section>
      )}
    </PageLayout>
  );
}
