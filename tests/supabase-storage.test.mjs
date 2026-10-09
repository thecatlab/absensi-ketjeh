import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';

const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  const properties = { DATABASE_MODE: 'supabase', CREDENTIAL_EXPORT_KEY: 'synthetic-key-only-for-automated-tests' };
  const context = vm.createContext({
    Date, Set, console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] || null }) },
    Utilities: {
      getUuid: randomUUID,
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()],
      formatDate: (date, zone, format) => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type,p.value]));
        return format.replace('yyyy',parts.year).replace('MM',parts.month).replace('dd',parts.day).replace('HH',parts.hour).replace('mm',parts.minute).replace('ss',parts.second);
      },
    },
  });
  for (const file of ['Code','Helpers','Admin','Absensi','Dashboard','Supabase','Sync']) vm.runInContext(readFileSync(new URL('../gas/'+file+'.gs',import.meta.url),'utf8'),context);
  const headers = plain(vm.runInContext('DATABASE_HEADERS',context));
  const snapshot = { auth: { role:'employee', employee:{id:'K001',nama:'Test employee',jabatan:'Bartender',aktif:'TRUE'} }, maintenance:false, datasets:{} };
  for (const [name, columns] of Object.entries(headers)) snapshot.datasets[name]={headers:columns,revision:0,rows:[]};
  const add = (name,data) => snapshot.datasets[name].rows.push({id:data[headers[name][0]],ordinal:snapshot.datasets[name].rows.length+1,data});
  add('Karyawan',{id:'K001',nama:'Test employee',jabatan:'Bartender',kategori:'on-site',aktif:'TRUE',tanggal_masuk:'2026-01-01'});
  add('Jabatan',{jabatan:'Bartender',aktif:'TRUE'});
  add('Pengaturan',{key:'admin_password',keterangan:''});
  add('Pengaturan',{key:'manager_password',keterangan:''});
  add('Pengaturan',{key:'shift_mulai',value:'08:00',keterangan:''});
  add('Pengaturan',{key:'geofence_lat',value:'-7',keterangan:''});
  add('Pengaturan',{key:'geofence_lng',value:'110',keterangan:''});
  add('Pengaturan',{key:'briefing_photo_roles',value:'Manager,Captain Floor',keterangan:''});
  const operations = new Map();
  const fingerprints = new Map();
  const commits = [];
  let conflict = false;
  context.supabaseRpc=(name,args)=>{
    if(name==='snapshot') return structuredClone(snapshot);
    if(name==='claim') {
      const existing=operations.get(args.p_id);
      if(existing) return {response:existing};
      fingerprints.set(args.p_id,args.p_fingerprint);
      return {started_at:'2026-10-02T01:00:00.000Z'};
    }
    if(name==='receipt') return fingerprints.get(args.p_id)===args.p_fingerprint ? operations.get(args.p_id)||null : null;
    if(name==='release') return null;
    if(name==='commit') {
      if(conflict) {conflict=false;return {conflict:true};}
      commits.push(plain(args));
      operations.set(args.p_id,plain(args.p_response));
      for(const change of args.p_changes) {
        const table=snapshot.datasets[change.dataset];
        const row=table.rows.find(r=>r.id===change.id);
        if(change.kind==='insert')table.rows.push({id:change.id,ordinal:table.rows.length+1,data:plain(change.data)});
        if(change.kind==='update')row.data=plain(change.data);
        if(change.kind==='delete')table.rows=table.rows.filter(r=>r.id!==change.id);
        table.revision++;
      }
      return args.p_response;
    }
    throw new Error('Unexpected RPC '+name);
  };
  const request=(action,body={})=>plain(context.databaseDispatch({action,karyawan_id:'K001',pin:'0012',...body},'POST'));
  return {context,snapshot,headers,add,commits,request,conflict:()=>{conflict=true;}};
}

test('private reads reject an old GET client and employee cannot read another employee history',()=>{
  const {context,request}=setup();
  assert.equal(context.databaseDispatch({action:'getAbsensi'},'GET').code,'CLIENT_UPDATE_REQUIRED');
  assert.throws(()=>request('getAbsensi',{karyawan_id:'K002',dari:'2026-10-01',sampai:'2026-10-02'}),/Akses ditolak/);
  assert.throws(()=>request('getAdminNotes'),/Akses ditolak/);
});

