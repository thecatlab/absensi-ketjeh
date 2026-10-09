# Supabase migration plan review

Reviewed 2026-10-01 against repository commit `70ee12c`, the October 1 database
backup, previously captured live Apps Script sources, and current provider docs.
This is a design review, not certification of an implemented migration. No live
database, deployment, account, permission, or application code was changed.

## Verdict

The architecture is viable. Incorporate the corrections below before implementation
and pass the release gates before switching production. The measurable migration
target is zero unexplained missing or changed source values, together with unchanged
legitimate employee/admin workflows. Indefinite zero data loss and zero provider or
authorization outages cannot be guaranteed by the proposed Free-tier architecture.

Preserve the user's decisions: restaurant-owned Supabase organization, Free initially,
existing workbook, five-minute one-way sync, separate calculation tabs, existing
Drive photos, private credential copies in Sheets, and a brief after-closing cutover.

## Evidence from the current system

- The saved workbook contains 11 data tabs, 42 employees, 2,039 attendance records,
  28 to-do completion records, 27 reservations, 58 admin notes, and 20 briefing photos.
- Attendance includes 117 records without clock-out values. Preserve these blanks;
  do not interpret them as corrupt rows, invent clock-out times, or recalculate history.
- Two completion records share an employee/task/date. Their IDs are distinct. The
  existing code reads and updates the first matching row; preserve both and that order.
- No missing employee/task references were found in this snapshot. Repeat the check
  on the final live export; counts here are a baseline, not cutover assertions.
- All 15 existing tests pass. These cover the existing Jabatan/role changes, not the
  Supabase migration, scheduled sync, credential conversion, or recovery procedure.

## Required corrections

### 1. Verify complete data, not just row counts

Create an immutable source manifest with every tab, header, stable key, original row
order, value/type, and formula. Compare all source fields with their migrated values
using explicit normalization for Sheets dates, booleans, blanks, and display strings.
Preserve original representations in the migration archive. Preserve leading-zero
PINs, decimal durations, historical names, IDs, notes, and every photo URL.

All imports, reports, backups, and sync reads must fetch complete result sets using
deterministic pagination or an explicitly complete snapshot export. Never infer
completeness from an HTTP success response. Fail on unexpected schema changes,
unmapped columns, duplicate IDs, truncation, or unexplained differences; do not skip
or automatically repair records. Do not impose a new uniqueness rule that discards
the existing duplicate completion records.

### 2. Preserve the API contract and close authorization gaps together

The visible workflow remains employee selection/PIN, photo/GPS/submit, and the existing
admin/manager login. Employees do not need Google or Supabase accounts. Preserve API
action names, response fields/types, date formatting, role rules, and session behavior.

Current `handleSetTodoStatus` and `handleUploadFotoBriefing` do not authenticate the
caller on the server, and their frontend calls omit credentials. Some private GET
reads are also unprotected. Update both API and frontend in the same release: forward
the already-verified in-memory employee credential, derive identity/role from the
database, enforce task ownership/eligibility and configured briefing roles, and use
authenticated requests for private reads. Do not add an extra login to each action.
Keep PINs/passwords out of URLs, logs, and public responses. Test admin-login roles
separately from employee job titles with the same names.

Protect direct Supabase access with grants and RLS, but enforce authorization in
Apps Script too: privileged server keys bypass RLS. Limit privileged RPC permissions,
reject untrusted field updates, and never expose database/encryption keys to the
browser, Sheets, or Git. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Credential hashing and encrypted export copies must round-trip to the exact existing
login values, including leading zeros. Back up the encryption key privately and test
restoring it. Test an employee PIN change and admin/manager password change through
login, the next Sheets sync, and recovery. Preserve the existing restricted workbook
sharing; do not broaden access to accommodate the exporter.

### 3. Validate each execution identity and real permission path

