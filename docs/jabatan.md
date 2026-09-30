# Jabatan master list

The `Jabatan` tab in the attendance spreadsheet is the source of truth for
selectable job titles. Its columns are `jabatan` and `aktif` (`TRUE`/`FALSE`).
`Karyawan.jabatan` remains the source of truth for each employee's assignment.
The seed TSV and mock catalog are development fixtures, not production catalogs.

To add a position, append its exact title and `TRUE` in `Jabatan`, then reopen the
Karyawan page. To retire a position, set its `aktif` cell to `FALSE`. Existing
assignments remain visible and can be saved unchanged; new or changed assignments
must use an active master title. Do not rename employee titles or merge aliases
as part of maintaining the catalog without reviewing their effects on role-based
reservations, tasks, and announcements.

The initial master list preserves all live employee titles and the previous
frontend choices. No existing employee or attendance rows are migrated.
The admin employee screen loads inactive employees through authenticated POST
`getAllEmployees`; public employee selection and existing report/task consumers
continue to use the existing active-only GET `getKaryawan` endpoint.

## Validation

Run `npm test`, `npm run lint`, and `npm run build`. Use `npm run dev:mock` for
add/edit QA without writing to the live workbook. Verify Bartender can be selected,
existing titles remain selected when editing, blank PINs preserve credentials,
and unknown/inactive titles cannot be newly assigned. A failed or empty catalog
shows an error and disables adding employees, with a retry action.

After deployment, check the live catalog and existing report, reservation,
task, and note reads. Do not create production test records. Compare every
pre-existing tab's cell values and formulas with the pre-change export.

## Release and rollback

1. Export the entire workbook locally and save its checksum; also back up all
   live Apps Script source files and record the current frontend deployment and
   backend version. Retain these backups until the user confirms QA is complete.
2. Add only the separate `Jabatan` tab with the headers and current valid titles.
3. Deploy only `gas/Admin.gs` and `gas/Code.gs` changes to the existing Apps Script
   project. Preserve other live source files and the endpoint URL.
4. Verify `getJabatan` and authenticated `getAllEmployees`, then QA the frontend
   preview against that endpoint before promoting it to production.

The release branch is based on `codex/local-dev-safe` commit `918fbd6`, the
frontend commit observed in production, to preserve features absent from `main`.

For rollback, restore the previous frontend deployment and select the previous
Apps Script version on the existing deployment (version 9 before this change).
The additive `Jabatan` tab can remain. Never delete tabs, replace the entire live
workbook, or restore older data over new operational records without approval.
Workbook exports retain linked media URLs; media files remain in Google Drive.