test('clock-in is one atomic change, uses verified name and retries return the same receipt',()=>{
  const {context,request,commits,conflict}=setup();
  let uploads=0;
  context.uploadFoto=()=>{uploads++;return 'https://example.test/synthetic-photo';};
  const body={operation_id:randomUUID(),nama:'Forged name',foto_base64:'synthetic',lat:-7,lng:110,catatan:'=1+1'};
  conflict();
  const first=request('clockIn',body);
  assert.equal(first.success,true);
  assert.equal(first.jam_masuk,'2026-10-02 08:00:00');
  assert.equal(commits.length,1);
  assert.equal(commits[0].p_changes.length,1);
  assert.equal(commits[0].p_changes[0].data.nama,'Test employee');
  assert.equal(commits[0].p_changes[0].data.catatan,'=1+1');
  assert.deepEqual(request('clockIn',body),first);
  assert.equal(commits.length,1);
  assert.equal(uploads,2); // conflict retries call the idempotent Drive helper
});

test('clock-out uses WIB timestamps and commits photo, notes, duration together',()=>{
  const {context,request,add,commits}=setup();
  add('Absensi',{id:'A20261002-K001-IN',karyawan_id:'K001',nama:'Test employee',tanggal:'2026-10-02',jam_masuk:'2026-10-02 7:00:00',jam_keluar:'',catatan:'in'});
  context.uploadFoto=()=> 'https://example.test/out';
  const result=request('clockOut',{operation_id:randomUUID(),foto_base64:'synthetic',catatan:'out'});
  assert.equal(result.durasi_jam,1);
  assert.equal(commits[0].p_changes.length,1);
  assert.equal(commits[0].p_changes[0].data.catatan,'in | out');
  assert.equal(commits[0].p_changes[0].data.foto_keluar_url,'https://example.test/out');
});

test('maintenance, missing operation ID, and missing photo do not write',()=>{
  const {snapshot,request,commits}=setup();
  assert.equal(request('clockIn').code,'CLIENT_UPDATE_REQUIRED');
  snapshot.maintenance=true;
  assert.throws(()=>request('clockIn',{operation_id:randomUUID()}),/pemeliharaan/);
  snapshot.maintenance=false;
  assert.match(request('clockIn',{operation_id:randomUUID(),nama:'Test'}).error,/Foto/);
  assert.equal(commits.length,0);
});

test('todo eligibility and briefing role are enforced using database role',()=>{
  const {request,add,commits}=setup();
  add('Todo',{id:'T1',judul:'Private task',target_type:'role',target_value:'Manager',aktif:'TRUE',schedule_type:'daily'});
  assert.match(request('setTodoStatus',{operation_id:randomUUID(),todo_id:'T1',jabatan:'Manager',selesai:true}).error,/tidak tersedia/);
  assert.match(request('uploadFotoBriefing',{operation_id:randomUUID(),nama:'Test',foto_base64:'x',jabatan:'Manager'}).error,/ditolak/);
  assert.equal(commits.length,0);
});

test('legacy duplicate todo statuses retain first-row semantics and both IDs',()=>{
  const {request,add,commits}=setup();
  add('Todo',{id:'T1',judul:'Task',target_type:'all',target_value:'',aktif:'TRUE',schedule_type:'daily'});
  for(const id of ['TS1','TS2'])add('TodoStatus',{id,tanggal:'2026-10-02',karyawan_id:'K001',nama:'Test',todo_id:'T1',selesai:'FALSE',jam_update:'07:00'});
  request('setTodoStatus',{operation_id:randomUUID(),todo_id:'T1',selesai:true});
  assert.deepEqual(commits[0].p_changes.map(r=>r.id),['TS1']);
});

test('manager cannot edit employees or settings; employee can still view reservations',()=>{
  const {snapshot,request,commits}=setup();
  assert.equal(request('getReservasiAdmin').success,true);
  snapshot.auth={role:'manager'};
  assert.match(request('editKaryawan',{operation_id:randomUUID(),password:'synthetic',id:'K001',nama:'Change'}).error,/Hanya admin/);
  assert.match(request('editPengaturan',{operation_id:randomUUID(),password:'synthetic',settings:{admin_password:'change'}}).error,/Hanya admin/);
  assert.equal(commits.length,0);
});

test('unchanged redacted PIN is not replaced when an admin edits an employee',()=>{
  const {snapshot,request,commits}=setup();
  snapshot.auth={role:'admin'};
  request('editKaryawan',{operation_id:randomUUID(),password:'synthetic',id:'K001',nama:'Rename',pin:''});
  assert.equal('pin' in commits[0].p_changes[0].data,false);
  request('editKaryawan',{operation_id:randomUUID(),password:'synthetic',id:'K001',pin:'0007'});
  assert.equal(commits[1].p_changes[0].data.pin,'0007');
});

