/**
 * Absensi Ketjeh — Employee Dashboard
 * Sheet-backed announcements, reservations, to-do, and briefing photos.
 */

const BRIEFING_FOLDER_ID = '1kVVoyWWXNVymQKgbN-lbPzkikalxA_zl';

const PENGUMUMAN_HEADERS = ['id', 'judul', 'isi', 'tanggal_mulai', 'tanggal_selesai', 'aktif', 'dibuat_oleh', 'target_type', 'target_value'];
const RESERVASI_HEADERS = ['id', 'tanggal', 'jam', 'nama_pelanggan', 'pesanan', 'keterangan', 'status', 'area'];
const TODO_HEADERS = ['id', 'judul', 'deskripsi', 'target_type', 'target_value', 'aktif', 'schedule_type', 'tanggal_mulai', 'tanggal_selesai', 'schedule_value', 'schedule_interval_months'];
const TODO_STATUS_HEADERS = ['id', 'tanggal', 'karyawan_id', 'nama', 'todo_id', 'selesai', 'jam_update'];
const BRIEFING_HEADERS = ['id', 'tanggal', 'karyawan_id', 'nama', 'foto_url', 'jam_upload'];

function handleGetEmployeeDashboard(karyawanId, jabatan, nama) {
  if (!karyawanId || !jabatan) {
    return { error: 'karyawan_id dan jabatan diperlukan' };
  }

  const today = getTodayString();
  const pengumuman = getActivePengumuman(today, karyawanId, jabatan);
  const reservasi = getReservasiByDate(today);
  const statusHariIni = handleCekStatusHariIni(karyawanId);
  const todos = getTodosForEmployee(karyawanId, jabatan, nama, today);
  const briefing = getBriefingForEmployee(today, karyawanId);

  return { success: true, pengumuman, reservasi, status_hari_ini: statusHariIni, todos, briefing };
}

function handleGetPengumumanAdmin() {
  return { success: true, data: sheetToObjectsWithHeaders('Pengumuman', PENGUMUMAN_HEADERS) };
}

function handleTambahPengumuman(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  if (!body.judul || !body.isi) return { error: 'Judul dan isi diperlukan' };

  const sheet = getOrCreateSheet('Pengumuman', PENGUMUMAN_HEADERS);
  sheet.appendRow([
    'P' + new Date().getTime(),
    body.judul,
    body.isi,
    body.tanggal_mulai || getTodayString(),
    body.tanggal_selesai || body.tanggal_mulai || getTodayString(),
    body.aktif === false ? 'FALSE' : 'TRUE',
    body.dibuat_oleh || loginCheck.role,
    body.target_type || 'all',
    body.target_value || ''
  ]);
  return { success: true, message: 'Pengumuman berhasil ditambahkan' };
}

function handleHapusPengumuman(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  return deleteById('Pengumuman', PENGUMUMAN_HEADERS, body.id, 'Pengumuman dihapus');
}

function handleUpdatePengumumanStatus(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  if (!body.id) return { error: 'ID diperlukan' };

  const sheet = getOrCreateSheet('Pengumuman', PENGUMUMAN_HEADERS);
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0] || [];
  const idCol = headers.indexOf('id') + 1;
  const activeCol = headers.indexOf('aktif') + 1;
  if (!idCol || !activeCol) return { error: 'Kolom pengumuman tidak lengkap' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]) === String(body.id)) {
      sheet.getRange(i + 1, activeCol).setValue(body.aktif === false ? 'FALSE' : 'TRUE');
      return { success: true, message: 'Status pengumuman diperbarui' };
    }
  }
  return { error: 'Pengumuman tidak ditemukan' };
}

function handleGetReservasiAdmin() {
  return { success: true, data: sheetToObjectsWithHeaders('Reservasi', RESERVASI_HEADERS) };
}

function handleTambahReservasi(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  if (!body.tanggal || !body.jam || !body.nama_pelanggan) return { error: 'Tanggal, jam, dan nama pelanggan diperlukan' };

  const sheet = getOrCreateSheet('Reservasi', RESERVASI_HEADERS);
  sheet.appendRow([
    'R' + new Date().getTime(),
    body.tanggal,
    body.jam,
    body.nama_pelanggan,
    body.pesanan || '',
    body.keterangan || '',
    body.status || 'confirmed',
    body.area || ''
  ]);
  return { success: true, message: 'Reservasi berhasil ditambahkan' };
}

