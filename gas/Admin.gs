/**
 * Absensi Ketjeh — Admin Functions
 * Employee CRUD, settings, special shifts, admin login.
 */

// ============================================================
// Admin Login
// ============================================================

function handleAdminLogin(body) {
  const { password } = body;
  const settings = getSettings();

  if (password === settings.admin_password) {
    return { success: true, role: 'admin' };
  }
  if (password === settings.manager_password) {
    return { success: true, role: 'manager' };
  }

  return { error: 'Password salah' };
}

// ============================================================
// Settings (Pengaturan)
// ============================================================

function handleGetPengaturan() {
  const settings = getSettings();
  return { success: true, data: settings };
}

function handleEditPengaturan(body) {
  const { password, settings: newSettings } = body;

  // Verify admin
  const loginCheck = handleAdminLogin({ password });
  if (loginCheck.role !== 'admin') {
    return { error: 'Akses ditolak. Hanya admin.' };
  }

  const sheet = getSheet('Pengaturan');
  const data = sheet.getDataRange().getValues();

  for (const [key, value] of Object.entries(newSettings)) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value, '']);
    }
  }

  return { success: true, message: 'Pengaturan berhasil diperbarui' };
}

// ============================================================
// Employee CRUD (Karyawan)
// ============================================================

function handleTambahKaryawan(body) {
  const { nama, jabatan, kategori, pin, password } = body;

  // Verify admin
  const loginCheck = handleAdminLogin({ password });
  if (loginCheck.role !== 'admin') {
    return { error: 'Akses ditolak. Hanya admin.' };
  }

  if (!nama || !jabatan) {
    return { error: 'Nama dan jabatan diperlukan' };
  }

  const sheet = getSheet('Karyawan');
  const data = sheet.getDataRange().getValues();

  // Generate next ID: K001, K002, etc.
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]);
    if (id.startsWith('K')) {
      const num = parseInt(id.substring(1));
      if (num > maxNum) maxNum = num;
    }
  }
  const newId = 'K' + String(maxNum + 1).padStart(3, '0');

  const today = getTodayString();

  sheet.appendRow([
    newId,                         // A: id
    nama,                          // B: nama
    jabatan,                       // C: jabatan
    kategori || 'on-site',         // D: kategori
    'TRUE',                        // E: aktif
    today,                         // F: tanggal_masuk
    pin || '1234'                  // G: pin
  ]);

  return { success: true, message: 'Karyawan berhasil ditambahkan', id: newId };
}

function handleEditKaryawan(body) {
  const { id, password, ...fields } = body;

  // Verify admin
  const loginCheck = handleAdminLogin({ password });
  if (loginCheck.role !== 'admin') {
    return { error: 'Akses ditolak. Hanya admin.' };
  }

  if (!id) {
    return { error: 'ID karyawan diperlukan' };
  }

  const sheet = getSheet('Karyawan');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find employee row
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    return { error: 'Karyawan tidak ditemukan: ' + id };
  }

  // Update specified fields
  const editableFields = ['nama', 'jabatan', 'kategori', 'aktif', 'pin'];
  for (const field of editableFields) {
    if (fields[field] !== undefined) {
      const colIndex = headers.indexOf(field);
      if (colIndex >= 0) {
        sheet.getRange(targetRow, colIndex + 1).setValue(fields[field]);
      }
    }
  }

  return { success: true, message: 'Karyawan berhasil diperbarui' };
}

// ============================================================
// Special Shifts (ShiftKhusus)
// ============================================================

function handleGetShiftKhusus() {
  const data = sheetToObjects('ShiftKhusus');
  return { success: true, data };
}

function handleTambahShiftKhusus(body) {
  const { tanggal, nama_hari, shift_mulai, shift_selesai, catatan, password } = body;

  // Verify admin
  const loginCheck = handleAdminLogin({ password });
  if (loginCheck.role !== 'admin') {
    return { error: 'Akses ditolak. Hanya admin.' };
  }

  if (!tanggal || !nama_hari) {
    return { error: 'Tanggal dan nama hari diperlukan' };
  }

  const sheet = getSheet('ShiftKhusus');
  sheet.appendRow([
    tanggal,
    nama_hari,
    shift_mulai || 'LIBUR',
    shift_selesai || '',
    catatan || ''
  ]);

  return { success: true, message: 'Shift khusus berhasil ditambahkan' };
}

function handleHapusShiftKhusus(body) {
  const { tanggal, password } = body;

  // Verify admin
  const loginCheck = handleAdminLogin({ password });
  if (loginCheck.role !== 'admin') {
    return { error: 'Akses ditolak. Hanya admin.' };
  }

  const sheet = getSheet('ShiftKhusus');
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    const cellDate = data[i][0] instanceof Date
      ? Utilities.formatDate(data[i][0], 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(data[i][0]);
    if (cellDate === tanggal) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Shift khusus berhasil dihapus' };
    }
  }

  return { error: 'Shift khusus tidak ditemukan untuk tanggal: ' + tanggal };
}

// ============================================================
// Reports
// ============================================================

function handleGetReport(body) {
  const { dari, sampai, karyawan_id, password } = body;

  // Verify admin/manager
  const loginCheck = handleAdminLogin({ password });
  if (!loginCheck.success) {
    return { error: 'Akses ditolak.' };
  }

  let data = sheetToObjects('Absensi');

  // Filter by date range
  if (dari && sampai) {
    data = data.filter(a => {
      const tanggal = a.tanggal instanceof Date
        ? Utilities.formatDate(a.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd')
        : String(a.tanggal);
      return tanggal >= dari && tanggal <= sampai;
    });
  }

  // Filter by employee
  if (karyawan_id) {
    data = data.filter(a => String(a.karyawan_id) === String(karyawan_id));
  }

  // Summary stats
  const totalHari = [...new Set(data.map(a => String(a.tanggal)))].length;
  const totalHadir = data.length;
  const totalDurasi = data.reduce((sum, a) => sum + (parseFloat(a.durasi_jam) || 0), 0);
  const rataRataDurasi = totalHadir > 0 ? Math.round((totalDurasi / totalHadir) * 100) / 100 : 0;

  return {
    success: true,
    data,
    summary: {
      total_hari: totalHari,
      total_hadir: totalHadir,
      total_durasi_jam: Math.round(totalDurasi * 100) / 100,
      rata_rata_durasi: rataRataDurasi
    }
  };
}