test('Sheets diff includes more than 1000 records, literal notes, private PIN, tombstones and exact repair',()=>{
  const {context,headers}=setup();
  const exported={format:1,datasets:Object.entries(headers).map(([name,columns])=>({name,headers:columns,revision:2})),records:[]};
  const current=Object.fromEntries(Object.entries(headers).map(([name,columns])=>[name,[columns.slice()]]));
  for(let i=0;i<2050;i++) exported.records.push({dataset:'Absensi',id:'A'+i,ordinal:i+1,data:{id:'A'+i,catatan:'=literal',durasi_jam:'8.50'},deleted_at:i===0?'2026-10-02T00:00:00Z':null});
  exported.records.push({dataset:'Karyawan',id:'K001',ordinal:1,data:{id:'K001',pin:'0012',aktif:'TRUE'}});
  const plan=plain(context.mirrorPlan(exported,current));
  assert.equal(plan.manifest.Absensi.count,2050);
  assert.equal(plan.manifest.Absensi.active,2049);
  for(const update of plan.updates)current[update.sheet][update.row-1]=update.values;
  assert.equal(current.Absensi[1][6],8.5);
  assert.equal(current.Absensi[1][15],'=literal');
  assert.equal(current.Karyawan[1][6],'0012');
  assert.equal(context.mirrorPlan(exported,current).updates.length,0);
  current.Absensi[100][15]='owner edit';
  assert.equal(context.mirrorPlan(exported,current).updates.length,1);
  [current.Absensi[1],current.Absensi[2]]=[current.Absensi[2],current.Absensi[1]];
  assert.throws(()=>context.mirrorPlan(exported,current),/Urutan baris/);
});

test('mirror refuses to replace data in an unnamed deletion-marker column',()=>{
  const {context,headers}=setup();
  const exported={format:1,datasets:Object.entries(headers).map(([name,columns])=>({name,headers:columns,revision:0})),records:[]};
  const current=Object.fromEntries(Object.entries(headers).map(([name,columns])=>[name,[columns.slice()]]));
  current.Absensi.push([...headers.Absensi.map(()=>''),'owner calculation']);
  assert.throws(()=>context.mirrorPlan(exported,current),/sudah berisi data/);
});

test('migration imports defined fields while preserving extra cells in the full backup',()=>{
  const {context,headers}=setup();
  const saved={}; let backup;
  const rows=Object.fromEntries(Object.entries(headers).map(([name,columns])=>[name,[columns.slice()]]));
  rows.Absensi[0].push('','','','');
  rows.Absensi.push(['A1',...Array(15).fill(''),'','','',' ']);
  context.PropertiesService={getScriptProperties:()=>({getProperty:key=>({SPREADSHEET_ID:'qa',DATABASE_BACKUP_FOLDER_ID:'private'})[key],setProperty:(key,value)=>{saved[key]=value;}})};
  context.SpreadsheetApp={openById:()=>({getSheetByName:name=>({getDataRange:()=>({getDisplayValues:()=>rows[name],getValues:()=>rows[name],getFormulas:()=>[],getNumberFormats:()=>[],getNotes:()=>[]})})})};
  context.Utilities.newBlob=value=>value;
  context.DriveApp={Access:{PRIVATE:'private'},getFolderById:()=>({getSharingAccess:()=> 'private',createFile:value=>{backup=JSON.parse(value);return {getId:()=> 'backup-id'};}})};
  context.console={log:()=>{}};
  vm.runInContext(readFileSync(new URL('../gas/Migration.gs',import.meta.url),'utf8'),context);
  context.captureMigrationSource();
  assert.equal(backup.datasets.Absensi.headers.length,16);
  assert.equal(Object.keys(backup.datasets.Absensi.rows[0]).length,16);
  assert.equal(backup.source.Absensi.display[1][19],' ');
  assert.equal(saved.MIGRATION_SOURCE_FILE_ID,'backup-id');
  rows.Absensi[0][16]='unexpected operational field';
  assert.throws(()=>context.captureMigrationSource(),/Unexpected columns/);
});

