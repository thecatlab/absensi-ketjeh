/**
 * Absensi Ketjeh — Attendance Logic
 * Clock-in, clock-out, status check, and attendance queries.
 */

// ============================================================
// GET Handlers
// ============================================================

/**
 * Get active employees list.
 */
function handleGetKaryawan() {
  const all = sheetToObjects('Karyawan');
  const active = all.filter(k => String(k.aktif).toUpperCase() === 'TRUE');
  return { success: true, data: sanitizePublicRows(active) };
}

/**
 * Get today's attendance records.
 */
function handleGetAbsensiHariIni() {
  const today = getTodayString();
  const all = sheetToObjects('Absensi');
  const todayRecords = all.filter(a => {
    const tanggal = a.tanggal instanceof Date
      ? Utilities.formatDate(a.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(a.tanggal);
    return tanggal === today;
  });
  return { success: true, data: todayRecords };
}

/**
 * Get attendance records for a date range.
 */
function handleGetAbsensi(dari, sampai, karyawanId) {
  if (!dari || !sampai) {
    return { error: 'Parameter dari dan sampai diperlukan' };
  }

  const all = sheetToObjects('Absensi');
  const filtered = all.filter(a => {
    const tanggal = a.tanggal instanceof Date
      ? Utilities.formatDate(a.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(a.tanggal);
    if (tanggal < dari || tanggal > sampai) return false;
    if (karyawanId && String(a.karyawan_id) !== String(karyawanId)) return false;
    return true;
  });

  return { success: true, data: filtered };
}

/**
 * Check employee's clock-in status for today.
 * Returns: "belum_masuk" | "sudah_masuk" | "sudah_keluar"
 */
function handleCekStatusHariIni(karyawanId) {
  if (!karyawanId) {
    return { error: 'karyawan_id diperlukan' };
  }

  const today = getTodayString();
  const all = sheetToObjects('Absensi');

  const todayRecord = all.find(a => {
    const tanggal = a.tanggal instanceof Date
      ? Utilities.formatDate(a.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(a.tanggal);
    return tanggal === today && String(a.karyawan_id) === String(karyawanId);
  });

  if (!todayRecord) {
    return { success: true, status: 'belum_masuk' };
  }

  if (!todayRecord.jam_keluar || String(todayRecord.jam_keluar).trim() === '') {
    return {
      success: true,
      status: 'sudah_masuk',
      jam_masuk: todayRecord.jam_masuk,
      foto_masuk_url: todayRecord.foto_masuk_url
    };
  }

  return {
    success: true,
    status: 'sudah_keluar',
    jam_masuk: todayRecord.jam_masuk,
    jam_keluar: todayRecord.jam_keluar,
    durasi_jam: todayRecord.durasi_jam
  };
}

// ============================================================
// POST Handlers
// ============================================================

/**
 * Handle clock-in request.
 * Body: { karyawan_id, nama, lat, lng, foto_base64, pin }
 */
function handleClockIn(body) {
  const { karyawan_id, nama, lat, lng, foto_base64, pin } = body;

  // Validate required fields
  if (!karyawan_id || !nama) {
    return { error: 'karyawan_id dan nama diperlukan' };
  }

  // Verify PIN
  if (!verifyPin(karyawan_id, pin)) {
    return { error: 'PIN salah' };
  }

  // Check if already clocked in today
  const statusCheck = handleCekStatusHariIni(karyawan_id);
  if (statusCheck.status === 'sudah_masuk') {
    return { error: 'Sudah clock in hari ini. Silakan clock out terlebih dahulu.' };
  }
  if (statusCheck.status === 'sudah_keluar') {
    return { error: 'Sudah clock in dan clock out hari ini.' };
  }

  const today = getTodayString();
  const now = getNowString();

  // Upload photo
  let fotoUrl = '';
  if (foto_base64) {
    const fileName = karyawan_id + '_masuk_' + today;
    fotoUrl = uploadFoto(foto_base64, fileName);
  }

  // Check location
  const lokasi = cekLokasi(lat, lng);

  // Check if late
  const settings = getSettings();
  let shiftMulai = settings.shift_mulai || '08:00';
  const toleransi = parseInt(settings.toleransi_terlambat_menit) || 15;

  // Check for special shift override
  const shiftKhusus = getShiftOverride(today);
  if (shiftKhusus) {
    if (shiftKhusus.shift_mulai === 'LIBUR') {
      return { error: 'Hari ini libur: ' + (shiftKhusus.nama_hari || '') };
    }
    shiftMulai = shiftKhusus.shift_mulai;
  }

  // Generate record ID
  const id = 'A' + today.replace(/-/g, '') + '-' + karyawan_id + '-IN';

  // Write to sheet
  const sheet = getSheet('Absensi');
  sheet.appendRow([
    id,                    // A: id
    karyawan_id,           // B: karyawan_id
    nama,                  // C: nama
    today,                 // D: tanggal
    now,                   // E: jam_masuk
    '',                    // F: jam_keluar
    '',                    // G: durasi_jam
    lat || '',             // H: lat_masuk
    lng || '',             // I: lng_masuk
    '',                    // J: lat_keluar
    '',                    // K: lng_keluar
    lokasi.label,          // L: status_lokasi_masuk
    '',                    // M: status_lokasi_keluar
    fotoUrl,               // N: foto_masuk_url
    '',                    // O: foto_keluar_url
    body.catatan || ''     // P: catatan
  ]);

  return {
    success: true,
    message: 'Clock in berhasil',
    jam_masuk: now,
    status_lokasi: lokasi.label,
    foto_url: fotoUrl
  };
}

/**
 * Handle clock-out request.
 * Body: { karyawan_id, lat, lng, foto_base64, pin, catatan? }
 */
function handleClockOut(body) {
  const { karyawan_id, lat, lng, foto_base64, pin } = body;

  if (!karyawan_id) {
    return { error: 'karyawan_id diperlukan' };
  }

  // Verify PIN
  if (!verifyPin(karyawan_id, pin)) {
    return { error: 'PIN salah' };
  }

  // Find today's open record
  const today = getTodayString();
  const sheet = getSheet('Absensi');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    const tanggal = data[i][3] instanceof Date
      ? Utilities.formatDate(data[i][3], 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(data[i][3]);
    const kid = String(data[i][1]);
    const jamKeluar = String(data[i][5]).trim();

    if (tanggal === today && kid === String(karyawan_id) && jamKeluar === '') {
      targetRow = i + 1; // 1-based
      break;
    }
  }

  if (targetRow === -1) {
    return { error: 'Belum clock in hari ini.' };
  }

  const now = getNowString();

  // Upload photo
  let fotoUrl = '';
  if (foto_base64) {
    const fileName = karyawan_id + '_keluar_' + today;
    fotoUrl = uploadFoto(foto_base64, fileName);
  }

  // Check location
  const lokasi = cekLokasi(lat, lng);

  // Calculate duration
  const jamMasukStr = String(data[targetRow - 1][4]);
  const jamMasuk = new Date(jamMasukStr);
  const jamKeluar = new Date();
  const durasiMs = jamKeluar - jamMasuk;
  const durasiJam = Math.round((durasiMs / 3600000) * 100) / 100;

  // Update row
  sheet.getRange(targetRow, 6).setValue(now);              // F: jam_keluar
  sheet.getRange(targetRow, 7).setValue(durasiJam);         // G: durasi_jam
  sheet.getRange(targetRow, 10).setValue(lat || '');        // J: lat_keluar
  sheet.getRange(targetRow, 11).setValue(lng || '');        // K: lng_keluar
  sheet.getRange(targetRow, 13).setValue(lokasi.label);     // M: status_lokasi_keluar
  sheet.getRange(targetRow, 15).setValue(fotoUrl);          // O: foto_keluar_url

  if (body.catatan) {
    const existingNote = String(sheet.getRange(targetRow, 16).getValue());
    const newNote = existingNote ? existingNote + ' | ' + body.catatan : body.catatan;
    sheet.getRange(targetRow, 16).setValue(newNote);        // P: catatan
  }

  return {
    success: true,
    message: 'Clock out berhasil',
    jam_keluar: now,
    durasi_jam: durasiJam,
    status_lokasi: lokasi.label,
    foto_url: fotoUrl
  };
}

// ============================================================
// Shift Override Helper
// ============================================================

/**
 * Check if there's a special shift for a given date.
 */
function getShiftOverride(dateStr) {
  const all = sheetToObjects('ShiftKhusus');
  return all.find(s => {
    const tanggal = s.tanggal instanceof Date
      ? Utilities.formatDate(s.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(s.tanggal);
    return tanggal === dateStr;
  }) || null;
}
