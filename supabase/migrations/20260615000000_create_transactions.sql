-- Create transactions table for portfolio tracking
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  name text,
  type text not null check (type in ('BUY', 'SELL')),
  date date not null,
  timestamp bigint,
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price > 0),
  currency text default 'INR',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Allow anonymous access (single-user app)
create policy "Allow all access" on public.transactions
  for all using (true) with check (true);
