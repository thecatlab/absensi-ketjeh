/** One-way reporting mirror. No operational write ever falls back to Sheets. */
function mirrorCellValue(dataset, field, value) {
  if (value == null) return '';
  if (['aktif','selesai'].indexOf(field) !== -1 && /^(true|false)$/i.test(String(value))) return String(value).toUpperCase() === 'TRUE';
  if (dataset === 'Absensi' && ['durasi_jam','lat_masuk','lng_masuk','lat_keluar','lng_keluar'].indexOf(field) !== -1
      && String(value) !== '' && Number.isFinite(Number(value))) return Number(value);
  return String(value);
}

function mirrorEqual(left,right) {
  if (typeof left === 'boolean') left=String(left).toUpperCase();
  if (typeof right === 'boolean') right=String(right).toUpperCase();
  return String(left == null ? '' : left) === String(right == null ? '' : right);
}

function mirrorPlan(exported, current) {
  const updates=[]; const manifest={};
  if (!exported || exported.format!==1 || exported.datasets.length!==Object.keys(DATABASE_HEADERS).length) throw new Error('Export database tidak lengkap');
  exported.datasets.forEach(function(dataset) {
    const name=dataset.name;
    if (!DATABASE_HEADERS[name] || JSON.stringify(dataset.headers)!==JSON.stringify(DATABASE_HEADERS[name])) throw new Error('Skema tidak cocok: '+name);
    const headers=dataset.headers.concat(['_deleted_at']);
    const source=exported.records.filter(function(r) { return r.dataset===name; }).sort(function(a,b) { return a.ordinal-b.ordinal; });
    const target=current[name];
    if (!target) throw new Error('Tab mirror tidak ditemukan: '+name);
    const existingHeaders=target[0] || [];
    if (dataset.headers.some(function(h,i) { return existingHeaders[i]!==h; }) || (existingHeaders[headers.length-1] && existingHeaders[headers.length-1]!=='_deleted_at')) {
      throw new Error('Kolom mirror berubah: '+name);
    }
    const seen=new Set();
    source.forEach(function(record,i) {
      if(seen.has(record.id) || !record.id) throw new Error('ID sumber duplikat/kosong: '+name);
      seen.add(record.id);
      // The stable key and row ordinal are the mapping. Never overwrite another row.
      const existing=target[i+1] || [];
      if (existing.some(function(v) { return v!==''; }) && String(existing[0])!==record.id) throw new Error('Urutan baris mirror berubah: '+name);
      const values=headers.map(function(h) { return h==='_deleted_at' ? record.deleted_at || '' : mirrorCellValue(name,h,record.data[h]); });
      if (values.some(function(v,j) { return !mirrorEqual(v,existing[j]); })) updates.push({sheet:name,row:i+2,values});
    });
    if(target.slice(source.length+1).some(function(row) { return row.some(function(v) { return v!==''; }); })) throw new Error('Ada baris tambahan di mirror: '+name);
    if(existingHeaders[headers.length-1]!=='_deleted_at') updates.push({sheet:name,row:1,values:headers});
    manifest[name]={count:source.length,active:source.filter(function(r) { return !r.deleted_at; }).length,revision:dataset.revision};
  });
  return {updates,manifest};
}

function mirrorRead(id) {
  const names=Object.keys(DATABASE_HEADERS);
  const ranges=names.map(function(name) { return "'"+name+"'!A:"+mirrorColumn(DATABASE_HEADERS[name].length+1); });
  const result=Sheets.Spreadsheets.Values.batchGet(id,{ranges,valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'FORMATTED_STRING'});
  if(result.valueRanges.length!==names.length) throw new Error('Pembacaan mirror tidak lengkap');
  const current={};names.forEach(function(name,i){current[name]=result.valueRanges[i].values||[];});return current;
}

function mirrorColumn(number) {
  let label='';while(number>0){number--;label=String.fromCharCode(65+number%26)+label;number=Math.floor(number/26);}return label;
}

