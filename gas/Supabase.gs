/** Supabase storage. Server secrets belong only in Apps Script Properties. */
let databaseRequest = null;

const DATABASE_HEADERS = {
  Karyawan: ['id','nama','jabatan','kategori','aktif','tanggal_masuk','pin'],
  FotoBriefing: ['id','tanggal','karyawan_id','nama','foto_url','jam_upload'],
  TodoStatus: ['id','tanggal','karyawan_id','nama','todo_id','selesai','jam_update'],
  Todo: ['id','judul','deskripsi','target_type','target_value','aktif','schedule_type','tanggal_mulai','tanggal_selesai','schedule_value','schedule_interval_months'],
  Reservasi: ['id','tanggal','jam','nama_pelanggan','pesanan','keterangan','status','area'],
  Pengumuman: ['id','judul','isi','tanggal_mulai','tanggal_selesai','aktif','dibuat_oleh','target_type','target_value'],
  Absensi: ['id','karyawan_id','nama','tanggal','jam_masuk','jam_keluar','durasi_jam','lat_masuk','lng_masuk','lat_keluar','lng_keluar','status_lokasi_masuk','status_lokasi_keluar','foto_masuk_url','foto_keluar_url','catatan'],
  Pengaturan: ['key','value','keterangan'],
  ShiftKhusus: ['tanggal','nama_hari','shift_mulai','shift_selesai','catatan'],
  AdminNotes: ['id','tanggal','jam','pengirim','pesan'],
  Jabatan: ['jabatan','aktif']
};

const DATABASE_ACTIONS = {
  getKaryawan: ['Karyawan'], getJabatan: ['Jabatan'], getPengaturan: ['Pengaturan'],
  verifyPin: ['Karyawan'], adminLogin: ['Pengaturan'],
  getAbsensiHariIni: ['Absensi'], getAbsensi: ['Absensi'], downloadAbsensi: ['Absensi'],
  cekStatusHariIni: ['Absensi'], getReport: ['Absensi'],
  clockIn: ['Absensi','ShiftKhusus'], clockOut: ['Absensi'],
  getEmployeeDashboard: ['Absensi','Todo','TodoStatus','FotoBriefing','Reservasi','Pengumuman'],
  setTodoStatus: ['Todo','TodoStatus'], uploadFotoBriefing: ['FotoBriefing'],
  getAllEmployees: ['Karyawan'], tambahKaryawan: ['Karyawan','Jabatan'], editKaryawan: ['Karyawan','Jabatan'],
  getShiftKhusus: ['ShiftKhusus'], tambahShiftKhusus: ['ShiftKhusus'], hapusShiftKhusus: ['ShiftKhusus'],
  getAdminNotes: ['AdminNotes'], tambahAdminNote: ['AdminNotes'], hapusAdminNote: ['AdminNotes'],
  getPengumumanAdmin: ['Pengumuman'], tambahPengumuman: ['Pengumuman'], editPengumuman: ['Pengumuman'],
  hapusPengumuman: ['Pengumuman'], updatePengumumanStatus: ['Pengumuman'],
  getReservasiAdmin: ['Reservasi'], tambahReservasi: ['Reservasi'], editReservasi: ['Reservasi'], hapusReservasi: ['Reservasi'],
  getTodosAdmin: ['Todo'], tambahTodo: ['Todo'], editTodo: ['Todo'], hapusTodo: ['Todo'],
  editPengaturan: ['Pengaturan'], getJabatanAdmin: ['Jabatan'], simpanJabatan: ['Jabatan','Karyawan'],
  getSyncStatus: [], syncSheets: []
};
const DATABASE_PUBLIC_ACTIONS = ['getKaryawan','getJabatan','getPengaturan','verifyPin','adminLogin'];
const DATABASE_READ_ACTIONS = Object.keys(DATABASE_ACTIONS).filter(function(action) {
  return /^(get|cek|download|verify|adminLogin)/.test(action);
});

function databaseMode() {
  if (typeof PropertiesService === 'undefined') return 'sheets';
  const mode = PropertiesService.getScriptProperties().getProperty('DATABASE_MODE') || 'sheets';
  if (mode !== 'sheets' && mode !== 'supabase') throw new Error('DATABASE_MODE tidak valid');
  return mode;
}

