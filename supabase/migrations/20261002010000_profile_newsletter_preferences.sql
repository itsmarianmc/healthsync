-- Store explicit newsletter consent on the existing owner-scoped profile.
-- The timestamp fields are maintained by the database so clients cannot
-- choose the recorded consent-change time.

alter table public.profiles
  add column if not exists newsletter_opt_in boolean not null default false,
  add column if not exists newsletter_opt_in_at timestamptz,
  add column if not exists newsletter_opt_out_at timestamptz;

create or replace function public.set_profile_newsletter_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.newsletter_opt_in is distinct from old.newsletter_opt_in then
    if new.newsletter_opt_in then
      new.newsletter_opt_in_at := now();
    else
      new.newsletter_opt_out_at := now();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.set_profile_newsletter_timestamps() from public, anon, authenticated;

drop trigger if exists profiles_newsletter_timestamps on public.profiles;
create trigger profiles_newsletter_timestamps
  before update of newsletter_opt_in on public.profiles
  for each row execute function public.set_profile_newsletter_timestamps();

-- Preserve the existing row policies and grants; expose only the preference
-- for updates, while allowing the owner-scoped client to read its timestamps.
grant select (newsletter_opt_in, newsletter_opt_in_at, newsletter_opt_out_at)
  on public.profiles to authenticated;
grant update (newsletter_opt_in) on public.profiles to authenticated;
