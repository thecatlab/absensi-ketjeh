# Jabatan master list

The `Jabatan` tab in the attendance spreadsheet is the source of truth for
selectable job titles. Its columns are `jabatan` and `aktif` (`TRUE`/`FALSE`).
`Karyawan.jabatan` remains the source of truth for each employee's assignment.
The seed TSV and mock catalog are development fixtures, not production catalogs.

To add a position, append its exact title and `TRUE` in `Jabatan`, then reopen the
relevant page. Karyawan, To-do, Pengumuman, and permission settings all load this
active catalog; they do not construct their own job-title lists. To retire a
position, set its `aktif` cell to `FALSE`. Existing
assignments remain visible and can be saved unchanged; new or changed assignments
must use an active master title. Do not rename employee titles or merge aliases
as part of maintaining the catalog without reviewing their effects on role-based
reservations, tasks, and announcements.

The approved catalog is Admin, Barista, Bartender, Captain Floor, Cashier, Cook,
Head Chef, Kitchen, Manager, Purchasing, Security, and Waiter/Waitress.
The approved normalization maps exact Chef to Cook, Kasir to Cashier, and Waitress
to Waiter/Waitress; Head Chef stays unchanged. Delivery and Maintenance are removed
from the catalog. K041's current assignment is Bartender.

Before applying these rules, a fresh full workbook export was retained locally.
The live change updated 14 Karyawan job-title cells and renamed the reservation
permission from Manager,Kasir to Manager,Cashier so access stays with the same
staff. There were no employees assigned Delivery or Maintenance. Existing task
and announcement targets required no edits. All other Karyawan cells and all
attendance, reservation, task, completion, announcement, briefing, shift, and
admin-note cells/formulas were compared and preserved.

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
tab's cell values and formulas with the pre-change export, allowing only the
approved catalog, employee-title, and role-setting changes.

## Release and rollback

1. Export the entire workbook locally and save its checksum; also back up all
   live Apps Script source files and record the current frontend deployment and
   backend version. Retain these backups until the user confirms QA is complete.
2. Maintain the `Jabatan` catalog. For an approved rename, change only relevant
   employee job-title cells and matching role tokens in Todo/Pengumuman targets or
   Pengaturan permissions. Preserve employee IDs, PINs, history, and unrelated
   fields. Check for employees assigned a removed title before retiring it.
3. Deploy `gas/Admin.gs`, `gas/Code.gs`, and the reservation fallback change in
   `gas/Dashboard.gs` to the existing Apps Script project. Preserve any other
   live source differences and the endpoint URL. Google authorization must be
   completed by the account holder before deployment can finish.
4. Verify `getJabatan` and authenticated `getAllEmployees`, then QA the frontend
   preview against that endpoint before promoting it to production.

The release branch is based on `codex/local-dev-safe` commit `918fbd6`, the
frontend commit observed in production, to preserve features absent from `main`.

For rollback, restore the previous frontend deployment and select the previous
Apps Script version on the existing deployment (version 9 before this change).
The additive `Jabatan` tab can remain. Never delete tabs, replace the entire live
workbook, or restore older data over new operational records without approval.
Workbook exports retain linked media URLs; media files remain in Google Drive.