function syncSupabaseToSheets() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) return {success:false,error:'Sinkronisasi masih berjalan'};
  const properties=PropertiesService.getScriptProperties();
  const started=Date.now();
  try {
    if(databaseMode()!=='supabase') throw new Error('Supabase belum diaktifkan');
    const id=properties.getProperty('SPREADSHEET_ID');
    if(!id) throw new Error('SPREADSHEET_ID belum disetel');
    const exported=supabaseRpc('export',{p_key:properties.getProperty('CREDENTIAL_EXPORT_KEY')});
    const plan=mirrorPlan(exported,mirrorRead(id));
    // Only changed rows; RAW preserves user text beginning with '=' as literal text.
    for(let i=0;i<plan.updates.length;i+=200){
      Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:plan.updates.slice(i,i+200).map(function(update){
        return {range:"'"+update.sheet+"'!A"+update.row+':'+mirrorColumn(update.values.length)+update.row,values:[update.values]};
      })},id);
    }
    const verification=mirrorPlan(exported,mirrorRead(id));
    if(verification.updates.length) throw new Error('Verifikasi mirror gagal');
    const status={configured:true,last_success:new Date().toISOString(),snapshot_at:exported.captured_at,
      duration_ms:Date.now()-started,changed_rows:plan.updates.length,datasets:verification.manifest,error:null};
    properties.setProperty('SHEETS_SYNC_STATUS',JSON.stringify(status));
    return {success:true,data:status};
  } catch(error) {
    const previous=JSON.parse(properties.getProperty('SHEETS_SYNC_STATUS')||'{}');
    properties.setProperty('SHEETS_SYNC_STATUS',JSON.stringify(Object.assign(previous,{error:error.message,last_attempt:new Date().toISOString()})));
    throw error;
  } finally { lock.releaseLock(); }
}

function handleGetSyncStatus() {
  const properties=PropertiesService.getScriptProperties();
  const status=JSON.parse(properties.getProperty('SHEETS_SYNC_STATUS')||'{"configured":false}');
  status.stale=!status.last_success || Date.now()-new Date(status.last_success).getTime()>15*60*1000;
  status.backup=JSON.parse(properties.getProperty('DATABASE_BACKUP_STATUS')||'null');
  return {success:true,data:status};
}

function handleSyncSheets() {
  if(databaseRequest.snapshot.auth.role!=='admin') return {error:'Akses ditolak. Hanya admin.'};
  return syncSupabaseToSheets();
}

function backupSupabaseDatabase() {
  const properties=PropertiesService.getScriptProperties();
  const folderId=properties.getProperty('DATABASE_BACKUP_FOLDER_ID');
  if(!folderId) throw new Error('Folder backup privat belum disetel');
  try {
    const exported=supabaseRpc('export',{p_key:null});
    const json=JSON.stringify(exported);
    const date=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyyMMdd-HHmmss');
    const folder=DriveApp.getFolderById(folderId);
    if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE) throw new Error('Folder backup harus privat');
    const file=folder.createFile(Utilities.newBlob(json,'application/json','ketjeh-database-'+date+'.json'));
    const digest=databaseDigest(json);
    if(databaseDigest(file.getBlob().getDataAsString())!==digest) throw new Error('Verifikasi backup gagal');
    properties.setProperty('DATABASE_BACKUP_STATUS',JSON.stringify({last_success:new Date().toISOString(),file_id:file.getId(),sha256:digest,records:exported.records.length}));
  } catch(error) {
    const old=JSON.parse(properties.getProperty('DATABASE_BACKUP_STATUS')||'{}');
    properties.setProperty('DATABASE_BACKUP_STATUS',JSON.stringify(Object.assign(old,{error:error.message})));
    throw error;
  }
}

// Run once from the restaurant account after the deployed API and manual sync pass.
function installDatabaseTriggers() {
  if(Session.getEffectiveUser().getEmail()!=='restoketjeh@gmail.com') throw new Error('Gunakan akun restoketjeh@gmail.com');
  const triggers=ScriptApp.getProjectTriggers();
  if(!triggers.some(function(t){return t.getHandlerFunction()==='syncSupabaseToSheets';})) ScriptApp.newTrigger('syncSupabaseToSheets').timeBased().everyMinutes(5).create();
  if(!triggers.some(function(t){return t.getHandlerFunction()==='backupSupabaseDatabase';})) ScriptApp.newTrigger('backupSupabaseDatabase').timeBased().atHour(2).everyDays(1).inTimezone('Asia/Jakarta').create();
}

// Existing data tabs keep stable rows and a deletion marker. Calculation tabs
// expose only active rows, so deleted reservations/notes cannot inflate totals.
function createActiveCalculationTabs() {
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const workbook=SpreadsheetApp.openById(id);
  Object.keys(DATABASE_HEADERS).forEach(function(name){
    const viewName='Aktif_'+name;
    if(workbook.getSheetByName(viewName)) throw new Error('Tab sudah ada, periksa sebelum mengganti: '+viewName);
    const sheet=workbook.insertSheet(viewName);
    const deleted=mirrorColumn(DATABASE_HEADERS[name].length+1);
    sheet.getRange(1,1).setFormula('=QUERY(\''+name+'\'!A:'+deleted+',"select '+DATABASE_HEADERS[name].map(function(_,i){return mirrorColumn(i+1);}).join(',')+' where A is not null and '+deleted+' is null",1)');
    sheet.setFrozenRows(1);
    sheet.getRange(1,1).setNote('Data aktif dari Supabase. Buat perhitungan manual di tab terpisah.');
  });
}
