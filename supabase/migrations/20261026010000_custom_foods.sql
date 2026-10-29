-- Requires the existing public.user_settings table; leaves policies and grants unchanged.
alter table public.user_settings
  add column if not exists custom_foods jsonb not null default '[]'::jsonb;
