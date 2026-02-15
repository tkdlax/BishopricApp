import { useState, useEffect } from 'react';
import { PageLayout, Section } from '../components/ui';
import { db } from '../db/schema';

const LAST_BACKUP_AT_KEY = 'lastBackupAt';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Simple XOR with key repeated. Not cryptographically strong; obfuscation only. */
function xorBytes(data: Uint8Array, password: string): Uint8Array {
  const out = new Uint8Array(data.length);
  const key = new TextEncoder().encode(password);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i]! ^ key[i % key.length]!;
  }
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function BackupRestore() {
  const [exportPassword, setExportPassword] = useState('');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [includeDateInFilename, setIncludeDateInFilename] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  useEffect(() => {
    db.settings.get(LAST_BACKUP_AT_KEY).then((s) => {
      const last = typeof s?.value === 'number' ? s.value : 0;
      if (last > 0 && Date.now() - last > ONE_WEEK_MS) setShowBackupReminder(true);
    });
  }, []);

  const handleExport = async () => {
    setExportStatus(null);
    try {
      const tables = [
        'households', 'people', 'appointments', 'prayerAssignments', 'messageQueue',
        'templates', 'settings', 'blackoutDates', 'dayBlocks', 'interviewToGetDismissals',
        'interviewToGetNotes', 'customInterviewToGet', 'advancementCompletions', 'baptismCompletions',
        'youthInterviewCompletions', 'advancementDismissals', 'baptismDismissals',
        'prayerHistory', 'prayerSkipped',
      ] as const;
      const payload: Record<string, unknown[]> = {};
      for (const table of tables) {
        const t = (db as unknown as Record<string, { toArray: () => Promise<unknown[]> }>)[table];
        if (t?.toArray) payload[table] = await t.toArray();
      }
      const json = JSON.stringify(payload);
      const bytes = new TextEncoder().encode(json);
      const encrypted = xorBytes(bytes, exportPassword || 'bishopric-backup');
      const b64 = base64Encode(encrypted);
      const blob = new Blob([b64], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = includeDateInFilename ? `bishopric-backup-${dateStr}.txt` : 'bishopric-backup.txt';
      a.click();
      URL.revokeObjectURL(url);
      const now = Date.now();
      await db.settings.put({ id: LAST_BACKUP_AT_KEY, value: now, updatedAt: now });
      setShowBackupReminder(false);
      setExportStatus('Download started.');
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  const handleRestore = async () => {
    setRestoreStatus(null);
    if (!restoreFile) {
      setRestoreStatus('Choose a backup file first.');
      return;
    }
    try {
      const text = await restoreFile.text();
      const encrypted = base64Decode(text.trim());
      const decrypted = xorBytes(encrypted, restorePassword || 'bishopric-backup');
      const json = new TextDecoder().decode(decrypted);
      const payload = JSON.parse(json) as Record<string, unknown[]>;
      for (const [table, rows] of Object.entries(payload)) {
        if (!Array.isArray(rows)) continue;
        const t = (db as unknown as Record<string, { clear: () => Promise<void>; bulkAdd: (r: unknown[]) => Promise<void> }>)[table];
        if (t?.clear && t?.bulkAdd) {
          await t.clear();
          if (rows.length > 0) await t.bulkAdd(rows);
        }
      }
      setRestoreStatus('Restore complete. Reload the app.');
    } catch (e) {
      setRestoreStatus(e instanceof Error ? e.message : 'Restore failed. Wrong password or invalid file.');
    }
  };

  return (
    <PageLayout back="auto" title="Backup and restore">
      {showBackupReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowBackupReminder(false)} aria-hidden>
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full border border-border" onClick={(e) => e.stopPropagation()}>
            <p className="text-slate-700 mb-4">Your last backup was over a week ago. Consider backing up now.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowBackupReminder(false)} className="border border-border rounded-lg px-4 py-2 font-medium min-h-tap">Dismiss</button>
              <button type="button" onClick={() => { setShowBackupReminder(false); handleExport(); }} className="bg-primary text-white rounded-lg px-4 py-2 font-medium min-h-tap">Backup now</button>
            </div>
          </div>
        </div>
      )}
      <Section heading="Export backup">
        <p className="text-muted text-sm mb-2">Encrypted backup stays on this device. Use a password you will remember for restore. Default file name overwrites the previous backup.</p>
        <input
          type="password"
          value={exportPassword}
          onChange={(e) => setExportPassword(e.target.value)}
          placeholder="Password (optional)"
          className="border border-border rounded-lg px-3 py-2 w-full mb-2"
        />
        <label className="flex items-center gap-2 mb-3 min-h-tap cursor-pointer">
          <input type="checkbox" checked={includeDateInFilename} onChange={(e) => setIncludeDateInFilename(e.target.checked)} className="rounded border-border text-primary focus:ring-primary/40 w-4 h-4" />
          <span className="text-sm text-slate-700">Include date in file name</span>
        </label>
        <button type="button" onClick={handleExport} className="bg-primary text-white rounded-lg px-4 py-2 font-medium min-h-tap">
          Download backup
        </button>
        {exportStatus && <p className="text-sm mt-2 text-muted">{exportStatus}</p>}
      </Section>

      <Section heading="Restore from backup">
        <p className="text-muted text-sm mb-2">This replaces all local data. Use the same password you used when exporting.</p>
        <input
          type="password"
          value={restorePassword}
          onChange={(e) => setRestorePassword(e.target.value)}
          placeholder="Password"
          className="border border-border rounded-lg px-3 py-2 w-full mb-2"
        />
        <input
          type="file"
          accept=".txt,application/octet-stream"
          onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
          className="mb-2 block w-full text-sm"
        />
        <button
          type="button"
          onClick={handleRestore}
          disabled={!restoreFile}
          className="bg-primary text-white rounded-lg px-4 py-2 font-medium min-h-tap disabled:opacity-50"
        >
          Restore
        </button>
        {restoreStatus && <p className="text-sm mt-2 text-muted">{restoreStatus}</p>}
      </Section>
    </PageLayout>
  );
}
