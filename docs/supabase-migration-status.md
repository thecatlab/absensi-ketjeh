# Supabase migration implementation status

Updated October 2, 2026, evening WIB. **Not released.** Production remains Apps
Script v11 and Google Sheets. Migration branch is local `codex/supabase-migration`.
Do not treat passing local tests or the initial scheduled runs as release approval.

## Account and resources

- Verified owner: `restoketjeh@gmail.com`, **Ketjeh Seafood & Leisure** organization
  (`jlaqkwatcnxdpuoqahcw`), Free, Singapore projects.
- Production Supabase: **Ketjeh's Project**, `qqvuqjnpegnppmzmcuuw`. All three schema
  migrations applied and advisors report zero errors/warnings. Verified zero records,
  zero imported datasets, maintenance=true; no production import or cutover yet.
- QA Supabase: **absensi-ketjeh-qa**, `nrgutawmfptqnbxsftcv`. All three versioned SQL
  migrations applied. Public grants disabled; RLS enabled. Security and performance
  advisors both report zero errors/warnings. Informational RLS-without-policy notices
  are expected for this server-only design.
- QA Apps Script: `19teuElYKLA8pS3EYBSsEdP6c8pm6kT3mjnDH0cTNN3b_jHg9XHqT1fcL`.
  Restaurant OAuth, Drive upload, Sheets write, backup and trigger identity verified.
- QA API v6 deployment: `AKfycbw7qiuH78NtiLkAALwYR-d3cORnA3IEtN3QN8qDY_ZYNefwaqAZaBAvgEKzgOBBxK2V`.
  Includes the tested request handlers and editor-only rollback/source-capture helpers.
- QA workbook: `1a4kS7MdnvCtmBc1auB-Mg3uzG1P7CtzhPSLBZVXnQV8`.
- QA private backup folder: `1Bcu3kVS1peFaBE-sSHcaf-pt0DEb13ON`.
- QA synthetic photo folder: `1IgVNhRGkcsS4HoDC9Lc0AxdWlxioyZTI`.
- Supabase MCP still exposes the personal organization; do not alter restaurant
  resources through it until its connection is changed and verified.
- `clasp` 3.4.1 credentials are restaurant-owned. Vercel CLI 62.1.0 is logged out;
  browser Vercel access was previously authorized but release access needs verifying.

## Backups and exact reconciliation

Private directory, outside Git:
`/Users/nusaindah/Documents/Absensi-backups/20261002-supabase-migration/`

Contains full XLSX backups, typed/display/formula/format/note source manifests,
original live backend, encrypted database exports, private credentials/configuration,
QA scripts/results and screenshots. Retain these until user accepts QA. Never commit
exports, keys, PINs, passwords, OAuth state or the private QA setup script.

The QA copy captured at 19:19 WIB contained **2,254 records** across all 11 tabs:
Karyawan 42; FotoBriefing 20; TodoStatus 28; Todo 3; Reservasi 27; Pengumuman 0;
Absensi 2,052; Pengaturan 12; ShiftKhusus 0; AdminNotes 58; Jabatan 12.
Earlier morning backup had 2,042 attendance rows; production continued receiving
attendance. A fresh final backup/import is mandatory at actual cutover.

Source manifest file `1H8kDtz57Ck8CmML-_MP4KN39KM5MU9kz`, SHA256
`b029d44d6701368788980c8afe8691df7331e370bc45d25bfb17cba504885239`.
Every imported field, stable key, order and count matched. After workflow, credential
and concurrency QA, **all original 2,254 records still matched exactly** (data, order,
deleted state). Legacy duplicate TodoStatus IDs and blank clock-outs were preserved.
The isolated QA database additionally contains synthetic records, retained deletions
and an inactive QA catalog title; these must never be imported into production.

## Implemented and verified

- Generic record storage, dataset revisions, transactions, operation receipts,
  maintenance boundary, soft deletion, encrypted credential exports, hashed login,
  complete snapshots/import/export/restore, RLS and service-only RPC grants.
- Existing handler/API contract with central authorization. Private reads use POST;
  employee identity and role come from verified credentials. No Sheets fallback.
- Browser credentials remain in memory; retry IDs survive uncertain responses.
  Exact password-change retries recover their receipt after the old password expires.
- One-way typed Sheets diff, stable-row validation, literal strings, grid growth,
  post-write verification and deletion markers. Existing formats/notes and calculation
  tabs remain intact. `Aktif_` views exclude deleted records and support date arithmetic.
- Admin catalog, credential maintenance and sync/backup status. Catalog changes refresh
  employee/settings dropdowns immediately. A used job title cannot be deactivated.
- Private backups and five-minute sync/nightly backup triggers. Editor-only rollback
  preparation creates a new active-only workbook, retains the original mirror and
  database, verifies every projected cell, and never changes the live destination.

QA found and fixed single-digit legacy morning-hour parsing; insufficient copied Sheet
row capacity; text dates breaking calculations; date serial primary-key comparison;
credential-change retry after response loss; and stale catalog options after edits.

## QA evidence

