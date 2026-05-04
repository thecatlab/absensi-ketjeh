/**
 * Absensi Ketjeh — Google Apps Script Backend
 * Main router for GET and POST requests.
 */

const SPREADSHEET_ID = '1SagtqxaXoAe2a-2BM0a7ejilsRr87oUyMdmEi86OSiM';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ============================================================
// GET Router
// ============================================================
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';

  try {
    let result;

    switch (action) {
      case 'getKaryawan':
        result = handleGetKaryawan();
        break;

      case 'getAbsensiHariIni':
        result = handleGetAbsensiHariIni();
        break;

      case 'getAbsensi':
        result = handleGetAbsensi(e.parameter.dari, e.parameter.sampai, e.parameter.karyawan_id);
        break;

      case 'getPengaturan':
        result = handleGetPengaturan();
        break;

      case 'getShiftKhusus':
        result = handleGetShiftKhusus();
        break;

      case 'cekStatusHariIni':
        result = handleCekStatusHariIni(e.parameter.karyawan_id);
        break;

      case 'getAdminNotes':
        result = handleGetAdminNotes();
        break;

      case 'getEmployeeDashboard':
        result = handleGetEmployeeDashboard(e.parameter.karyawan_id, e.parameter.jabatan, e.parameter.nama);
        break;

      case 'getPengumumanAdmin':
        result = handleGetPengumumanAdmin();
        break;

      case 'getReservasiAdmin':
        result = handleGetReservasiAdmin();
        break;

      case 'getTodosAdmin':
        result = handleGetTodosAdmin();
        break;

      case 'downloadAbsensi':
        result = handleGetAbsensi(e.parameter.dari, e.parameter.sampai);
        break;

      default:
        result = { error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ============================================================
// POST Router
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || '';

    let result;

    switch (action) {
      case 'clockIn':
        result = handleClockIn(body);
        break;

      case 'clockOut':
        result = handleClockOut(body);
        break;

      case 'adminLogin':
        result = handleAdminLogin(body);
        break;

      case 'tambahKaryawan':
        result = handleTambahKaryawan(body);
        break;

      case 'editKaryawan':
        result = handleEditKaryawan(body);
        break;

      case 'tambahShiftKhusus':
        result = handleTambahShiftKhusus(body);
        break;

      case 'editPengaturan':
        result = handleEditPengaturan(body);
        break;

      case 'hapusShiftKhusus':
        result = handleHapusShiftKhusus(body);
        break;

      case 'getReport':
        result = handleGetReport(body);
        break;

      case 'tambahAdminNote':
        result = handleTambahAdminNote(body);
        break;

      case 'hapusAdminNote':
        result = handleHapusAdminNote(body);
        break;

      case 'verifyPin':
        result = handleVerifyPin(body);
        break;

      case 'tambahPengumuman':
        result = handleTambahPengumuman(body);
        break;

      case 'hapusPengumuman':
        result = handleHapusPengumuman(body);
        break;

      case 'updatePengumumanStatus':
        result = handleUpdatePengumumanStatus(body);
        break;

      case 'tambahReservasi':
        result = handleTambahReservasi(body);
        break;

      case 'editReservasi':
        result = handleEditReservasi(body);
        break;

      case 'hapusReservasi':
        result = handleHapusReservasi(body);
        break;

      case 'tambahTodo':
        result = handleTambahTodo(body);
        break;

      case 'hapusTodo':
        result = handleHapusTodo(body);
        break;

      case 'setTodoStatus':
        result = handleSetTodoStatus(body);
        break;

      case 'uploadFotoBriefing':
        result = handleUploadFotoBriefing(body);
        break;

      default:
        result = { error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ============================================================
// Response Helper
// ============================================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
