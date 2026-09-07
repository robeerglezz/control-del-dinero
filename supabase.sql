-- Ejecuta TODO este archivo en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 120),
  category text not null,
  date date not null default current_date,
  payment_method text not null default 'Otro',
  created_at timestamptz not null default now()
);

create index if not exists movements_user_date_idx on public.movements(user_id, date desc);
create index if not exists movements_user_type_idx on public.movements(user_id, type);

alter table public.movements enable row level security;

drop policy if exists "Users can view their own movements" on public.movements;
create policy "Users can view their own movements"
on public.movements for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own movements" on public.movements;
create policy "Users can insert their own movements"
on public.movements for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own movements" on public.movements;
create policy "Users can update their own movements"
on public.movements for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own movements" on public.movements;
create policy "Users can delete their own movements"
on public.movements for delete
to authenticated
using (auth.uid() = user_id);

-- Opcional: comprueba que RLS está activo.
select relrowsecurity from pg_class where oid='public.movements'::regclass;