function supabaseRpc(name, args) {
  const properties = PropertiesService.getScriptProperties();
  const url = properties.getProperty('SUPABASE_URL');
  const secret = properties.getProperty('SUPABASE_SECRET_KEY');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !secret) {
    throw new Error('Konfigurasi database belum lengkap. Hubungi admin.');
  }
  const response = UrlFetchApp.fetch(url + '/rest/v1/rpc/ketjeh_' + name, {
    method: 'post', contentType: 'application/json',
    headers: { apikey: secret }, payload: JSON.stringify(args), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    // Provider messages can contain request values. Never send those to clients/logs.
    throw new Error('Database belum dapat diakses (' + response.getResponseCode() + '). Coba lagi dengan data yang sama.');
  }
  return JSON.parse(response.getContentText() || 'null');
}

function databaseDigest(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function(n) { return ('0' + ((n + 256) % 256).toString(16)).slice(-2); }).join('');
}

function databaseFilter(body) {
  const todayActions = ['clockIn','clockOut','getAbsensiHariIni','cekStatusHariIni','getEmployeeDashboard'];
  if (todayActions.indexOf(body.action) !== -1) {
    return { from: getTodayString(), to: getTodayString(), employee: body.karyawan_id || '' };
  }
  return { from: body.dari || '', to: body.sampai || '', employee: body.karyawan_id || '' };
}

function databaseSnapshot(body) {
  const tables = [...new Set(['Karyawan','Pengaturan'].concat(DATABASE_ACTIONS[body.action]))];
  const snapshot = supabaseRpc('snapshot', {
    p_tables: tables, p_filter: databaseFilter(body),
    p_auth: { password: body.password || '', pin: body.pin || '', karyawan_id: body.karyawan_id || '' }
  });
  tables.forEach(function(name) {
    const table = snapshot.datasets[name];
    if (!table || JSON.stringify(table.headers) !== JSON.stringify(DATABASE_HEADERS[name])) {
      throw new Error('Skema database tidak cocok: ' + name);
    }
  });
  return snapshot;
}

function databaseAuthorize(body, auth) {
  const action = body.action;
  if (DATABASE_PUBLIC_ACTIONS.indexOf(action) !== -1) return;
  if (['admin','manager'].indexOf(auth.role) !== -1) {
    if (['clockIn','clockOut','setTodoStatus','uploadFotoBriefing','getEmployeeDashboard','cekStatusHariIni'].indexOf(action) === -1) return;
  }
  if (auth.role === 'employee' && auth.employee.id === String(body.karyawan_id)) {
    if (['clockIn','clockOut','getAbsensi','cekStatusHariIni','getEmployeeDashboard','setTodoStatus','uploadFotoBriefing','getReservasiAdmin'].indexOf(action) !== -1) return;
    if (['getReservasiAdmin','tambahReservasi','editReservasi','hapusReservasi'].indexOf(action) !== -1
        && isReservationRoleAllowed(auth.employee.jabatan)) return;
  }
  throw new Error('Akses ditolak. Verifikasi PIN atau login kembali.');
}

