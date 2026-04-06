/**
 * Absensi Ketjeh — Helper Functions
 * Sheet utilities, geofence, photo upload.
 */

// ============================================================
// Sheet Utilities
// ============================================================

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/**
 * Convert sheet data to array of objects using header row as keys.
 * Uses getDisplayValues() to avoid Google Sheets Date object issues.
 */
function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const range = sheet.getDataRange();
  const data = range.getDisplayValues(); // Returns strings as displayed
  if (data.length < 2) return [];

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = data[i][j];
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Find a row index (1-based) by matching a column value.
 * Returns -1 if not found.
 */
function findRowIndex(sheetName, colIndex, value) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getDisplayValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      return i + 1; // 1-based row number
    }
  }
  return -1;
}

/**
 * Get today's date string in YYYY-MM-DD format (WIB).
 */
function getTodayString() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

/**
 * Get current datetime string in WIB.
 */
function getNowString() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Get settings as key-value object from Pengaturan tab.
 * Uses getDisplayValues() to get plain strings.
 */
function getSettings() {
  const sheet = getSheet('Pengaturan');
  const data = sheet.getDataRange().getDisplayValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const value = String(data[i][1]).trim();
    if (key) settings[key] = value;
  }
  return settings;
}

/**
 * Force a cell to plain text format and set its value.
 * This prevents Google Sheets from auto-converting "08:00" to a Date.
 */
function setPlainTextValue(sheet, row, col, value) {
  const cell = sheet.getRange(row, col);
  cell.setNumberFormat('@'); // @ = plain text format
  cell.setValue(String(value));
}

// ============================================================
// Geofence / Distance Calculation
// ============================================================

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * Returns distance in meters.
 */
function hitungJarak(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if coordinates are within geofence.
 * Returns { onSite: boolean, jarak: number (meters), label: string }
 */
function cekLokasi(lat, lng) {
  const settings = getSettings();
  const centerLat = parseFloat(settings.geofence_lat) || 0;
  const centerLng = parseFloat(settings.geofence_lng) || 0;
  const radius = parseFloat(settings.geofence_radius_meter) || 200;

  if (!lat || !lng || !centerLat || !centerLng) {
    return { onSite: false, jarak: 0, label: 'GPS Tidak Tersedia' };
  }

  const jarak = hitungJarak(lat, lng, centerLat, centerLng);
  const onSite = jarak <= radius;
  const label = onSite
    ? 'On-site'
    : 'Off-site (' + (jarak / 1000).toFixed(1) + 'km)';

  return { onSite, jarak: Math.round(jarak), label };
}

// ============================================================
// Photo Upload
// ============================================================

/**
 * Upload base64 photo to Google Drive.
 * Creates date subfolder if needed.
 * Returns shareable URL.
 */
function uploadFoto(base64String, fileName) {
  const settings = getSettings();
  const folderId = settings.foto_folder_id;

  if (!folderId) {
    throw new Error('foto_folder_id not configured in Pengaturan');
  }

  const rootFolder = DriveApp.getFolderById(folderId);
  const today = getTodayString();

  // Get or create date subfolder
  let dateFolder;
  const folders = rootFolder.getFoldersByName(today);
  if (folders.hasNext()) {
    dateFolder = folders.next();
  } else {
    dateFolder = rootFolder.createFolder(today);
  }

  // Decode base64 and create file
  const decoded = Utilities.base64Decode(base64String);
  const blob = Utilities.newBlob(decoded, 'image/jpeg', fileName + '.jpg');
  const file = dateFolder.createFile(blob);

  // Make viewable with link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Return direct image URL (not Drive page URL)
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}

// ============================================================
// PIN Verification
// ============================================================

/**
 * Handle verifyPin API request. Returns { success, verified }.
 */
function handleVerifyPin(body) {
  const { karyawan_id, pin } = body;
  if (!karyawan_id || !pin) {
    return { error: 'karyawan_id dan pin diperlukan' };
  }
  const verified = verifyPin(karyawan_id, pin);
  return { success: true, verified: verified };
}

/**
 * Verify employee PIN. Returns true if PIN matches.
 */
function verifyPin(karyawanId, pin) {
  const sheet = getSheet('Karyawan');
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  const pinCol = headers.indexOf('pin');
  const idCol = headers.indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(karyawanId)) {
      return String(data[i][pinCol]) === String(pin);
    }
  }
  return false;
}
