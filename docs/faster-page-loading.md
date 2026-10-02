# Faster reads and navigation

Page reads and PIN/password verification now use `POST /api/read` on the existing Vercel project, in `sin1`. The endpoint calls the existing Supabase snapshot RPC with an explicit action allowlist and the required datasets. Credentials are checked on every protected request. All calendar calculations in this endpoint use Asia/Jakarta.

Attendance, photo uploads, other mutations, sync status, and manual synchronization retain the existing Apps Script endpoints. No database schema, records, photo locations, or synchronization jobs are changed by this release.

## Cache behavior

- SWR is pinned to 2.5.1. Its default in-memory provider is used; private responses and credentials are not persisted.
- Public bootstrap shares active employees, public settings, and active Jabatan. Successful logins can prime their initial dashboard in the same response.
- Private cache keys include the session generation, employee/admin scope, date in WIB, action, and query filters. They contain no PIN/password.
- Operational views refresh every 30 seconds while visible, on return, focus, and reconnect. Reference data refreshes every five minutes. Responses older than five minutes are not displayed.
- Failed refreshes retain younger data and display an Indonesian warning and retry button. Authorization failures clear the private session. Logout, employee changes, and midnight WIB invalidate the applicable content.
- Confirmed writes invalidate dependent views and make earlier requests obsolete. Existing operation IDs and uncertain-response retry handling are unchanged.
- API responses use `Cache-Control: no-store`; API routes are excluded from the SPA rewrite and service worker.

## Deployment configuration

Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server-only Vercel variables. Never prefix these with `VITE_`. Production uses the restaurant production project; Preview uses the isolated restaurant QA project. `VITE_APPS_SCRIPT_URL` must point to the matching environment's existing Apps Script deployment.

`VITE_QA_TIMING=true` is enabled only in Preview. It includes a small measurement helper that publishes anonymous durations into a DOM attribute for QA; it records no credentials or page content and writes no persistent storage or network logs. The helper is absent from the production bundle. Use `npm run dev:mock` for local mock data; use `vercel dev` with explicitly configured QA variables when testing the real API locally.

## Verification on 2 October 2026

- 61 automated tests pass, plus lint and production build.
- All 58 live QA response comparisons match the previous backend, including admin/manager/employee permissions, unauthorized reads, inactive employees, ordering, date filters, reports, and credential redaction. Every new response has `no-store`.
- 42 QA workflow checks pass: employee edits, PIN changes and restoration, inactive login rejection, photo attendance, retry receipts, tasks, briefing photos, reservations, announcements, notes, shifts, and Sheets reconciliation. Every record present before these tests remained unchanged; new fixtures stayed in QA.
- Browser checks cover employee login, dashboard, history, reservations, switching, all admin tabs, confirmed note saves, logout, changed-PIN rejection, and stale-data warnings. Synthetic photo/GPS clock-in and clock-out use the unchanged submission backend. No personal camera image or real location was captured.
- Hook tests cover simultaneous deduplication, expired content, hidden polling, focus/reconnect, other-device refresh and reconnect recovery, midnight rollover, and responses arriving after a save/session change.
- A pre-existing development-only React warning occurs during the attendance success countdown (`SuccessScreen` calls navigation inside a state updater). The screen completes correctly; `ClockPage` is unchanged by this loading work.

### Measured acceptance results

Same Mac and connection, authenticated QA preview. Initial samples are full page reloads with normal browser asset caching and fresh in-memory app data. API samples include network time. Cached navigation measures click to rendered content plus two animation frames inside the page, excluding browser-control transport overhead. Photo/submission speed is outside these targets.

| Measure | Samples | Result | Target |
| --- | ---: | ---: | ---: |
| Initial usable screen | 20 | median 411 ms | median <2,000 ms |
| Bootstrap read | 20 | p95 307 ms | p95 <1,500 ms |
| Employee login + dashboard read | 20 | p95 402 ms | p95 <1,500 ms |
| Employee dashboard read | 20 | p95 404 ms | p95 <1,500 ms |
| History read | 20 | p95 493 ms | p95 <1,500 ms |
| Admin dashboard read | 20 | p95 405 ms | p95 <1,500 ms |
| Report read | 20 | p95 530 ms | p95 <1,500 ms |
| Cached dashboard return | 20 | p95 45 ms | p95 <200 ms |
| Cached history return | 20 | p95 46 ms | p95 <200 ms |
| Cached reservations return | 20 | p95 45 ms | p95 <200 ms |

These are measured QA results, not a guarantee for every device or connection. The final correctness preview is `dpl_7LASp4ZhvoUbjjJLLTjg3SHbFFq7`.

## Backup and rollback

Before release, a full production export was captured at 23:34:18 WIB on 2 October 2026: 11 datasets, 2,254 records, 44 encrypted credential records, plus operation receipts/control metadata. SHA-256: `8ed7d0bb3734dba5b2a5a62bbb61f2511179d6095568139bc099f986093af1cf`.

The backup is retained locally outside Git in the protected `Absensi-backups/20261002-supabase-migration/fast-read-release` folder. It was restored into an isolated, in-memory PostgreSQL instance. Dataset/record/credential/receipt content matched exactly, and restored admin and employee authentication passed. Production was not written during that verification.

Retain frontend deployment `dpl_8otf1UUY9p656KSTfcqudqvZ6as9` (commit `6f8042c`) and both existing Apps Script endpoints. Rollback promotes that frontend deployment and leaves the live Supabase database and five-minute Sheets synchronization intact. Do not restore or overwrite the database to roll back this frontend/read-API release.