function databaseDispatch(input, method) {
  const body = Object.assign({}, input);
  const action = body.action;
  if (!Object.prototype.hasOwnProperty.call(DATABASE_ACTIONS, action)) return { error: 'Unknown action: ' + action };
  if (method === 'GET' && ['getKaryawan','getJabatan','getPengaturan'].indexOf(action) === -1) {
    const notice = { error: 'Versi aplikasi perlu diperbarui. Muat ulang halaman lalu masuk kembali.', code: 'CLIENT_UPDATE_REQUIRED' };
    // Older dashboards ignore error responses. Give them a visible system notice
    // without returning private records or changing the stored announcements.
    if (action === 'getEmployeeDashboard') return Object.assign(notice, {
      success: true, pengumuman: [{ id: 'system-update', judul: 'Muat ulang aplikasi', isi: notice.error }],
      reservasi: [], todos: [], briefing: null, status_hari_ini: { status: 'perlu_verifikasi' }
    });
    return notice;
  }
  const mutation = DATABASE_READ_ACTIONS.indexOf(action) === -1 && action !== 'syncSheets';
  if (mutation && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.operation_id || '')) {
    return { error: 'Muat ulang aplikasi sebelum menyimpan.', code: 'CLIENT_UPDATE_REQUIRED' };
  }
  const lease = mutation ? Utilities.getUuid() : null;
  let claimed = false;
  try {
    for (let attempt=0; attempt<4; attempt++) {
      const snapshot = databaseSnapshot(body);
      const previousTime = databaseRequest && databaseRequest.startedAt;
      databaseRequest = { body, snapshot, sheets: {}, startedAt: previousTime, operationId: mutation ? body.operation_id : null };
      databaseAuthorize(body, snapshot.auth);
      if (mutation && snapshot.maintenance) throw new Error('Sistem sedang pemeliharaan. Silakan coba lagi.');
      if (mutation && !claimed) {
        const claim = supabaseRpc('claim', { p_id: body.operation_id, p_fingerprint: databaseDigest(JSON.stringify(input)), p_lease: lease });
        if (claim.error) return claim;
        if (claim.response) return claim.response;
        claimed = true;
        databaseRequest.startedAt = claim.started_at;
        // Re-read against the operation's original WIB date after a midnight retry.
        databaseRequest.snapshot = databaseSnapshot(body);
        databaseAuthorize(body, databaseRequest.snapshot.auth);
      }
      const result = databaseHandle(body);
      if (!mutation || result.error) return result;
      const versions = {};
      Object.keys(databaseRequest.snapshot.datasets).forEach(function(name) { versions[name] = databaseRequest.snapshot.datasets[name].revision; });
      const changes = [];
      Object.keys(databaseRequest.sheets).forEach(function(name) { changes.push.apply(changes, databaseRequest.sheets[name].changes()); });
      const committed = supabaseRpc('commit', {
        p_id: body.operation_id, p_lease: lease, p_versions: versions, p_changes: changes,
        p_response: result, p_key: PropertiesService.getScriptProperties().getProperty('CREDENTIAL_EXPORT_KEY')
      });
      if (!committed.conflict) return committed;
    }
    return { error: 'Data baru saja berubah. Silakan coba lagi dengan data yang sama.' };
  } finally {
    databaseRequest = null;
    if (claimed) {
      try { supabaseRpc('release', { p_id: body.operation_id, p_lease: lease }); } catch (_) { /* Lease expires safely. */ }
    }
  }
}

function databaseHandle(body) {
  switch (body.action) {
    case 'getAbsensi': case 'downloadAbsensi': return handleGetAbsensi(body.dari, body.sampai, body.karyawan_id);
    case 'cekStatusHariIni': return handleCekStatusHariIni(body.karyawan_id);
    case 'getEmployeeDashboard': {
      const employee = databaseRequest.snapshot.auth.employee;
      return handleGetEmployeeDashboard(employee.id, employee.jabatan, employee.nama);
    }
    case 'getJabatanAdmin': return { success: true, data: sheetToObjects('Jabatan') };
    case 'simpanJabatan': return handleSimpanJabatan(body);
    case 'getSyncStatus': return handleGetSyncStatus(body);
    case 'syncSheets': return handleSyncSheets(body);
    default: {
      const handlers = {
        getKaryawan: handleGetKaryawan, getJabatan: handleGetJabatan, getPengaturan: handleGetPengaturan,
        verifyPin: handleVerifyPin, adminLogin: handleAdminLogin, getAbsensiHariIni: handleGetAbsensiHariIni,
        getReport: handleGetReport, clockIn: handleClockIn, clockOut: handleClockOut,
        setTodoStatus: handleSetTodoStatus, uploadFotoBriefing: handleUploadFotoBriefing,
        getAllEmployees: handleGetAllEmployees, tambahKaryawan: handleTambahKaryawan, editKaryawan: handleEditKaryawan,
        getShiftKhusus: handleGetShiftKhusus, tambahShiftKhusus: handleTambahShiftKhusus, hapusShiftKhusus: handleHapusShiftKhusus,
        getAdminNotes: handleGetAdminNotes, tambahAdminNote: handleTambahAdminNote, hapusAdminNote: handleHapusAdminNote,
        getPengumumanAdmin: handleGetPengumumanAdmin, tambahPengumuman: handleTambahPengumuman, editPengumuman: handleEditPengumuman,
        hapusPengumuman: handleHapusPengumuman, updatePengumumanStatus: handleUpdatePengumumanStatus,
        getReservasiAdmin: handleGetReservasiAdmin, tambahReservasi: handleTambahReservasi, editReservasi: handleEditReservasi, hapusReservasi: handleHapusReservasi,
        getTodosAdmin: handleGetTodosAdmin, tambahTodo: handleTambahTodo, editTodo: handleEditTodo, hapusTodo: handleHapusTodo,
        editPengaturan: handleEditPengaturan
      };
      return handlers[body.action](body);
    }
  }
}