function handleEditReservasi(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  if (!body.id) return { error: 'ID diperlukan' };
  if (!body.tanggal || !body.jam || !body.nama_pelanggan) return { error: 'Tanggal, jam, dan nama pelanggan diperlukan' };

  const sheet = getOrCreateSheet('Reservasi', RESERVASI_HEADERS);
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0] || [];
  const idCol = headers.indexOf('id');
  if (idCol === -1) return { error: 'Kolom reservasi tidak lengkap' };

  const updates = {
    tanggal: body.tanggal,
    jam: body.jam,
    nama_pelanggan: body.nama_pelanggan,
    pesanan: body.pesanan || '',
    keterangan: body.keterangan || '',
    status: body.status || 'confirmed',
    area: body.area || ''
  };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(body.id)) {
      Object.keys(updates).forEach(function(key) {
        const col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(updates[key]);
      });
      return { success: true, message: 'Reservasi berhasil diperbarui' };
    }
  }
  return { error: 'Reservasi tidak ditemukan' };
}

function handleHapusReservasi(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  return deleteById('Reservasi', RESERVASI_HEADERS, body.id, 'Reservasi dihapus');
}

function handleGetTodosAdmin() {
  return { success: true, data: sheetToObjectsWithHeaders('Todo', TODO_HEADERS) };
}

function handleTambahTodo(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  if (!body.judul || !body.target_type || !body.target_value) return { error: 'Judul dan target diperlukan' };

  const sheet = getOrCreateSheet('Todo', TODO_HEADERS);
  sheet.appendRow([
    'T' + new Date().getTime(),
    body.judul,
    body.deskripsi || '',
    body.target_type,
    body.target_value,
    body.aktif === false ? 'FALSE' : 'TRUE',
    body.schedule_type || 'daily',
    body.tanggal_mulai || '',
    body.tanggal_selesai || '',
    body.schedule_value || '',
    body.schedule_interval_months || ''
  ]);
  return { success: true, message: 'To-do berhasil ditambahkan' };
}

function handleHapusTodo(body) {
  const loginCheck = handleAdminLogin({ password: body.password });
  if (!loginCheck.success) return { error: 'Akses ditolak.' };
  return deleteById('Todo', TODO_HEADERS, body.id, 'To-do dihapus');
}

function handleSetTodoStatus(body) {
  if (!body.karyawan_id || !body.todo_id) return { error: 'karyawan_id dan todo_id diperlukan' };

  const today = getTodayString();
  const sheet = getOrCreateSheet('TodoStatus', TODO_STATUS_HEADERS);
  const data = sheet.getDataRange().getDisplayValues();
  const selesai = body.selesai === true || String(body.selesai).toUpperCase() === 'TRUE';

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === today && String(data[i][2]) === String(body.karyawan_id) && String(data[i][4]) === String(body.todo_id)) {
      sheet.getRange(i + 1, 6).setValue(selesai ? 'TRUE' : 'FALSE');
      sheet.getRange(i + 1, 7).setValue(Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm'));
      return { success: true };
    }
  }

  sheet.appendRow([
    'TS' + new Date().getTime(),
    today,
    body.karyawan_id,
    body.nama || '',
    body.todo_id,
    selesai ? 'TRUE' : 'FALSE',
    Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm')
  ]);
  return { success: true };
}

function handleUploadFotoBriefing(body) {
  if (!body.karyawan_id || !body.nama || !body.foto_base64) {
    return { error: 'karyawan_id, nama, dan foto_base64 diperlukan' };
  }

  const today = getTodayString();
  if (getBriefingForEmployee(today, body.karyawan_id)) {
    return { error: 'Foto briefing untuk hari ini sudah diupload' };
  }

  const fileName = body.karyawan_id + '_briefing_' + today;
  const fotoUrl = uploadFotoToFolder(body.foto_base64, fileName, BRIEFING_FOLDER_ID);
  const jam = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm');
  const record = {
    id: 'B' + new Date().getTime(),
    tanggal: today,
    karyawan_id: body.karyawan_id,
    nama: body.nama,
    foto_url: fotoUrl,
    jam_upload: jam
  };

  const sheet = getOrCreateSheet('FotoBriefing', BRIEFING_HEADERS);
  sheet.appendRow([record.id, record.tanggal, record.karyawan_id, record.nama, record.foto_url, record.jam_upload]);
  return { success: true, data: record, message: 'Foto briefing berhasil diupload' };
}

