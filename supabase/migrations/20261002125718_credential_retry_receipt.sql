-- A password-changing request may lose its response after invalidating its own
-- login. Only the exact original request may retrieve that completed receipt.
create function public.ketjeh_receipt(p_id uuid, p_fingerprint text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select response from public.ketjeh_operations
  where id=p_id and fingerprint=p_fingerprint and completed_at is not null;
$$;
revoke execute on function public.ketjeh_receipt(uuid,text) from public, anon, authenticated;
grant execute on function public.ketjeh_receipt(uuid,text) to service_role;
