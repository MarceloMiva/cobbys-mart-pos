-- Cobbys Mart POS schema (with staff login)
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> Run.

create extension if not exists pgcrypto;

-- ---------- Core tables ----------

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  name text not null,
  price numeric(12,2) not null,
  stock integer,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  number bigserial,
  items jsonb not null,
  subtotal numeric(12,2) not null default 0,
  discount_pct numeric(6,2) not null default 0,
  discount_amt numeric(12,2) not null default 0,
  vat_enabled boolean not null default false,
  vat_rate numeric(6,2) not null default 0,
  vat_amt numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'cash',
  tendered numeric(12,2) not null default 0,
  change numeric(12,2) not null default 0,
  cashier_id uuid references auth.users(id),
  cashier_name text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id int primary key default 1,
  shop_name text not null default 'Cobbys Mart',
  address text default '',
  phone text default '',
  currency text not null default '₦',
  vat_enabled boolean not null default false,
  vat_rate numeric(6,2) not null default 7.5
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Single-row table the cashier screen writes to and the customer screen
-- subscribes to in realtime, so the customer's device updates live.
create table if not exists live_cart (
  id int primary key default 1,
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  discount_amt numeric(12,2) not null default 0,
  vat_enabled boolean not null default false,
  vat_rate numeric(6,2) not null default 0,
  vat_amt numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into live_cart (id) values (1) on conflict (id) do nothing;

-- Single-row table used to show the "Thank you" screen right after checkout
create table if not exists last_completed_sale (
  id int primary key default 1,
  sale jsonb,
  completed_at timestamptz
);
insert into last_completed_sale (id) values (1) on conflict (id) do nothing;

-- ---------- Staff accounts ----------
-- Login itself is handled by Supabase Auth (Authentication -> Users in your
-- dashboard). This table just stores each staff member's role.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'cashier' check (role in ('cashier','manager')),
  created_at timestamptz not null default now()
);

-- Automatically create a profile (defaulting to 'cashier') whenever a new
-- staff account is created in Authentication -> Users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets policies below check "is the signed-in user a manager?" without
-- causing recursive RLS checks on the profiles table itself.
create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- ---------- Realtime ----------
-- Lets the customer screen update instantly instead of polling.
alter publication supabase_realtime add table live_cart;
alter publication supabase_realtime add table last_completed_sale;

-- ---------- Row Level Security ----------
-- Only signed-in staff (cashier or manager) can see or change shop data.
-- The one exception is the customer-facing display, which has no login --
-- it's allowed to READ (not write) the live cart and shop name so it can
-- show the running total without a staff account.

alter table products enable row level security;
alter table sales enable row level security;
alter table settings enable row level security;
alter table live_cart enable row level security;
alter table last_completed_sale enable row level security;
alter table profiles enable row level security;

-- products: any signed-in staff member has full access
create policy "staff manage products" on products for all to authenticated using (true) with check (true);

-- sales: any signed-in staff member can read (so History + the Team tab
-- work); a cashier can only insert sales attributed to themselves
create policy "staff read sales" on sales for select to authenticated using (true);
create policy "staff insert own sales" on sales for insert to authenticated with check (auth.uid() = cashier_id);

-- settings: anyone (including the unauthenticated customer screen) can read
-- the shop name; only signed-in staff can change settings
create policy "anyone read settings" on settings for select to anon, authenticated using (true);
create policy "staff update settings" on settings for all to authenticated using (true) with check (true);

-- live_cart / last_completed_sale: anyone can read (customer screen), only
-- signed-in staff can write
create policy "anyone read live cart" on live_cart for select to anon, authenticated using (true);
create policy "staff write live cart" on live_cart for insert to authenticated with check (true);
create policy "staff update live cart" on live_cart for update to authenticated using (true) with check (true);

create policy "anyone read last sale" on last_completed_sale for select to anon, authenticated using (true);
create policy "staff write last sale" on last_completed_sale for insert to authenticated with check (true);
create policy "staff update last sale" on last_completed_sale for update to authenticated using (true) with check (true);

-- profiles: a staff member can see their own profile; managers can see
-- everyone's and change roles (that's how promote/demote works in the Team
-- tab). Nobody can self-promote -- only an existing manager can change a
-- role.
create policy "see own or all if manager" on profiles for select to authenticated using (auth.uid() = id or is_manager());
create policy "managers edit profiles" on profiles for update to authenticated using (is_manager()) with check (is_manager());
