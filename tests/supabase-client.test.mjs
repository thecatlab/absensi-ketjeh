import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

function client() {
  const calls=[]; const results=[];
  let epoch=0;
  const invalidations=[];
  const context=vm.createContext({
    resetReadSession:()=>{epoch++;}, readSession:()=>epoch, seedRead:()=>{}, invalidateReads:action=>invalidations.push(action),
    window:{dispatchEvent(){}}, CustomEvent:class { constructor(type,options) { this.type=type;this.detail=options.detail; } },
    CONFIG:{APPS_SCRIPT_URL:'https://api.example.test/exec'},URL,crypto:{randomUUID},
    fetch:async(url,options)=>{
      calls.push({url,options});
      const result=results.shift();
      if(result instanceof Error)throw result;
      return {ok:true,json:async()=>result||{success:true}};
    }
  });
  const source=readFileSync(new URL('../src/api/client.js',import.meta.url),'utf8')
    .replace(/^import[\s\S]*?from\s+'[^']+';\n/gm,'')
    .replaceAll('import.meta.env', '({DEV:false,VITE_USE_MOCKS:"false"})')
    .replaceAll('export ','');
  vm.runInContext(source,context);
  return {context,calls,results,invalidations};
}

test('private reads pass the existing in-memory PIN in POST, never in URL',async()=>{
  const {context,calls,results}=client();
  context.setEmployeeCredential('K001','0012');
  await context.getAbsensi('2026-10-01','2026-10-02','K001');
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].url,'/api/read');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(JSON.parse(calls[0].options.body).pin,'0012');
  context.setEmployeeCredential(null,null);
  await context.getAbsensi('2026-10-01','2026-10-02','K001');
  assert.equal(JSON.parse(calls[1].options.body).pin,undefined);
  results.push(new Error('Connection interrupted'));
  assert.equal((await context.getAbsensi('2026-10-01','2026-10-02','K001')).error,'Koneksi terputus. Silakan coba lagi.');
});

test('network failure preserves operation ID; successful save then allows a new operation',async()=>{
  const {context,calls,results}=client();
  const data={karyawan_id:'K001',nama:'Test',pin:'0012',foto_base64:'synthetic'};
  results.push(new Error('lost response'));
  assert.ok((await context.clockIn(data)).error);
  assert.ok((await context.clockIn(data)).success);
  await context.clockIn(data);
  const ids=calls.map(call=>JSON.parse(call.options.body).operation_id);
  assert.equal(ids[0],ids[1]);
  assert.notEqual(ids[1],ids[2]);
});

test('employee actions do not inherit an admin password and vice versa',async()=>{
  const {context,calls}=client();
  context.setEmployeeCredential('K001','0012');
  context.setAdminCredential('test-admin');
  await context.gasPost('setTodoStatus',{todo_id:'T1'});
  await context.getAdminNotes();
  assert.equal(JSON.parse(calls[0].options.body).password,undefined);
  assert.equal(JSON.parse(calls[0].options.body).pin,'0012');
  assert.equal(JSON.parse(calls[1].options.body).password,'test-admin');
  assert.equal(JSON.parse(calls[1].options.body).pin,undefined);
});

test('empty/malformed success responses are errors, not successful attendance',async()=>{
  const {context,results}=client();
  results.push({});
  assert.ok((await context.clockIn({karyawan_id:'K001',nama:'Test',pin:'0012'})).error);
});


test('shared admin reads retain the current password when an optional argument is omitted',async()=>{
  const {context,calls,results}=client();
  context.setAdminCredential('synthetic-admin');
  results.push({success:true,data:[]});
  await context.getAdminEmployees();
  await context.getReport('2026-10-01','2026-10-02');
  for(const call of calls) assert.equal(JSON.parse(call.options.body).password,'synthetic-admin');
});

test('writes still use Apps Script and invalidate only after a confirmed save',async()=>{
  const {context,calls,results,invalidations}=client();
  results.push(new Error('response lost'));
  const data={karyawan_id:'K001',nama:'Test',pin:'0012',foto_base64:'synthetic'};
  await context.clockIn(data);
  assert.deepEqual(invalidations,[]);
  await context.clockIn(data);
  assert.deepEqual(invalidations,['clockIn']);
  assert.ok(calls.every(call=>call.url==='https://api.example.test/exec'));
});

test('a changed PIN or password clears the rejected credential and private session',async()=>{
  for(const role of ['employee','admin']) {
    const {context,calls,results}=client();
    if(role==='employee')context.setEmployeeCredential('K001','old-pin');
    else context.setAdminCredential('old-password');
    const epoch=context.readSession();
    results.push({error:'Akses ditolak. Verifikasi PIN atau login kembali.',code:'AUTH_REQUIRED'});
    const read=()=>role==='employee'?context.getAbsensi('2026-10-01','2026-10-02','K001'):context.getAdminNotes();
    await read();
    assert.ok(context.readSession()>epoch);
    await read();
    const body=JSON.parse(calls[1].options.body);
    assert.equal(body.pin,undefined);
    assert.equal(body.password,undefined);
  }
});
