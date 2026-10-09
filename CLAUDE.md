# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Absensi Ketjeh: a mobile-first PWA for staff attendance (photo + GPS clock in/out), tasks, briefings, reservations and announcements at Ketjeh Seafood & Leisure. React 19 + Vite + Tailwind v4 frontend on Vercel (`sin1`), Google Apps Script backend, Supabase as the database, Google Sheets as a reporting mirror. UI text, error messages and most domain names are Indonesian (`Karyawan` = employee, `Absensi` = attendance, `Jabatan` = job title, `Pengaturan` = settings, `Pengumuman` = announcement). All date logic uses `Asia/Jakarta` (WIB).

The root README.md is the stock Vite template and has no project information; the real docs are in `docs/`.

## Commands

```bash
npm run dev          # Vite dev server; writes go to the real Apps Script URL in .env (VITE_GAS_URL)
npm run dev:mock     # Mock data only (src/api/mockData.js) on 127.0.0.1; use this for UI checks
npm run build        # Production build
npm run lint         # ESLint
npm test             # node --test tests/*.test.mjs
node --test tests/read-api.test.mjs                       # single test file
node --test --test-name-pattern="<regex>" tests/<file>    # single test
```

`/api/read` does not run under `vite`; testing the real read API locally needs `vercel dev` with explicitly configured QA variables.

## Architecture

**Split read/write path.** This is the key thing to understand:

- **Reads** (page data, PIN/password verification) go to `POST /api/read` (`api/read.mjs`, a Vercel function). It calls the Supabase RPC `ketjeh_snapshot` with an action allowlist and the needed tables (`READ_TABLES`), then `server/read-model.mjs` filters, authorizes and shapes the result. It checks credentials on every protected request, redacts any field matching pin/password/credential/secret/token, and always responds `Cache-Control: no-store`. Server env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (never `VITE_`-prefixed).
- **Writes** (clock in/out, photo uploads, all admin mutations, sync status/manual sync) go to the Apps Script web app at `VITE_APPS_SCRIPT_URL` via `gasPost` in `src/api/client.js`. Pending writes carry an `operation_id` so an uncertain response can be retried safely (the retry receipt is stored in Supabase).

`server/read-model.mjs` is a read-only port of the Apps Script handlers. `tests/read-api.test.mjs` loads the real `gas/*.gs` files in a `vm` context and checks that both produce the same output. If you change read behavior in one place, change it in the other too.

**Apps Script backend (`gas/`).** `Code.gs` routes `doGet`/`doPost` by `action`. `Supabase.gs` holds `DATABASE_HEADERS` (the column schema for all 11 datasets), `DATABASE_ACTIONS` (the tables each action touches) and `databaseDispatch`. Script Property `DATABASE_MODE` = `sheets` | `supabase` decides whether handlers read real Sheets or a Supabase snapshot served through a fake `getSheetByName` (`databaseSheet`), so the legacy handlers in `Absensi.gs`/`Admin.gs`/`Dashboard.gs` work unchanged in both modes. Mutations are rejected while the snapshot reports `maintenance`. `Sync.gs` mirrors Supabase to Sheets and runs the backups/triggers; `Migration.gs` holds editor-only migration/rollback helpers. Deploy with `clasp` (`.clasp.json` is gitignored).

**Supabase (`supabase/migrations/`).** Server-only design: RLS is on with no policies, public grants are disabled, and access goes only through the secret key via `ketjeh_*` RPCs. `tests/supabase-sql.test.mjs` applies every migration to PGlite (with pgcrypto) and tests the RPCs against `DATABASE_HEADERS` from `gas/Supabase.gs`.

**Client read cache (`src/api/readCache.mjs`, `useRead.js`).** SWR 2.5.1 (pinned) with the default in-memory provider; nothing private is persisted. Cache keys include session generation, scope (`public` / `admin` / `employee:<id>`), WIB date, action and params, never credentials. Operational views poll every 30s while visible and reference data every 5 min, and nothing older than `MAX_AGE` (5 min) is shown. Writes, logout, employee switches and WIB midnight invalidate keys. Responses that arrive after a session change are discarded. `AUTH_REQUIRED` clears the credential and dispatches the `ketjeh-auth-expired` window event. Login can return the initial dashboard in the same response (`include_dashboard`), which is seeded via `seedDashboard`. See `docs/faster-page-loading.md`.

**Mocks.** `USE_MOCKS` in `client.js` requires `import.meta.env.DEV`, so demo data and demo credentials are dead-code-eliminated from every production build. `tests/production-bundle.test.mjs` builds with the mock flag forced on and asserts that no mock values appear. Keep any new mock-only code behind that same `DEV` gate.

**Roles and permissions.** The roles are admin, manager and employee. Feature access by job title (briefing, reservations) comes from comma-separated role lists in `Pengaturan`, read through `src/utils/permissions.js`. The `Jabatan` dataset is the single source of truth for the selectable job titles; see `docs/jabatan.md` before renaming or merging titles.

**Frontend.** `src/App.jsx` handles the employee flow: pick employee → PIN → dashboard. The session is stored in localStorage per WIB day without the PIN, which lives only in memory in `client.js`. `/admin` (`src/pages/AdminPage.jsx` + `src/pages/admin/*`) is the password-gated admin panel. `public/sw.js` is the service worker; API routes are excluded from both it and the SPA rewrite in `vercel.json`.

## Environments and operational constraints

- Production and QA each have their own Supabase project, Apps Script deployment and workbook. Vercel Production uses prod and Preview uses QA. `VITE_APPS_SCRIPT_URL` must match the environment. `VITE_QA_TIMING=true` (Preview only) enables `tests/browser-timing.js`.
- `docs/supabase-cutover-runbook.md` records the cutover/rollback procedure. Read it before touching production data, Apps Script deployments or Supabase schema.
- Backups, exports and the migration release record (resource IDs, backup file IDs, reconciliation evidence) live outside the repo in `../Absensi-backups/20261002-supabase-migration/`. Never commit exports, keys, PINs, passwords, OAuth state or live resource IDs.
- Test fixtures must be synthetic. Live QA writes go only to the QA project.
