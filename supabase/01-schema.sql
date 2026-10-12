-- Ejecutar como postgres en SQL Editor. No requiere claves secretas en la web.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.price_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.price_admins enable row level security;
revoke all on private.price_admins from public, anon, authenticated;

create table if not exists public.product_prices (
  id integer primary key,
  price integer not null check (price between 1 and 10000000),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  product_id integer not null references public.product_prices(id),
  old_price integer not null,
  new_price integer not null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null
);

create or replace function public.is_price_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.price_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_price_admin() from public, anon, authenticated;
grant execute on function public.is_price_admin() to authenticated;

alter table public.product_prices enable row level security;
alter table public.price_history enable row level security;
revoke all on public.product_prices, public.price_history from public, anon, authenticated;
revoke all on sequence public.price_history_id_seq from public, anon, authenticated;
grant select on public.product_prices to anon, authenticated;
grant select on public.price_history to authenticated;
drop policy if exists prices_public_read on public.product_prices;
create policy prices_public_read on public.product_prices for select to anon, authenticated using (true);
drop policy if exists history_admin_read on public.price_history;
create policy history_admin_read on public.price_history for select to authenticated using ((select public.is_price_admin()));

-- Única vía de escritura desde la app: permisos, validación, bloqueo de filas,
-- control de versión e historial en una misma transacción.
create or replace function public.save_prices(changes jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  item jsonb;
  current_row public.product_prices%rowtype;
  product_id integer;
  new_price integer;
  expected_version integer;
begin
  if not public.is_price_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if changes is null or jsonb_typeof(changes) <> 'array' then
    raise exception 'INVALID_CHANGES';
  end if;
  if jsonb_array_length(changes) < 1 or jsonb_array_length(changes) > 200 then
    raise exception 'INVALID_CHANGES';
  end if;
  for item in select value from jsonb_array_elements(changes) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(jsonb_typeof(item->'id'), '') <> 'number'
       or coalesce(jsonb_typeof(item->'price'), '') <> 'number'
       or coalesce(jsonb_typeof(item->'expected_version'), '') <> 'number'
       or (item->>'id') !~ '^[0-9]+$'
       or (item->>'price') !~ '^[0-9]+$'
       or (item->>'expected_version') !~ '^[0-9]+$' then
      raise exception 'INVALID_PRICE';
    end if;
    if (item->>'price')::numeric not between 1 and 10000000 then
      raise exception 'INVALID_PRICE';
    end if;
  end loop;
  if (select count(distinct (value->>'id')::integer) from jsonb_array_elements(changes)) <> jsonb_array_length(changes) then
    raise exception 'DUPLICATE_PRODUCT';
  end if;
  -- Orden estable para evitar bloqueos cruzados entre dos administradores.
  for item in select value from jsonb_array_elements(changes) order by (value->>'id')::integer loop
    product_id := (item->>'id')::integer;
    new_price := (item->>'price')::integer;
    expected_version := (item->>'expected_version')::integer;
    select * into current_row from public.product_prices where id = product_id for update;
    if not found then raise exception 'UNKNOWN_PRODUCT'; end if;
    if current_row.version <> expected_version then raise exception 'PRICE_CONFLICT'; end if;
    if current_row.price <> new_price then
      update public.product_prices set price = new_price, version = version + 1, updated_at = now() where id = product_id;
      insert into public.price_history (product_id, old_price, new_price, changed_by)
        values (product_id, current_row.price, new_price, auth.uid());
    end if;
  end loop;
end;
$$;
revoke all on function public.save_prices(jsonb) from public, anon, authenticated;
grant execute on function public.save_prices(jsonb) to authenticated;
commit;