test('mirror expands only needed grid dimensions and preserves numeric dates and cell formats',()=>{
  const {context}=setup();
  const calls=[];
  context.Sheets={Spreadsheets:{get:()=>({sheets:[{properties:{sheetId:7,title:'Absensi',gridProperties:{rowCount:2053,columnCount:16}}}]}),batchUpdate:body=>calls.push(plain(body))}};
  const values=Array(17).fill('');values[0]='QA';values[3]=context.mirrorCellValue('Absensi','tanggal','2026-10-02');values[4]=context.mirrorCellValue('Absensi','jam_masuk','2026-10-02 8:16:49');values[15]='=literal';
  const update={sheet:'Absensi',row:2054,values,newRow:true};
  assert.equal(context.mirrorEnsureCapacity('qa',[update]).Absensi,7);
  assert.deepEqual(calls[0].requests.map(r=>r.appendDimension),[{sheetId:7,dimension:'ROWS',length:1},{sheetId:7,dimension:'COLUMNS',length:1}]);
  assert.ok(Math.abs((values[4]-values[3])*86400-(8*3600+16*60+49))<0.0001);
  const writes=plain(context.mirrorWriteRequests(update,7));
  assert.deepEqual(writes[0].updateCells.rows[0].values[15],{userEnteredValue:{stringValue:'=literal'}});
  assert.equal(writes[0].updateCells.fields,'userEnteredValue');
  assert.equal(writes.length,3);
  assert.equal(context.mirrorWriteRequests({...update,newRow:false},7).length,1);
});

test('mirror accepts a date serial as the stable key of a special shift',()=>{
  const {context,headers}=setup();
  const exported={format:1,datasets:Object.entries(headers).map(([name,columns])=>({name,headers:columns,revision:0})),records:[{dataset:'ShiftKhusus',id:'2099-12-31',ordinal:1,data:{tanggal:'2099-12-31',nama_hari:'QA'}}]};
  const current=Object.fromEntries(Object.entries(headers).map(([name,columns])=>[name,[columns.concat('_deleted_at')]]));
  current.ShiftKhusus.push([context.mirrorCellValue('ShiftKhusus','tanggal','2099-12-31'),'QA','','','','']);
  assert.equal(context.mirrorPlan(exported,current).updates.length,0);
});

test('an exact password-change retry recovers its receipt after the old login expires',()=>{
  const {snapshot,request,commits}=setup();
  snapshot.auth={role:'admin'};
  const body={password:'old-admin',operation_id:randomUUID(),settings:{admin_password:'new-admin'}};
  const result=request('editPengaturan',body);
  assert.equal(result.success,true);
  snapshot.auth={};
  assert.deepEqual(request('editPengaturan',body),result);
  assert.equal(commits.length,1);
  assert.throws(()=>request('editPengaturan',{...body,settings:{admin_password:'different'}}),/Akses ditolak/);
});

test('a retry after midnight keeps the original attendance date and photo name',()=>{
  const {context,request,commits}=setup();
  const rpc=context.supabaseRpc;
  const filters=[];
  context.supabaseRpc=(name,args)=>{
    if(name==='snapshot') filters.push(args.p_filter);
    const result=rpc(name,args);
    return name==='claim' && !result.response ? {...result,started_at:'2026-10-01T16:59:59Z'} : result;
  };
  context.uploadFoto=(_,name)=>'https://example.test/'+name;
  const response=request('clockIn',{operation_id:randomUUID(),foto_base64:'synthetic'});
  assert.equal(response.jam_masuk,'2026-10-01 23:59:59');
  assert.equal(filters.at(-1).from,'2026-10-01');
  assert.equal(commits[0].p_changes[0].data.tanggal,'2026-10-01');
  assert.match(commits[0].p_changes[0].data.foto_masuk_url,/2026-10-01/);
});

test('an uploaded photo survives a failed database save and is reused on retry',()=>{
  const {context,request,commits}=setup();
  const files=new Map();
  let created=0;
  const folder={
    getFilesByName:name=>({hasNext:()=>files.has(name),next:()=>files.get(name)}),
    createFile:blob=>{created++;const file={url:'https://example.test/photo-'+created};files.set(blob.name,file);return file;},
  };
  context.uploadFoto=(_,name)=>context.createOperationPhoto(folder,{setName(value){this.name=value;}},name).url;
  const rpc=context.supabaseRpc;
  let fail=true;
  context.supabaseRpc=(name,args)=>{
    if(name==='commit' && fail) {fail=false;throw new Error('Simulated database interruption');}
    return rpc(name,args);
  };
  const body={operation_id:randomUUID(),foto_base64:'synthetic'};
  assert.throws(()=>request('clockIn',body),/Simulated database interruption/);
  assert.equal(commits.length,0);
  assert.equal(files.size,1);
  assert.equal(request('clockIn',body).success,true);
  assert.equal(created,1);
  assert.equal(commits.length,1);
});

test('Drive authorization failure cannot create attendance without its photo',()=>{
  const {context,request,commits}=setup();
  context.uploadFoto=()=>{throw new Error('Akses ditolak: DriveApp');};
  assert.throws(()=>request('clockIn',{operation_id:randomUUID(),foto_base64:'synthetic'}),/DriveApp/);
  assert.equal(commits.length,0);
});
