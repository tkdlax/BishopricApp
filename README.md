# Perry Park Ward PWA

Local-first PWA for scheduling and communication (Executive Secretary). All data stays on device (IndexedDB); no cloud member data.

## Stack

- React 18 + TypeScript
- Vite + vite-plugin-pwa
- Dexie (IndexedDB)
- React Router
- Firebase Hosting (static only)

## Dev

```bash
npm install
npm run dev
```

## Build & deploy

```bash
npm run build
firebase deploy
```

Set Firebase project: `firebase use <project-id>` or `.firebaserc`.

## PWA release checklist

Before release, verify:

1. **Manifest** – Served correctly; `display: standalone`, icons.
2. **Service worker** – Registers over HTTPS.
3. **Add to Home Screen** – Works; app runs offline (shell + IndexedDB).
4. **sms: links** – Work in both Safari tab and standalone (trigger from button tap only).
5. **Update banner** – After deploying a new build, "Update available" and "Reload now" appear.

Test in (1) Safari tab and (2) Added to Home Screen (standalone).

## Data

- **Import:** Settings → Contacts → Import ward list (paste or upload person-centric JSON).
- **Backup/Restore:** Settings → Backup / Restore. Export downloads JSON; restore replaces all data.
- No analytics or telemetry. No member data is sent off-device unless you export.
