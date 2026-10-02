import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrations=new URL('../supabase/migrations/',import.meta.url);
const migration=readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort().map(name=>readFileSync(new URL(name,migrations),'utf8')).join('\n');
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../gas/Supabase.gs',import.meta.url),'utf8'),context);
const headers=JSON.parse(vm.runInContext('JSON.stringify(DATABASE_HEADERS)',context));
const key='synthetic-backup-encryption-key-for-tests-only';
async function database() {
  const db=await PGlite.create({extensions:{pgcrypto}});
  await db.exec('create schema extensions; create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public,extensions to service_role;');
  await db.exec(migration);
  return db;
}
async function rpc(db,name,args) {
  const params=Object.keys(args).map((arg,i)=>arg+' => $'+(i+1));
  return (await db.query(`select public.ketjeh_${name}(${params.join(',')}) as result`,Object.values(args))).rows[0].result;
}
function source() {
  const datasets=Object.fromEntries(Object.entries(headers).map(([name,columns])=>[name,{headers:columns,rows:[]} ]));
  datasets.Karyawan.rows=[{id:'K001',nama:'Synthetic employee',jabatan:'Bartender',kategori:'on-site',aktif:'TRUE',tanggal_masuk:'2026-01-01',pin:'0012'}];
  datasets.Pengaturan.rows=[{key:'admin_password',value:' test-admin ',keterangan:''},{key:'manager_password',value:'test-manager',keterangan:''}];
  datasets.Jabatan.rows=[{jabatan:'Bartender',aktif:'TRUE'}];
  for(let i=0;i<2042;i++)datasets.Absensi.rows.push(Object.fromEntries(headers.Absensi.map(h=>[h,h==='id'?'A'+i:h==='karyawan_id'?'K001':h==='tanggal'?'2026-10-01':h==='durasi_jam'?'8.50':h==='catatan'?'=literal note':''])));
  datasets.TodoStatus.rows=[{id:'TS1',tanggal:'2026-10-01',karyawan_id:'K001',todo_id:'T1',selesai:'FALSE'},{id:'TS2',tanggal:'2026-10-01',karyawan_id:'K001',todo_id:'T1',selesai:'FALSE'}];
  return datasets;
}

test('real PostgreSQL import preserves complete data, hashes logins, encrypts exports and restores',async()=>{
  const db=await database();
  const restored=await database();
  try {
    const input=source();
    const imported=await rpc(db,'import',{p_datasets:input,p_key:key});
    assert.equal(imported.count,2048);
    assert.equal((await rpc(db,'auth',{p_auth:{karyawan_id:'K001',pin:'0012'}})).role,'employee');
    assert.deepEqual(await rpc(db,'auth',{p_auth:{karyawan_id:'K001',pin:'12'}}),{});
    assert.equal((await rpc(db,'auth',{p_auth:{password:'test-admin'}})).role,'admin');
    const snapshot=await rpc(db,'snapshot',{p_tables:Object.keys(headers),p_filter:{},p_auth:{password:'test-admin'}});
    assert.equal(snapshot.datasets.Absensi.rows.length,2042);
    assert.equal(snapshot.datasets.TodoStatus.rows.length,2);
    assert.equal('pin' in snapshot.datasets.Karyawan.rows[0].data,false);
    assert.equal('value' in snapshot.datasets.Pengaturan.rows[0].data,false);
    const exported=await rpc(db,'export',{p_key:key});
    for(const [name,dataset] of Object.entries(input)) assert.deepEqual(exported.records.filter(r=>r.dataset===name).map(r=>r.data),dataset.rows);
    const backup=await rpc(db,'export',{p_key:null});
    assert.equal(JSON.stringify(backup).includes('test-admin'),false);
    assert.equal(backup.credentials.every(c=>c.password_hash.startsWith('$2')),true);
    assert.equal((await rpc(restored,'restore',{p_backup:backup})).count,2048);
    assert.equal((await rpc(restored,'auth',{p_auth:{karyawan_id:'K001',pin:'0012'}})).role,'employee');
    const after=await rpc(restored,'export',{p_key:key});
    assert.deepEqual(after.records,exported.records);
    await assert.rejects(()=>rpc(db,'export',{p_key:'wrong-key'}));
    await assert.rejects(()=>rpc(db,'import',{p_datasets:input,p_key:key}),/empty database/);
  } finally {await db.close();await restored.close();}
});