/** Small in-memory adapter keeps the existing business rules and response contracts.
 * Changes are committed together in a database transaction, never cell-by-cell. */
function databaseSheet(name) {
  if (!databaseRequest.snapshot.datasets[name]) throw new Error('Dataset tidak dimuat: ' + name);
  if (databaseRequest.sheets[name]) return databaseRequest.sheets[name];
  const source = databaseRequest.snapshot.datasets[name];
  const headers = source.headers.slice();
  const rows = [headers].concat(source.rows.map(function(row) { return headers.map(function(h) { return row.data[h] === undefined ? '' : row.data[h]; }); }));
  const initial = source.rows;
  const clone = function(data) { return data.map(function(row) { return row.slice(); }); };
  const display = function(value) { return typeof value === 'boolean' ? String(value).toUpperCase() : String(value == null ? '' : value); };
  const range = function(row,col,height,width) {
    height = height || 1; width = width || 1;
    return {
      getValues: function() { return Array.from({ length:height }, function(_,i) { return Array.from({ length:width },function(_,j) { return (rows[row+i-1] || [])[col+j-1] ?? ''; }); }); },
      getDisplayValues: function() { return this.getValues().map(function(r) { return r.map(display); }); },
      getValue: function() { return this.getValues()[0][0]; },
      setNumberFormat: function() { return this; },
      setValue: function(value) { return this.setValues([[value]]); },
      setValues: function(values) {
        if (row === 1) throw new Error('Header database tidak boleh diubah');
        if (values.length !== height || values.some(function(r) { return r.length !== width; })) throw new Error('Ukuran data tidak cocok');
        values.forEach(function(r,i) {
          while (rows.length<row+i) rows.push(headers.map(function() { return ''; }));
          r.forEach(function(v,j) { rows[row+i-1][col+j-1]=display(v); });
        });
        return this;
      }
    };
  };
  const sheet = {
    getDataRange: function() { return range(1,1,rows.length,headers.length); },
    getRange: range, getLastRow: function() { return rows.length; }, getLastColumn: function() { return headers.length; },
    appendRow: function(row) {
      if (row.length !== headers.length) throw new Error('Kolom tidak cocok: ' + name);
      rows.push(row.map(display));
    },
    deleteRow: function(row) { if(row<=1 || row>rows.length) throw new Error('Baris tidak valid'); rows.splice(row-1,1); },
    changes: function() {
      const changes = []; const current = new Set();
      clone(rows).slice(1).forEach(function(row) {
        const id=display(row[0]); if(!id || current.has(id)) throw new Error('ID kosong/duplikat: ' + name);
        current.add(id);
        const before=initial.find(function(r) { return r.id===id; });
        const data={}; headers.forEach(function(h,i) {
          // Unchanged redacted credentials must never replace the stored secret.
          if (before && before.data[h] === undefined && row[i] === '') return;
          data[h]=display(row[i]);
        });
        if (!before || JSON.stringify(data)!==JSON.stringify(headers.reduce(function(acc,h) { if(before.data[h]!==undefined) acc[h]=before.data[h]; return acc; },{}))) {
          changes.push({dataset:name,id,kind:before?'update':'insert',data});
        }
      });
      initial.forEach(function(row) { if(!current.has(row.id)) changes.push({dataset:name,id:row.id,kind:'delete'}); });
      return changes;
    }
  };
  databaseRequest.sheets[name]=sheet;
  return sheet;
}

function handleSimpanJabatan(body) {
  if (databaseRequest.snapshot.auth.role !== 'admin') return {error:'Akses ditolak. Hanya admin.'};
  const name=String(body.jabatan || '').trim();
  if(!name) return {error:'Nama jabatan diperlukan'};
  const active=body.aktif !== false;
  if(!active && sheetToObjects('Karyawan').some(function(e) { return e.jabatan===name && String(e.aktif).toUpperCase()==='TRUE'; })) {
    return {error:'Jabatan masih digunakan karyawan aktif. Ubah jabatan karyawan terlebih dahulu.'};
  }
  const sheet=getSheet('Jabatan'); const rows=sheet.getDataRange().getDisplayValues();
  const existing=rows.findIndex(function(row,i) { return i>0 && row[0].toLowerCase()===name.toLowerCase(); });
  if(existing>0) sheet.getRange(existing+1,2).setValue(active?'TRUE':'FALSE');
  else sheet.appendRow([name,active?'TRUE':'FALSE']);
  return {success:true,message:'Jabatan disimpan'};
}
