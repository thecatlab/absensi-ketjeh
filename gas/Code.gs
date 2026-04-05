/**
 * Absensi Ketjeh — Google Apps Script Backend
 * Main router for GET and POST requests.
 */

const SPREADSHEET_ID = ''; // TODO: Fill with your Google Sheet ID

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
        result = handleGetAbsensi(e.parameter.dari, e.parameter.sampai);
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