test('duplicate source IDs abort the entire import instead of overwriting history',async()=>{
  const db=await database();
  try {
    const input=source();input.Absensi.rows.push(input.Absensi.rows[0]);
    await assert.rejects(()=>rpc(db,'import',{p_datasets:input,p_key:key}),/Duplicate source ID/);
    assert.equal((await db.query('select count(*)::int as n from public.ketjeh_records')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from public.ketjeh_datasets')).rows[0].n,0);
  } finally {await db.close();}
});

test('database grants block anonymous/authenticated direct access and all tables use RLS',async()=>{
  const db=await database();
  try {
    const tables=(await db.query("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'")).rows;
    assert.equal(tables.length,5);
    assert.ok(tables.every(t=>t.relrowsecurity));
    const functions=(await db.query("select proname,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'ketjeh_%'")).rows;
    assert.ok(functions.length>=9);
    assert.ok(functions.every(f=>!f.anon&&!f.authenticated));
    await db.exec('set role anon');
    await assert.rejects(()=>db.query('select * from public.ketjeh_records'),/permission denied/);
    await assert.rejects(()=>rpc(db,'auth',{p_auth:{}}),/permission denied/);
  } finally {await db.close();}
});

test('transaction receipts prevent repeats; revision conflicts and failures leave rows unchanged',async()=>{
  const db=await database();
  try {
    const input=source();input.Absensi.rows=[];
    await rpc(db,'import',{p_datasets:input,p_key:key});
    await db.exec('update public.ketjeh_control set maintenance=false');
    const id=randomUUID(),lease=randomUUID();
    assert.ok((await rpc(db,'claim',{p_id:id,p_lease:lease,p_fingerprint:'test'})).started_at);
    assert.ok((await rpc(db,'claim',{p_id:id,p_lease:randomUUID(),p_fingerprint:'test'})).error);
    const changes=[{dataset:'Absensi',id:'A1',kind:'insert',data:{id:'A1',karyawan_id:'K001',tanggal:'2026-10-02',jam_masuk:'2026-10-02 08:00:00'}}];
    const args={p_id:id,p_lease:lease,p_versions:{Absensi:0},p_changes:changes,p_response:{success:true,jam_masuk:'2026-10-02 08:00:00'},p_key:key};
    await db.exec('update public.ketjeh_control set maintenance=true');
    assert.match((await rpc(db,'commit',args)).error,/pemeliharaan/);
    assert.equal((await db.query("select count(*)::int as n from public.ketjeh_records where dataset='Absensi'")).rows[0].n,0);
    await db.exec('update public.ketjeh_control set maintenance=false');
    assert.deepEqual(await rpc(db,'commit',{...args,p_versions:{Absensi:9}}),{conflict:true});
    assert.equal((await db.query("select count(*)::int as n from public.ketjeh_records where dataset='Absensi'")).rows[0].n,0);
    await assert.rejects(()=>rpc(db,'commit',{...args,p_changes:[...changes,{dataset:'Absensi',id:'bad',kind:'update',data:{id:'bad'}}]}),/Record missing/);
    assert.equal((await db.query("select count(*)::int as n from public.ketjeh_records where dataset='Absensi'")).rows[0].n,0);
    assert.deepEqual(await rpc(db,'commit',args),args.p_response);
    assert.deepEqual(await rpc(db,'commit',args),args.p_response);
    assert.deepEqual(await rpc(db,'receipt',{p_id:id,p_fingerprint:'test'}),args.p_response);
    assert.equal(await rpc(db,'receipt',{p_id:id,p_fingerprint:'changed'}),null);
    assert.deepEqual((await rpc(db,'claim',{p_id:id,p_lease:randomUUID(),p_fingerprint:'test'})).response,args.p_response);
    const deletionId=randomUUID(),deletionLease=randomUUID();
    await rpc(db,'claim',{p_id:deletionId,p_lease:deletionLease,p_fingerprint:'delete'});
    await rpc(db,'commit',{...args,p_id:deletionId,p_lease:deletionLease,p_versions:{Absensi:1},p_changes:[{dataset:'Absensi',id:'A1',kind:'delete'}]});
    assert.ok((await db.query("select deleted_at from public.ketjeh_records where dataset='Absensi' and id='A1'")).rows[0].deleted_at);
    assert.equal((await rpc(db,'snapshot',{p_tables:['Absensi'],p_filter:{},p_auth:{}})).datasets.Absensi.rows.length,0);
  } finally {await db.close();}
});
