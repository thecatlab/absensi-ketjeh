-- The existing column names and displayed values are the application contract.
-- Records retain their original order; deleted records are retained for recovery.
create extension if not exists pgcrypto with schema extensions;

create table public.ketjeh_datasets (
  name text primary key,
  headers text[] not null,
  revision bigint not null default 0,
  check (cardinality(headers) > 0)
);
create table public.ketjeh_records (
  dataset text not null references public.ketjeh_datasets(name),
  id text not null,
  ordinal bigint not null,
  data jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (dataset, id),
  unique (dataset, ordinal),
  check (jsonb_typeof(data) = 'object')
);
create index ketjeh_attendance_lookup on public.ketjeh_records
  (dataset, (data->>'tanggal'), (data->>'karyawan_id')) where deleted_at is null;
create table public.ketjeh_credentials (
  dataset text not null,
  id text not null,
  field text not null,
  password_hash text not null,
  export_cipher bytea not null,
  primary key (dataset, id, field),
  foreign key (dataset, id) references public.ketjeh_records(dataset, id)
);
create table public.ketjeh_operations (
  id uuid primary key,
  fingerprint text not null,
  lease uuid not null,
  leased_until timestamptz not null,
  started_at timestamptz not null default now(),
  response jsonb,
  completed_at timestamptz
);
create table public.ketjeh_control (
  id boolean primary key default true check (id),
  maintenance boolean not null default true,
  imported_at timestamptz
);
insert into public.ketjeh_control(id) values (true);

alter table public.ketjeh_datasets enable row level security;
alter table public.ketjeh_records enable row level security;
alter table public.ketjeh_credentials enable row level security;
alter table public.ketjeh_operations enable row level security;
alter table public.ketjeh_control enable row level security;
revoke all on public.ketjeh_datasets, public.ketjeh_records, public.ketjeh_credentials,
  public.ketjeh_operations, public.ketjeh_control from public, anon, authenticated;
grant all on public.ketjeh_datasets, public.ketjeh_records, public.ketjeh_credentials,
  public.ketjeh_operations, public.ketjeh_control to service_role;

-- Called exclusively from the authenticated server. Never expose the server key.
create function public.ketjeh_auth(p_auth jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare c public.ketjeh_credentials; employee jsonb;
begin
  if length(coalesce(p_auth->>'password', '')) > 0 then
    for c in select * from public.ketjeh_credentials
      where dataset = 'Pengaturan' and id in ('admin_password', 'manager_password') order by id
    loop
      if c.password_hash = extensions.crypt(p_auth->>'password', c.password_hash) then
        return jsonb_build_object('role', split_part(c.id, '_', 1));
      end if;
    end loop;
  end if;
  if length(coalesce(p_auth->>'pin', '')) > 0 then
    select r.data into employee from public.ketjeh_records r
      join public.ketjeh_credentials pin_credential on pin_credential.dataset=r.dataset and pin_credential.id=r.id and pin_credential.field='pin'
      where r.dataset='Karyawan' and r.id=p_auth->>'karyawan_id' and r.deleted_at is null
      and upper(r.data->>'aktif')='TRUE'
      and pin_credential.password_hash=extensions.crypt(p_auth->>'pin', pin_credential.password_hash);
    if found then return jsonb_build_object('role','employee','employee',employee); end if;
  end if;
  return '{}'::jsonb;
end $$;

-- One scalar JSON snapshot is not subject to PostgREST's returned-row limit.
-- All selected rows and dataset revisions come from the same SQL statement snapshot.
create function public.ketjeh_snapshot(p_tables text[], p_filter jsonb, p_auth jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'auth',public.ketjeh_auth(p_auth),
    'maintenance',(select maintenance from public.ketjeh_control where id),
    'datasets',coalesce((select jsonb_object_agg(d.name,jsonb_build_object(
      'headers',d.headers,'revision',d.revision,
      'rows',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'ordinal',r.ordinal,'data',r.data) order by r.ordinal)
        from public.ketjeh_records r where r.dataset=d.name and r.deleted_at is null
        and (d.name <> 'Absensi' or (
          (coalesce(p_filter->>'from','')='' or r.data->>'tanggal' >= p_filter->>'from') and
          (coalesce(p_filter->>'to','')='' or r.data->>'tanggal' <= p_filter->>'to') and
          (coalesce(p_filter->>'employee','')='' or r.data->>'karyawan_id'=p_filter->>'employee')
        ))),'[]'::jsonb))) from public.ketjeh_datasets d where d.name=any(p_tables)),'{}'::jsonb));
$$;

