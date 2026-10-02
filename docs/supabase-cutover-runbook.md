# Supabase cutover and rollback

Use only after the release gates in `supabase-migration-review.md` pass. The restaurant
account owns both databases, Apps Script deployment, Drive media and scheduled triggers.
Credentials/configuration stay in private files and Script Properties, never Git.

## Before the maintenance window

1. Verify the exact release commit, 24-hour QA/backup evidence, private key backup,
   restore and rollback rehearsal. Apply all ordered SQL migrations to the empty
   restaurant production project; confirm RLS/private grants/advisors and maintenance.
2. Preserve current Vercel deployment, complete live Apps Script sources/manifest and
   all Script Properties privately. Save a full workbook copy/XLSX and Drive photo
   inventory. Keep the original files and sharing unchanged.
3. Prepare production properties: SUPABASE_URL, SUPABASE_SECRET_KEY,
   CREDENTIAL_EXPORT_KEY (at least 32 characters), private DATABASE_BACKUP_FOLDER_ID,
   correct SPREADSHEET_ID. Keep DATABASE_MODE=sheets. Do not copy ENVIRONMENT=qa or
   QA_PHOTO_FOLDER_ID into production. Use the restaurant's existing photo folder.
4. Authorize the final Apps Script scopes as the restaurant account. Publish the
   maintenance-aware backend to the existing stable deployment URL, execute as the
   restaurant owner. Keep its Sheets mode and old frontend until cutover.
5. Prepare the verified new frontend using the production endpoint. New authenticated
   POST reads require Supabase mode; this is a paired frontend/backend release.

## Cutover after closing

1. Set Sheets-mode MAINTENANCE=true and confirm a mutation is rejected without changing
   data. Stop operational manual Sheet edits. Wait at least the maximum Apps Script
   execution duration (six minutes) for already-started legacy writes to drain; examine
   executions. Keep this wait distinct from database mode switching.
2. Capture a fresh full workbook backup and `captureMigrationSource`. Its checksum and
   exact counts are the cutover baseline. Fail on any unexpected named column, blank/
   duplicate key or unmapped operational field. Preserve extra owner cells in the archive.
3. Run `importMigrationSource` against the empty production database in maintenance.
   Require `reconcileMigrationSource` to pass every field/order/count. Compare historical
   report totals, blanks, duplicate completion IDs, PINs and media URLs.
4. Set DATABASE_MODE=supabase while database maintenance remains true. Verify employee
   and admin read/login paths, manual Sheets sync, `Aktif_` views and private backup.
   Deploy the matching frontend. Confirm its release hash and production endpoint.
5. Open database writes by changing ketjeh_control.maintenance=false only after the
   paired release is verified. Install production sync/backup triggers under the
   restaurant account. Verify old-client reload notice and the updated PWA cache.
6. Reconcile production read-only, observe the next actual employee submission and
   scheduled sync. Retain backups and rollback resources until the user accepts QA.

## Rollback after any Supabase write

Never point the old backend at a stale mirror or merely toggle DATABASE_MODE.

1. Set Supabase maintenance=true. The database control lock makes this boundary atomic
   with commits. Drain Apps Script/Drive activity; preserve the latest encrypted export,
   current source/mirror, credentials key, operation receipts and media inventory.
2. Run `buildRollbackWorkbook` from the editor. It requires paused Supabase writes and
   a private backup folder. It creates a NEW copy, projects every active record into
   the legacy schema and verifies every value. Deleted records stay in the frozen
   database and full backup, but do not reappear in active legacy lists.
3. Verify credentials, attendance/report totals, post-cutover additions/edits, active
   lists, ID allocation and owner calculation tabs in that copy. The helper does not
   switch the live destination. Keep writes paused if any check fails.
4. Remove only the production migration's sync/backup triggers (record their IDs),
   retaining all data and backups. Point SPREADSHEET_ID at the verified rollback copy,
   set DATABASE_MODE=sheets and MAINTENANCE=true, and restore the recorded old frontend.
   Use the maintenance-aware backend: v11's hardcoded workbook cannot select this copy.
5. Verify the paired legacy frontend/backend while paused, then set MAINTENANCE=false.
   Keep Supabase frozen. New writes now belong exclusively to the rollback workbook.
   Future forward migration must reconcile those new writes; never reuse an old snapshot.

Rollback preserves data but may require a longer pause than the planned initial
cutover. If either latest data or credentials cannot be recovered completely, keep
maintenance enabled and report the exact gap instead of claiming lossless rollback.
