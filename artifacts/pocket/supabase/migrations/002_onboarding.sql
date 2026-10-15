begin;

create table if not exists public.onboarding_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 goal text not null check (goal in ('spending','saving','debt','wealth')),
 challenge text check (challenge in ('visibility','consistency','planning','organization')),
 tracking_frequency text check (tracking_frequency in ('daily','weekly','as_needed')),
 primary_currency text not null check (primary_currency in ('PKR','USD','EUR','GBP','AED','SAR','CAD','AUD','INR')),
 completed_at timestamptz not null default now()
);
alter table public.onboarding_preferences enable row level security;
drop policy if exists read_own_onboarding on public.onboarding_preferences;
create policy read_own_onboarding on public.onboarding_preferences for select to authenticated
 using (auth.uid() = user_id);
drop policy if exists insert_own_onboarding on public.onboarding_preferences;
create policy insert_own_onboarding on public.onboarding_preferences for insert to authenticated
 with check (auth.uid() = user_id);
revoke all on public.onboarding_preferences from anon, authenticated;
grant select, insert on public.onboarding_preferences to authenticated;

create or replace function public.complete_onboarding(
 p_expected_user_id uuid, p_goal text, p_challenge text, p_frequency text, p_currency text
) returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
 if uid is null or uid is distinct from p_expected_user_id then
  raise exception 'The signed-in account changed. Please retry setup.' using errcode = '42501';
 end if;
 insert into public.onboarding_preferences(user_id, goal, challenge, tracking_frequency, primary_currency)
 values(uid, p_goal, p_challenge, p_frequency, p_currency)
 on conflict (user_id) do nothing;
 -- A retry must not overwrite preferences or a currency changed later in Settings.
 if not found then return; end if;
 update public.profiles set
  primary_currency = p_currency,
  secondary_currency = case when secondary_currency = p_currency
    then case when p_currency = 'USD' then 'PKR' else 'USD' end
    else secondary_currency end
 where id = uid;
 if not found then raise exception 'Your profile is not ready. Please retry setup.'; end if;
end;
$$;
revoke all on function public.complete_onboarding(uuid,text,text,text,text) from public, anon;
grant execute on function public.complete_onboarding(uuid,text,text,text,text) to authenticated;

commit;