- **40 automated tests**, lint, production build and diff checks pass. Tests cover
  actual PostgreSQL via PGlite/pgcrypto, exact restore, grants, transaction rollback,
  duplicate submissions, midnight retry, Drive failure and photo reuse after DB failure.
- Deployed API: public Supabase key denied all five tables and auth RPC; anonymous
  private reads/mutations denied. Employee/admin/manager and configured reservation/
  briefing role checks exercised. Wrong PIN is denied via `verified:false`.
- **26 final deployed v6 permission/read checks passed**, including all manager read
  routes, forbidden employee/admin access, admin-only manager denials, forged identity,
  wrong credentials, old-client notices and current healthy sync status.
- Real QA workflows: clock in/out, photos, GPS/notes, tasks, briefing, reservations,
  announcement editing/status/deletion, shifts, admin notes, reports and employee
  creation. Only synthetic QA entities were deactivated or soft-deleted.
- **14 credential checks passed**, including leading-zero PIN, changed admin/manager
  passwords, expired old login, lost-response retry, private export/sync, and restoring
  original credentials.
- **13 final/concurrency checks passed**: two simultaneous employee creations got
  distinct IDs; different concurrent clock-ins produced exactly one row; simultaneous
  task completion produced one status; original source records remained unchanged.
- Browser: employee PIN and history; mobile 390×844 clock-in/out using a synthetic
  camera and fixed QA GPS; admin settings; canonical Jabatan options including Bartender;
  immediate catalog activation/deactivation refresh, history/reservation error-and-retry;
  old dashboard's visible reload notice; real service-worker cache transition from
  `absensi-ketjeh-v1` to `absensi-ketjeh-v2-supabase`. Physical iPhone installation has
  not been tested; camera/GPS were simulated, not captured from an employee.
- Sheets: all 11 datasets verified after QA; 42,332 original cells' formats/formulas/
  notes and extra cells retained; deliberate drift repaired; owner formulas and notes
  unchanged; all active counts and numeric date tests passed.
- Actual encrypted **2,271-record** QA backup restored into isolated local PostgreSQL
  with all three migrations: records, credentials, dataset metadata and receipts exact;
  employee/admin login works; restore stays in maintenance. A subsequent isolated
  employee creation allocated the next unused ID and committed successfully.
- Rollback rehearsal completed at 20:27 WIB: new workbook
  `11euI2_SzhGLILnb7_qwyRd-qy2QXtnAT_-65FxyP-Jw`, 2,265 active records, six deleted
  records retained in Supabase/backup. Legacy login, attendance and active-list counts,
  owner formula/note preservation, and write pause passed. QA original destination and
  Supabase mode restored in a finally block.
- Three read-only timing samples: employee-list median 3.182s on production Sheets,
  2.453s on QA Supabase. Small sample and different deployments; not a claim that all
  actions are faster. Drive upload and Apps Script latency still apply.

Private evidence files retain first-run failures as well as fixes. `qa-api-checks.json`
has an initial harness assertion error (it checked success instead of verified for
wrong PIN); corrected result is in `qa-final-checks.json`. `qa-workflows.json` retains
the initial grid-capacity sync failure; subsequent complete sync verification passed.
The first rollback helper checked the wrong owner cell A1; corrected A2 rehearsal
passed. Do not rewrite these as if the first runs passed.

## Scheduled trial and remaining release work

The logged five-minute trial started **2026-10-02 20:09:04 WIB**. The nightly backup
runs in the 02:00 WIB hour. Earliest full 24-hour assessment: **October 3 after 20:09 WIB**.
A fresh manual backup at start was verified (2,265 records). Trial logs are stored as
QA-only Script Properties; `reportQaSoak` writes a private evidence file. At 20:39 WIB,
seven actual scheduled runs passed, zero failed, maximum runtime 9.499s. This is only
the first half-hour, not the 24h gate. Latest evidence file:
`1iuVlbkQ9iBS1hxJ6c_Jn8HX9SU4Aj-_m`. Record every
failure, successful recovery, runtime/quota headroom and actual nightly backup.
The short rollback drill temporarily paused QA writes only; examine overlap logs.

Still required:
1. Observe the complete 24h trial and real nightly backup; verify backup contents and
   timing, sync cadence/recovery and quota headroom. Do not substitute manual runs.
2. Retain the device-specific limits above: browser failure/retry, catalog refresh,
   restored ID allocation and final deployed permission/read checks now pass. Physical
   employee-device observation remains part of the production follow-up.
3. Complete restaurant production configuration and required Google authorization;
   verify Vercel ownership/release access. Keep production on Sheets during preparation.
4. Execute the maintenance cutover runbook after closing with a fresh backup and exact
   final reconciliation. Publish paired frontend/backend and verify real production
   reads; no synthetic production attendance.
5. Push GitHub and attach the migration PR only after release gates pass; verify latest
   deployed commit, ongoing sync and a real employee submission. No production migration
   or GitHub migration push has happened yet.

A follow-up scheduling question is pending with the user. No Codex follow-up automation
has been created. The Google QA sync/backup triggers run independently of this chat.
