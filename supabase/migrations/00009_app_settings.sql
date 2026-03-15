-- App settings key-value store
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Seed default org row so getOrgSettings always has something
insert into app_settings (key, value)
values ('org', '{}'::jsonb)
on conflict (key) do nothing;

-- RLS
alter table app_settings enable row level security;

create policy "Authenticated users can read settings"
  on app_settings for select
  using (auth.uid() is not null);

create policy "Authenticated users can upsert settings"
  on app_settings for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update settings"
  on app_settings for update
  using (auth.uid() is not null);
