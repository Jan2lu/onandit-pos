-- On&iT POS: database setup for Supabase.
-- Run this once: Supabase dashboard > SQL Editor > New query > paste all > Run.
-- Before running, change the two emails on the "insert into public.team" lines.

-- 1) Who is the owner and who is staff (use lowercase emails)
create table if not exists public.team (
  email text primary key,
  role  text not null check (role in ('owner','staff'))
);
alter table public.team enable row level security;      -- no policies: nobody can read it through the API
insert into public.team (email, role) values
  ('OWNER_EMAIL', 'owner'),
  ('STAFF_EMAIL', 'staff')
on conflict (email) do update set role = excluded.role;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.team where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- 2) One table holds everything (services, customers, orders, expenses, settings)
create table if not exists public.docs (
  coll       text  not null,
  id         text  not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
alter table public.docs enable row level security;
revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;

-- 3) Rules: owner sees and edits everything.
--    Staff: orders, services, settings and customers only. No expenses, no suppliers.
drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;

create policy docs_read on public.docs for select to authenticated using (
  public.my_role() = 'owner'
  or (public.my_role() = 'staff' and (
        coll in ('items','orders','settings','meta')
        or (coll = 'contacts' and coalesce(data ->> 'type','customer') <> 'supplier')))
);

create policy docs_insert on public.docs for insert to authenticated with check (
  public.my_role() = 'owner'
  or (public.my_role() = 'staff' and (
        coll = 'orders'
        or (coll = 'contacts' and coalesce(data ->> 'type','customer') <> 'supplier')))
);

create policy docs_update on public.docs for update to authenticated
using (
  public.my_role() = 'owner'
  or (public.my_role() = 'staff' and (
        coll = 'orders'
        or (coll = 'contacts' and coalesce(data ->> 'type','customer') <> 'supplier')))
)
with check (
  public.my_role() = 'owner'
  or (public.my_role() = 'staff' and (
        coll = 'orders'
        or (coll = 'contacts' and coalesce(data ->> 'type','customer') <> 'supplier')))
);

create policy docs_delete on public.docs for delete to authenticated using (
  public.my_role() = 'owner'
);

-- 4) Order numbers come from one shared counter so they never repeat
create or replace function public.next_order_no() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if public.my_role() is null then raise exception 'not allowed'; end if;
  insert into public.docs (coll, id, data) values ('meta', 'counter', '{"n":2}'::jsonb)
  on conflict (coll, id) do update
    set data = jsonb_build_object('n', (public.docs.data ->> 'n')::int + 1), updated_at = now()
  returning (public.docs.data ->> 'n')::int - 1 into n;
  return n;
end $$;
revoke all on function public.next_order_no() from public, anon;
grant execute on function public.next_order_no() to authenticated;

-- 5) Live updates between phones
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
