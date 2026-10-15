-- Run only in a disposable local database after migrations 001 and 002.
-- These records exist only inside this rolled-back transaction.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','one@example.invalid','{}'),
 ('22222222-2222-4222-8222-222222222222','two@example.invalid','{}');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.complete_onboarding(auth.uid(),'saving','consistency','weekly','USD');
do $$
begin
 if (select primary_currency from public.profiles where id=auth.uid()) <> 'USD' then
  raise exception 'Chosen currency was not applied';
 end if;
 if (select secondary_currency from public.profiles where id=auth.uid()) <> 'PKR' then
  raise exception 'Primary and secondary currencies should remain distinct';
 end if;
 if (select count(*) from public.onboarding_preferences) <> 1 then
  raise exception 'Answers were not saved';
 end if;
end $$;
update public.profiles set primary_currency='EUR' where id=auth.uid();
select public.complete_onboarding(auth.uid(),'wealth',null,null,'PKR');
do $$
begin
 if (select primary_currency from public.profiles where id=auth.uid()) <> 'EUR' then
  raise exception 'A retry overwrote a later Settings change';
 end if;
 if (select goal from public.onboarding_preferences where user_id=auth.uid()) <> 'saving' then
  raise exception 'A retry overwrote completed answers';
 end if;
end $$;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
begin
 if (select count(*) from public.onboarding_preferences) <> 0 then
  raise exception 'Cross-account answers are visible';
 end if;
 begin
  perform public.complete_onboarding('11111111-1111-4111-8111-111111111111','debt',null,null,'USD');
  raise exception 'Account-switch protection did not reject the request';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.onboarding_preferences(user_id,goal,primary_currency)
  values('11111111-1111-4111-8111-111111111111','debt','USD');
  raise exception 'Cross-account insert was allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.complete_onboarding(auth.uid(),'invented',null,null,'USD');
  raise exception 'Unknown goal was accepted';
 exception when check_violation then null;
 end;
end $$;
select public.complete_onboarding(auth.uid(),'spending',null,null,'AED');
set local role anon;
do $$
begin
 begin
  perform count(*) from public.onboarding_preferences;
  raise exception 'Anonymous answers were visible';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.complete_onboarding('22222222-2222-4222-8222-222222222222','saving',null,null,'USD');
  raise exception 'Anonymous completion was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