create function public.ketjeh_claim(p_id uuid, p_fingerprint text, p_lease uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op public.ketjeh_operations;
begin
  if (select maintenance from public.ketjeh_control where id) then
    return jsonb_build_object('error','Sistem sedang pemeliharaan. Silakan coba lagi.');
  end if;
  insert into public.ketjeh_operations(id,fingerprint,lease,leased_until)
    values(p_id,p_fingerprint,p_lease,now()+interval '7 minutes') on conflict do nothing;
  select * into op from public.ketjeh_operations where id=p_id for update;
  if op.fingerprint<>p_fingerprint then raise exception 'Operation ID conflict'; end if;
  if op.response is not null then return jsonb_build_object('response',op.response); end if;
  if op.lease<>p_lease and op.leased_until>now() then
    return jsonb_build_object('error','Permintaan sebelumnya masih diproses. Coba lagi dengan data yang sama.');
  end if;
  update public.ketjeh_operations set lease=p_lease,leased_until=now()+interval '7 minutes' where id=p_id;
  return jsonb_build_object('started_at',op.started_at);
end $$;

-- Store credentials separately: bcrypt for login, AES-256 export copy for the
-- explicitly requested private Sheets mirror. The encryption key is not stored here.
create function public.ketjeh_put_record(p_dataset text,p_id text,p_ordinal bigint,p_data jsonb,p_key text)
returns void language plpgsql security invoker set search_path = '' as $$
declare f text; secret text; clean jsonb := p_data;
begin
  if not exists(select 1 from public.ketjeh_datasets where name=p_dataset and p_data->>headers[1]=p_id
    and not exists(select 1 from jsonb_object_keys(p_data) as k where not k=any(headers))) then raise exception 'Invalid record schema/key'; end if;
  if p_dataset='Karyawan' then f:='pin';
  elsif p_dataset='Pengaturan' and p_id in ('admin_password','manager_password') then f:='value'; end if;
  if f is not null then clean:=clean-f; end if;
  insert into public.ketjeh_records(dataset,id,ordinal,data)
    values(p_dataset,p_id,p_ordinal,clean)
    on conflict(dataset,id) do update set data=excluded.data,deleted_at=null,updated_at=now();
  if f is not null and p_data ? f then
    secret:=p_data->>f;
    if length(p_key)<32 then raise exception 'Missing encryption key'; end if;
    if secret is null or length(secret)=0 or octet_length(secret)>72 then raise exception 'Empty credential'; end if;
    -- Admin passwords were trimmed by the old settings reader. Preserve the exact
    -- export text while hashing the same value the existing login accepted.
    insert into public.ketjeh_credentials(dataset,id,field,password_hash,export_cipher)
      values(p_dataset,p_id,f,extensions.crypt(case when p_dataset='Pengaturan' then btrim(secret) else secret end,extensions.gen_salt('bf',10)),
        extensions.pgp_sym_encrypt(secret,p_key,'cipher-algo=aes256'))
      on conflict(dataset,id,field) do update set password_hash=excluded.password_hash,export_cipher=excluded.export_cipher;
  end if;
end $$;

create function public.ketjeh_commit(p_id uuid,p_lease uuid,p_versions jsonb,p_changes jsonb,p_response jsonb,p_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.ketjeh_datasets; change jsonb; next_ordinal bigint; op public.ketjeh_operations;
begin
  -- Row locking the control flag makes the maintenance boundary atomic with writes.
  perform 1 from public.ketjeh_control where id and not maintenance for share;
  if not found then return jsonb_build_object('error','Sistem sedang pemeliharaan. Silakan coba lagi.'); end if;
  select * into op from public.ketjeh_operations where id=p_id for update;
  if not found or op.lease<>p_lease or op.leased_until<now() then raise exception 'Operation lease expired'; end if;
  if op.response is not null then return op.response; end if;
  -- Lock in a stable order and verify all reads, including authorization settings.
  for d in select * from public.ketjeh_datasets where name in (select jsonb_object_keys(p_versions)) order by name for update loop
    if d.revision<>(p_versions->>d.name)::bigint then return jsonb_build_object('conflict',true); end if;
  end loop;
  for change in select value from jsonb_array_elements(p_changes) loop
    if not p_versions ? (change->>'dataset') then raise exception 'Missing dataset revision'; end if;
    if change->>'kind'='delete' then
      update public.ketjeh_records set deleted_at=now(),updated_at=now()
        where dataset=change->>'dataset' and id=change->>'id' and deleted_at is null;
      if not found then raise exception 'Record missing'; end if;
    elsif change->>'kind' in ('insert','update') then
      select ordinal into next_ordinal from public.ketjeh_records where dataset=change->>'dataset' and id=change->>'id';
      if change->>'kind'='insert' and found then raise exception 'Duplicate record ID'; end if;
      if change->>'kind'='update' and not found then raise exception 'Record missing'; end if;
      if next_ordinal is null then
        select coalesce(max(ordinal),0)+1 into next_ordinal from public.ketjeh_records where dataset=change->>'dataset';
      end if;
      perform public.ketjeh_put_record(change->>'dataset',change->>'id',next_ordinal,change->'data',p_key);
    else raise exception 'Invalid mutation'; end if;
  end loop;
  update public.ketjeh_datasets set revision=revision+1
    where name in (select distinct value->>'dataset' from jsonb_array_elements(p_changes));
  update public.ketjeh_operations set response=p_response,completed_at=now() where id=p_id;
  return p_response;
end $$;

create function public.ketjeh_release(p_id uuid,p_lease uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.ketjeh_operations set leased_until=now() where id=p_id and lease=p_lease and response is null;
$$;

-- Import is all-or-nothing and is allowed only once into a completely empty target.
create function public.ketjeh_import(p_datasets jsonb,p_key text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare dataset record; item jsonb; headers text[]; ord bigint; record_id text;
begin
  perform 1 from public.ketjeh_control where id for update;
  if not (select maintenance from public.ketjeh_control where id) or exists(select 1 from public.ketjeh_datasets) then
    raise exception 'Import requires an empty database in maintenance';
  end if;
  if (select count(*) from jsonb_object_keys(p_datasets))<>11 then raise exception 'Expected all 11 datasets'; end if;
  for dataset in select * from jsonb_each(p_datasets) loop
    select array_agg(value order by n) into headers from jsonb_array_elements_text(dataset.value->'headers') with ordinality as x(value,n);
    insert into public.ketjeh_datasets(name,headers) values(dataset.key,headers);
    ord:=0;
    for item in select value from jsonb_array_elements(dataset.value->'rows') loop
      ord:=ord+1;
      record_id:=item->>headers[1];
      if coalesce(record_id,'')='' then raise exception 'Missing record key in %',dataset.key; end if;
      if exists(select 1 from public.ketjeh_records where ketjeh_records.dataset=dataset.key and id=record_id) then
        raise exception 'Duplicate source ID in %',dataset.key;
      end if;
      perform public.ketjeh_put_record(dataset.key,record_id,ord,item,p_key);
    end loop;
  end loop;
  update public.ketjeh_control set imported_at=now() where id;
  return jsonb_build_object('success',true,'count',(select count(*) from public.ketjeh_records));
end $$;

-- A complete consistent export. Includes tombstones, encrypted credentials, and
-- operation receipts for restore; plaintext credentials are only included on demand
-- for the owner's existing restricted workbook.
create function public.ketjeh_export(p_key text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('format',1,'captured_at',now(),
    'datasets',(select jsonb_agg(to_jsonb(d) order by name) from public.ketjeh_datasets d),
    'records',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('data',r.data ||
      case when p_key is null then '{}'::jsonb else coalesce((select jsonb_object_agg(c.field,extensions.pgp_sym_decrypt(c.export_cipher,p_key))
        from public.ketjeh_credentials c where c.dataset=r.dataset and c.id=r.id),'{}'::jsonb) end)
      order by dataset,ordinal) from public.ketjeh_records r),'[]'::jsonb),
    'credentials',coalesce((select jsonb_agg(to_jsonb(c)) from public.ketjeh_credentials c),'[]'::jsonb),
    'operations',coalesce((select jsonb_agg(to_jsonb(o)) from public.ketjeh_operations o),'[]'::jsonb),
    'control',(select to_jsonb(c) from public.ketjeh_control c where id));
$$;

-- Restore ciphertext and receipts without decrypting/re-hashing credentials.
-- Schema/functions/grants come from this versioned migration; the key is restored
-- separately into Script Properties before login/export verification.
create function public.ketjeh_restore(p_backup jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.ketjeh_control where id for update;
  if p_backup->>'format'<>'1' or not (select maintenance from public.ketjeh_control where id)
     or exists(select 1 from public.ketjeh_datasets) then raise exception 'Restore requires empty target in maintenance'; end if;
  insert into public.ketjeh_datasets select * from jsonb_populate_recordset(null::public.ketjeh_datasets,p_backup->'datasets');
  insert into public.ketjeh_records select * from jsonb_populate_recordset(null::public.ketjeh_records,p_backup->'records');
  insert into public.ketjeh_credentials select * from jsonb_populate_recordset(null::public.ketjeh_credentials,p_backup->'credentials');
  insert into public.ketjeh_operations select * from jsonb_populate_recordset(null::public.ketjeh_operations,p_backup->'operations');
  update public.ketjeh_control set imported_at=(p_backup->'control'->>'imported_at')::timestamptz where id;
  return jsonb_build_object('success',true,'count',(select count(*) from public.ketjeh_records));
end $$;

-- Revoke the default PUBLIC execute grant on every application RPC, including helpers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'ketjeh\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
