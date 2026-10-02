# Supabase migration implementation status

Updated October 2, 2026, 21:58 WIB. **Released.** Production uses Apps Script v12
and restaurant-owned Supabase. Google Sheets is the reporting mirror. The migration
branch `codex/supabase-migration` is pushed, with GitHub PR #3.
On October 2, the user explicitly approved **release today after fresh checks**,
overriding the planned 24-hour waiting gate. Fresh backup, complete reconciliation,
paired deployment and production verification are still required.

## Account and resources

- Verified owner: `restoketjeh@gmail.com`, **Ketjeh Seafood & Leisure** organization
  (`jlaqkwatcnxdpuoqahcw`), Free, Singapore projects.
- Production Supabase: **Ketjeh's Project**, `qqvuqjnpegnppmzmcuuw`. All three schema
  migrations applied and advisors report zero errors/warnings. All 2,254 source records
  across 11 datasets imported and reconciled exactly. Maintenance=false; writes opened
  at 2026-10-02T14:58:46Z after paired frontend/backend verification.
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
  browser Vercel access verified and production release completed.

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

## Production release evidence

- User approved release today after fresh checks, waiving the 24-hour waiting gate.
  Fourteen scheduled QA runs had passed at 21:17 WIB, zero failures, maximum 9.499s.
  The real nightly backup has not yet been observed; it is not described as tested.
- Fresh local XLSX at 21:18 WIB: 2,254 records, 2,052 attendance rows. Every cell and
  formula matched the untouched QA source. Production writes paused at 21:29:18 WIB;
  a six-minute drain and execution-log check preceded the final capture.
- Final complete source manifest: `1mZeqZqCo4uLnkCowFSjidZeaRjpYVjHI`, SHA256
  `dcf94973036d83cc52a8bd302011aed7c14d4d8445db2530af50ec58d0c5b588`.
  Final workbook copy: `1Gazri7A_8A37u3igaH7fL_5euvUjSY9Q0yj5W8kzk4w`.
  Original workbook, extra cells, formats, formulas, notes and source files retained.
- Import completed at 21:42 WIB. Every field, ID, order and count reconciled. A second
  comparison against the original QA source also found zero differences. No QA fixtures
  were imported and no synthetic production attendance was created.
- Actual production encrypted backup restored into isolated PostgreSQL: all 2,254
  records, credentials, dataset metadata and receipts matched; employee/admin login,
  maintenance state and next-ID allocation/commit passed. Local tested-backup SHA256:
  `3dcf98f076a898aa2c5b656aaf4ca0989670ae7645316c3b2bf88f16f569af22`.
- Private restaurant backup folder: `1pjo4ZeM2DCWd3wvby5OBEM1ox_KJjKaJ`. Verified Drive
  database backup at 21:51 WIB: `1vV3IDLbwfrFmtiaVxne4-WA4hFb1efcS`, 2,254 records.
  Keys, original settings, final configuration and local snapshots are outside Git.
- Recursive archive inventory contains 4,082 files. 4,009 of 4,010 database photo links
  map to those files. **One historical briefing photo was already unavailable before
  migration**: the same URL exists in untouched backups, and Google Drive reports that
  the file does not exist. Its database record and URL remain unchanged. Private
  investigation evidence records the exact row; this is not new migration data loss.
- All 11 Sheets datasets verified after projection; active calculation views created.
  Five-minute sync and nightly 02:00 WIB backup triggers installed as the restaurant.
  First automatic production sync at 21:53:31 WIB passed in 3.884s with zero differences.
- **30 deployed production read/login/authorization/backup/sync checks passed**.
  Existing employee PIN opens dashboard/history against Supabase. K041 remains Bartender.
  Old clients receive a reload notice. Live JavaScript targets the production backend,
  contains no Supabase server key or QA endpoint, and serves the v2 service-worker cache.
- Initial production deployment: `dpl_E4JWUsL6KFEACLrPEiTRgo34qeER`, commit `41f5f64`.
  Release-documentation updates are deployed from the same tested application code.

Retain backups until user accepts QA. Physical iPhone camera/GPS behavior and the first
real nightly backup remain follow-up observations. Isolated browser camera/GPS, actual
QA saves, retry protection, restore, permissions and sync checks passed. A real employee
submission after reopening has not been observed; do not manufacture one to claim it.
No Codex follow-up automation was created. Google sync/backup triggers run independently.
