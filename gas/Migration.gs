/** Editor-only migration tools. Never add these functions to the public router. */
function captureMigrationSource() {
  const properties=PropertiesService.getScriptProperties();
  const id=properties.getProperty('SPREADSHEET_ID');
  const folderId=properties.getProperty('DATABASE_BACKUP_FOLDER_ID');
  if(!id || !folderId) throw new Error('Set workbook and private backup folder first');
  const folder=DriveApp.getFolderById(folderId);
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE) throw new Error('Backup folder must be private');
  const workbook=SpreadsheetApp.openById(id);
  const manifest={format:1,captured_at:new Date().toISOString(),spreadsheet_id:id,datasets:{},source:{}};
  Object.keys(DATABASE_HEADERS).forEach(function(name){
    const sheet=workbook.getSheetByName(name);
    if(!sheet) throw new Error('Missing tab: '+name);
    const range=sheet.getDataRange();
    const display=range.getDisplayValues();
    const headers=display[0];
    if(JSON.stringify(headers)!==JSON.stringify(DATABASE_HEADERS[name])) throw new Error('Unexpected columns: '+name);
    const seen=new Set();
    const rows=display.slice(1).map(function(values){
      const data={};headers.forEach(function(h,i){data[h]=values[i];});
      if(!values[0] || seen.has(values[0])) throw new Error('Blank or duplicate source key: '+name);
      seen.add(values[0]);return data;
    });
    manifest.datasets[name]={headers,rows};
    manifest.source[name]={values:range.getValues(),display,formulas:range.getFormulas(),formats:range.getNumberFormats(),notes:range.getNotes()};
  });
  const content=JSON.stringify(manifest);
  const file=folder.createFile(Utilities.newBlob(content,'application/json','ketjeh-source-'+Date.now()+'.json'));
  properties.setProperty('MIGRATION_SOURCE_FILE_ID',file.getId());
  properties.setProperty('MIGRATION_SOURCE_SHA256',databaseDigest(content));
  console.log(JSON.stringify({file_id:file.getId(),sha256:databaseDigest(content),counts:Object.fromEntries(Object.entries(manifest.datasets).map(function(entry){return [entry[0],entry[1].rows.length];}))}));
}

function importMigrationSource() {
  const properties=PropertiesService.getScriptProperties();
  const file=DriveApp.getFileById(properties.getProperty('MIGRATION_SOURCE_FILE_ID'));
  const content=file.getBlob().getDataAsString();
  if(databaseDigest(content)!==properties.getProperty('MIGRATION_SOURCE_SHA256')) throw new Error('Source checksum mismatch');
  const manifest=JSON.parse(content);
  const result=supabaseRpc('import',{p_datasets:manifest.datasets,p_key:properties.getProperty('CREDENTIAL_EXPORT_KEY')});
  console.log(JSON.stringify(result));
  reconcileMigrationSource();
}

function reconcileMigrationSource() {
  const properties=PropertiesService.getScriptProperties();
  const content=DriveApp.getFileById(properties.getProperty('MIGRATION_SOURCE_FILE_ID')).getBlob().getDataAsString();
  if(databaseDigest(content)!==properties.getProperty('MIGRATION_SOURCE_SHA256')) throw new Error('Source checksum mismatch');
  const manifest=JSON.parse(content);
  const exported=supabaseRpc('export',{p_key:properties.getProperty('CREDENTIAL_EXPORT_KEY')});
  const counts={};
  if(exported.datasets.length!==Object.keys(manifest.datasets).length) throw new Error('Dataset count mismatch');
  Object.keys(manifest.datasets).forEach(function(name){
    const expected=manifest.datasets[name];
    const dataset=exported.datasets.find(function(d){return d.name===name;});
    if(JSON.stringify(dataset.headers)!==JSON.stringify(expected.headers)) throw new Error('Header mismatch: '+name);
    const actual=exported.records.filter(function(r){return r.dataset===name;}).sort(function(a,b){return a.ordinal-b.ordinal;});
    if(actual.length!==expected.rows.length) throw new Error('Row count mismatch: '+name);
    expected.rows.forEach(function(row,i){
      if(actual[i].deleted_at || actual[i].id!==row[expected.headers[0]]) throw new Error('Record/order mismatch: '+name);
      expected.headers.forEach(function(field){if(actual[i].data[field]!==row[field]) throw new Error('Field mismatch: '+name+' row '+(i+2)+' '+field);});
    });
    counts[name]=actual.length;
  });
  properties.setProperty('MIGRATION_RECONCILIATION',JSON.stringify({verified_at:new Date().toISOString(),sha256:databaseDigest(content),counts}));
  console.log(JSON.stringify({success:true,counts}));
}
