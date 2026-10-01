# Supabase migration implementation status

Updated October 2, 2026. Work in progress; production is still on Apps Script v11
and Google Sheets. Do not treat local tests as a release approval.

## Account and resources

- Verified browser account: `restoketjeh@gmail.com`, organization owner.
- Free organization: **Ketjeh Seafood & Leisure** (`jlaqkwatcnxdpuoqahcw`).
- Restaurant production project: **Ketjeh's Project** (`qqvuqjnpegnppmzmcuuw`), Singapore.
- Separate QA project form: `absensi-ketjeh-qa`, Singapore, automatic public table
  grants disabled, automatic RLS enabled. Last observed: password filled but form
  not submitted. User has been asked to click Create new project.
- QA Apps Script created under the restaurant account:
  `19teuElYKLA8pS3EYBSsEdP6c8pm6kT3mjnDH0cTNN3b_jHg9XHqT1fcL`.
  Initial sources pushed, not deployed. `setupQaResources` awaits Google authorization.
  Recopy the current repository sources into the private QA checkout and push after
  setup; later local fixes have not yet been pushed to the QA editor.
- Supabase MCP connector still exposes the personal organization; do not use it to
  create or alter restaurant resources until that connection is changed/verified.
- Existing clasp credentials ARE restaurant-owned. Use pinned
  `npx --yes @google/clasp@3.4.1`. `show-authorized-user` verified the identity.
  Direct Sheets API with these credentials returned 403; do not assume Sheets scopes.

## Preserved backups

Private directory (outside Git):
`/Users/nusaindah/Documents/Absensi-backups/20261002-supabase-migration/`

Contains the complete fresh XLSX, source cell JSON, row counts, checksum manifest,
live backend clone including its clasp configuration, and a separate QA backend
checkout. Credentials, OAuth files, and database exports must remain outside Git.

Fresh source counts: Karyawan 42, FotoBriefing 20, TodoStatus 28, Todo 3,
Reservasi 27, Pengumuman 0, Absensi 2042, Pengaturan 12, ShiftKhusus 0,
AdminNotes 58, Jabatan 12. These are development baseline counts, not cutover counts.

## Implemented locally

- Versioned SQL schema with row order, dataset revisions, soft deletion, transaction
  receipts, encryption for private credential exports, hashed login credentials,
  import/export/restore RPCs, RLS and private grants.
- Apps Script request adapter retaining the existing handlers and response fields.
  Supabase mode is explicitly configured; there is no automatic Sheets fallback.
- Server authorization for private reads, employee identity, assigned to-dos,
  briefing roles, admin versus manager, and reservation permissions.
- Frontend passes existing in-memory credentials and retains operation IDs across
  failed writes; secrets are not placed in URLs or localStorage.
- Sheets diff/repair with stable ID checks, literal RAW writes, preserved formatting
  and notes, post-write verification, soft-delete markers and active calculation tabs.
- Private backup, trigger installation, editor-only capture/import/reconciliation.
- Admin catalog, credential changes, manual sync, and sync/backup status UI.

## Verified locally so far

- Existing 15 baseline tests pass.
- Nine Apps Script/storage/sync tests pass, including 2050-row sync and preservation
  of legacy duplicate TodoStatus records.
- Four actual PostgreSQL tests (PGlite with pgcrypto) pass: complete import/export,
  encrypted restore, leading-zero PINs, grants/RLS, duplicate import rollback,
  transaction atomicity, receipts, revision conflicts and retained deleted rows.
- Four client tests pass: authenticated POST reads, retained retry IDs, separated
  employee/admin credentials and rejection of malformed attendance responses.
- All 32 tests, frontend build, lint and diff checks pass.

The existing production server key was read from its owner dashboard, saved only
in a private `.local` file outside Git, and verified with a read-only REST request
(HTTP 200). No production tables have been created or imported. No key was added to
frontend code. The browser Google authorization warning is awaiting user completion.

## Remaining release work

1. Complete QA project creation and Google QA authorization; save IDs/config privately.
2. Run QA setup to create a copied workbook, private backup folder and synthetic
   photo folder. Capture the full display/type/formula/format source manifest.
3. Finish review of input validation, Drive retry/folder concurrency, settings
   maintenance coverage, encrypted key backup and old/PWA client behavior.
4. Apply SQL to QA, configure server properties, import/reconcile every source value,
   deploy QA API and test deployed Google/Supabase identity and permission paths.
5. Test employee/admin workflows in browser, concurrency and response-loss behavior,
   real Sheets changes, deletion calculations, owner formulas/notes and restore.
6. Observe at least 24h of actual scheduled QA including a nightly backup. Record
   timings, quota headroom, sync drift/failure recovery and performance versus v11.
7. Implement/rehearse maintenance cutover and rollback. Refresh production backup,
   reconcile the final delta, then enable a single write destination after closing.
8. Publish verified frontend/backend, push GitHub, attach the PR and verify production.
   Do not claim migration/deployment completion while these remain open.