function getActivePengumuman(today, karyawanId, jabatan) {
  const data = sheetToObjectsWithHeaders('Pengumuman', PENGUMUMAN_HEADERS);
  return data.filter(item => {
    const active = item.aktif === true || String(item.aktif).toUpperCase() === 'TRUE';
    const start = item.tanggal_mulai || today;
    const end = item.tanggal_selesai || today;
    return active && start <= today && today <= end && targetMatchesEmployee(item, karyawanId, jabatan);
  });
}

function getReservasiByDate(dateStr) {
  const data = sheetToObjectsWithHeaders('Reservasi', RESERVASI_HEADERS);
  return data
    .filter(item => String(item.tanggal) === String(dateStr))
    .sort((a, b) => String(a.jam).localeCompare(String(b.jam)));
}

function getTodosForEmployee(karyawanId, jabatan, nama, today) {
  const todos = sheetToObjectsWithHeaders('Todo', TODO_HEADERS);
  const statuses = sheetToObjectsWithHeaders('TodoStatus', TODO_STATUS_HEADERS);

  return todos
    .filter(todo => {
      const active = todo.aktif === true || String(todo.aktif).toUpperCase() === 'TRUE';
      if (!active) return false;
      return targetMatchesEmployee(todo, karyawanId, jabatan) && scheduleMatchesDate(todo, today);
    })
    .map(todo => {
      const status = statuses.find(s =>
        String(s.tanggal) === String(today) &&
        String(s.karyawan_id) === String(karyawanId) &&
        String(s.todo_id) === String(todo.id)
      );
      return Object.assign({}, todo, { selesai: status ? String(status.selesai).toUpperCase() === 'TRUE' : false, nama: nama || '' });
    });
}

function splitTargets(value) {
  return String(value || '')
    .split(',')
    .map(function(item) { return item.trim(); })
    .filter(function(item) { return item; });
}

function targetMatchesEmployee(item, karyawanId, jabatan) {
  const type = String(item.target_type || 'all').toLowerCase();
  if (type === 'all') return true;

  const targets = splitTargets(item.target_value);
  if (type === 'employee' || type === 'employees') {
    return targets.some(function(target) { return String(target) === String(karyawanId); });
  }
  if (type === 'role' || type === 'roles') {
    const targetJabatan = String(jabatan || '').toLowerCase();
    return targets.some(function(target) { return String(target).toLowerCase() === targetJabatan; });
  }
  return false;
}

function scheduleMatchesDate(todo, dateKey) {
  const type = String(todo.schedule_type || 'daily').toLowerCase();
  const start = todo.tanggal_mulai || '';
  const end = todo.tanggal_selesai || '';
  if (start && String(dateKey) < String(start)) return false;
  if (end && String(dateKey) > String(end)) return false;

  if (type === 'once') return String(start || todo.tanggal || dateKey) === String(dateKey);
  if (type === 'period') return true;

  const date = new Date(String(dateKey) + 'T00:00:00+07:00');
  if (type === 'weekdays') {
    return splitTargets(todo.schedule_value).indexOf(String(date.getDay())) !== -1;
  }

  if (type === 'month_dates') {
    return splitTargets(todo.schedule_value).indexOf(String(date.getDate())) !== -1;
  }

  if (type === 'last_day_of_month') {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === lastDay;
  }

  if (type === 'every_x_month') {
    const interval = Math.max(parseInt(todo.schedule_interval_months, 10) || 1, 1);
    const anchor = start || dateKey;
    const anchorDate = new Date(String(anchor) + 'T00:00:00+07:00');
    const monthDiff = (date.getFullYear() - anchorDate.getFullYear()) * 12 + date.getMonth() - anchorDate.getMonth();
    return monthDiff >= 0 && monthDiff % interval === 0 && date.getDate() === anchorDate.getDate();
  }

  return true;
}

function getBriefingForEmployee(today, karyawanId) {
  const data = sheetToObjectsWithHeaders('FotoBriefing', BRIEFING_HEADERS);
  return data.find(item => String(item.tanggal) === String(today) && String(item.karyawan_id) === String(karyawanId)) || null;
}

function deleteById(sheetName, headers, id, message) {
  if (!id) return { error: 'ID diperlukan' };
  const sheet = getOrCreateSheet(sheetName, headers);
  const data = sheet.getDataRange().getDisplayValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true, message };
    }
  }
  return { error: 'Data tidak ditemukan' };
}