Verify `restoketjeh@gmail.com` owns the new organization, creates production triggers,
and deploys the web app. Authorize its required Sheets, Drive, and external-request
scopes before cutover. Confirm the same deployed endpoint can read/write Supabase,
create a photo, publish its existing-style image URL, update Sheets, and create a
private backup. Also observe an actual scheduled sync and backup under that identity.
Installable triggers run as their creator, independently of the person opening the
workbook. [Google trigger documentation](https://developers.google.com/apps-script/guides/triggers/installable).

Use separate QA Supabase, Apps Script, workbook, and photo-test resources. Capture all
live source files before migration: the live briefing upload uses the configured
photo folder, while the repository has a hardcoded briefing folder. Preserve the
observed production behavior when creating the migration baseline.

### 4. Replace operational edits that currently depend on Sheets

One-way reporting means editing a synced Sheet no longer changes the app. Add
admin-only controls for current Sheet-only maintenance, including Jabatan catalog
changes and credential/settings maintenance, before enabling overwrite sync. Keep
ordinary staff workflows unchanged; explain this intentional owner/admin change.

Soft-deleted data must remain recoverable without appearing in active app lists or
inflating report/calculation totals. Test owner calculations against the deletion
marker and provide an active-record calculation source. Preserve manual calculation
tabs, formatting, and notes. Validate that raw data rows and columns have not moved
during a sync; do not overwrite an ambiguous mapping.

### 5. Make retries, sync, and cutover safe under failure

Use a stable operation ID and database transaction for writes. A retry after a lost
response must recover the original committed result and timestamp. Concurrent
clock-ins, clock-outs, employee creation, and to-do updates must not duplicate or
partially overwrite data. Photo upload and database commit are separate operations:
record/reconcile uploaded files across retries, require the expected photo before
success, and do not automatically delete uncertain files.

Use a consistent Supabase snapshot for each sync. Preserve literal text as text
rather than interpreting user notes as spreadsheet formulas. Validate source and
destination counts, apply only mapped differences, and advance the successful-sync
checkpoint only after verifying writes. Prevent overlapping syncs without blocking
attendance operations. Five minutes is a scheduling target, not a guaranteed maximum
delay; show stale status and recovery errors.

Measure sync/backup runtime and total API traffic against the Gmail account's shared
quotas with headroom. A five-minute schedule produces 288 runs/day; the published
consumer trigger runtime budget is 90 minutes/day and URL Fetch budget is 20,000/day.
Avoid per-cell network calls and unbounded full-workbook rewrites.
[Google quotas](https://developers.google.com/apps-script/guides/services/quotas).

The write pause must be enforced by every server mutation route. Drain requests that
started before the pause, stop operational Sheet edits, capture the final export,
reconcile, switch the single write destination, verify, then reopen. Test clients
already open during deployment and the installed PWA; handle an outdated client
explicitly rather than failing legitimate actions silently.

After the first Supabase write, do not simply switch back to the older Sheet backend.
Pause writes again and reconcile all post-cutover changes before rollback. A failed
Supabase write must not silently fall back to Sheets and create two sources of truth.

### 6. Define backup and recovery limits honestly

Backups must restore application data, schema, constraints, functions, grants/RLS,
ID allocation state, configuration, and encrypted credential data with its separately
protected key. Preserve Drive media and inventory; a database backup containing photo
URLs is not a backup of the image files. Retain the pre-migration workbook and live
backend sources until the user accepts QA; no automatic purge.

Nightly backups have a recovery point at the last successful backup, potentially
losing changes since then after a catastrophic primary loss. A five-minute reporting
mirror reduces some exposure but is not a complete transaction history or restore
backup. Free-tier pausing, quotas, service failures, and revoked authorization remain
availability risks. Detect failures visibly and test recovery; do not label this
architecture as guaranteed zero-loss or always available.

## Production release gates

All gates must pass and have saved evidence before cutover:

1. Fresh, complete source backup; restore rehearsal into isolated QA succeeds,
   including credential validation and ID generation after restore.
2. Exact record/field reconciliation for all tabs, with zero unexplained omissions
   or changes; compare report totals and preserve every legacy exceptional record.
3. End-to-end QA for employee PIN/login, clock-in/out with photos/GPS/notes, history,
   briefing upload, todo completion, reservation permissions, admin and manager
   access, catalog/employee/settings changes, shifts, notes, and reports.
4. Positive and negative authorization tests for each route: valid roles succeed;
   missing/wrong credentials, forged employee/role IDs, and unauthorized mutations fail.
5. Clock/ID concurrency, lost responses, repeated retries, midnight/date boundaries,
   retained blank clock-outs, and partial photo/database failure tests pass.
6. At least 24 hours of QA scheduled execution, including multiple syncs and a real
   nightly backup, passes; failures/retries and quota headroom are recorded.
7. Manual calculation/formula preservation, correct active-record totals, credential
   sync confidentiality, stale status, and partial-sync repair are verified.
8. Cutover and rollback rehearsals preserve writes around the transition, including
   open browser/PWA clients. Production synthetic tests must not create fake attendance.

Only then release and perform read-only production reconciliation plus observation
of real use. Existing unit tests passing alone are not sufficient for migration QA.
