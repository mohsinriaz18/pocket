-- Pocket v1. Run once in the Supabase SQL Editor for the existing project.
-- No sample financial data. All amounts retain their original currency.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', email text not null default '',
 primary_currency text not null default 'PKR' check(primary_currency ~ '^[A-Z]{3}$'),
 secondary_currency text not null default 'USD' check(secondary_currency ~ '^[A-Z]{3}$'),
 appearance text not null default 'light' check(appearance in ('light','dark','system')),
 reminder_enabled boolean not null default false,
 reminder_time text not null default '13:00' check(reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 created_at timestamptz not null default now()
);
create table if not exists public.accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), bank text not null default '', last_four text not null default '' check(last_four='' or last_four ~ '^[0-9]{4}$'),
 currency text not null check(currency ~ '^[A-Z]{3}$'), type text not null default 'Checking',
 opening_balance numeric(20,4) not null default 0, archived boolean not null default false,
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.bills (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), amount numeric(20,4) not null check(amount>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'), due_day integer not null default 1 check(due_day between 1 and 31),
 repeats text not null default 'Monthly' check(repeats in ('Once','Weekly','Monthly','Quarterly','Yearly')),
 category text not null default 'Other', paid boolean not null default false, last_paid_at timestamptz,
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), category text not null default 'Custom',
 currency text not null check(currency ~ '^[A-Z]{3}$'), target numeric(20,4) not null check(target>0),
 target_date date, saved numeric(20,4) not null default 0 check(saved>=0), notes text not null default '',
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.investments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 type text not null default 'Stocks', platform text not null default '',
 invested numeric(20,4) not null check(invested>=0), current_value numeric(20,4) not null check(current_value>=0),
 quantity numeric(20,8) check(quantity>=0), purchase_price numeric(20,8) check(purchase_price>=0),
 purchase_date date not null default current_date, notes text not null default '',
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.investment_valuations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 investment_id uuid not null, value numeric(20,4) not null check(value>=0), date date not null default current_date,
 created_at timestamptz not null default now(),
 foreign key(investment_id,user_id) references public.investments(id,user_id) on delete cascade
);
create table if not exists public.debts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 type text not null default 'Personal Loan', lender text not null default '',
 original_amount numeric(20,4) not null check(original_amount>0),
 outstanding numeric(20,4) not null check(outstanding>=0 and outstanding<=original_amount),
 interest_rate numeric(8,4) not null default 0 check(interest_rate>=0),
 minimum_payment numeric(20,4) not null default 0 check(minimum_payment>=0),
 frequency text not null default 'Monthly', due_day integer not null default 1 check(due_day between 1 and 31),
 start_date date, payoff_by date, notes text not null default '',
 direction text not null default 'owed' check(direction in ('owed','lent')),
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in ('in','out','transfer')), amount numeric(20,4) not null check(amount>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'), category text not null default 'Other',
 account_id uuid not null, to_account_id uuid,
 date date not null default current_date, note text not null default '',
 bill_id uuid, debt_id uuid, payment_period text,
 created_at timestamptz not null default now(),
 foreign key(account_id,user_id) references public.accounts(id,user_id) on delete restrict,
 foreign key(to_account_id,user_id) references public.accounts(id,user_id) on delete restrict,
 foreign key(bill_id,user_id) references public.bills(id,user_id) on delete restrict,
 foreign key(debt_id,user_id) references public.debts(id,user_id) on delete restrict,
 check((type='transfer' and to_account_id is not null and to_account_id<>account_id) or (type<>'transfer' and to_account_id is null)),
 check(not(bill_id is not null and debt_id is not null))
);
create unique index if not exists one_bill_payment_per_period on public.transactions(bill_id,payment_period) where bill_id is not null;
create table if not exists public.exchange_rates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 base_currency text not null check(base_currency ~ '^[A-Z]{3}$'),
 quote_currency text not null check(quote_currency ~ '^[A-Z]{3}$'),
 rate numeric(24,10) not null check(rate>0), effective_date date not null default current_date,
 created_at timestamptz not null default now(),
 unique(user_id,base_currency,quote_currency,effective_date), check(base_currency<>quote_currency)
);
do $$
declare t text;
begin
 foreach t in array array['accounts','transactions','bills','goals','investments','investment_valuations','debts','exchange_rates'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists owner_access on public.%I',t);
  execute format('create policy owner_access on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',t);
  execute format('create index if not exists %I on public.%I(user_id)',t||'_owner_idx',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
 end loop;
end $$;
alter table public.profiles enable row level security;
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for all to authenticated using(auth.uid()=id) with check(auth.uid()=id);
grant select,insert,update,delete on public.profiles to authenticated;
revoke all on public.profiles from anon;
create index if not exists transactions_date_idx on public.transactions(user_id,date);
create index if not exists transactions_account_idx on public.transactions(account_id);
create index if not exists transactions_to_account_idx on public.transactions(to_account_id);

create or replace function public.create_pocket_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,name,email) values(new.id,coalesce(new.raw_user_meta_data->>'name',''),coalesce(new.email,''))
 on conflict(id) do update set email=excluded.email;
 return new;
end $$;
drop trigger if exists pocket_auth_profile on auth.users;
create trigger pocket_auth_profile after insert or update of email on auth.users for each row execute function public.create_pocket_profile();
insert into profiles(id,name,email)
 select id,coalesce(raw_user_meta_data->>'name',''),coalesce(email,'') from auth.users on conflict(id) do nothing;

create or replace function public.validate_pocket_transaction() returns trigger
language plpgsql security invoker set search_path=public as $$
declare a accounts; b accounts; d debts; bill bills;
begin
 if new.user_id<>auth.uid() then raise exception 'Not authorized'; end if;
 select * into a from accounts where id=new.account_id and user_id=auth.uid() for share;
 if not found or a.archived then raise exception 'Choose an active account you own'; end if;
 if a.currency<>new.currency then raise exception 'Transaction currency must match the account currency'; end if;
 if new.type='transfer' then
  select * into b from accounts where id=new.to_account_id and user_id=auth.uid() for share;
  if not found or b.archived then raise exception 'Choose an active destination account you own'; end if;
  if b.currency<>new.currency then raise exception 'Transfers require accounts in the same currency. No exchange rate will be invented.'; end if;
 end if;
 if new.bill_id is not null then
  select * into bill from bills where id=new.bill_id and user_id=auth.uid() for update;
  if not found or bill.currency<>new.currency or new.type<>'out' then raise exception 'Invalid bill payment'; end if;
  if new.payment_period is null then raise exception 'Bill payment period is required'; end if;
 end if;
 if new.debt_id is not null then
  select * into d from debts where id=new.debt_id and user_id=auth.uid() for update;
  if not found or d.currency<>new.currency or new.type<>(case when d.direction='lent' then 'in' else 'out' end) then raise exception 'Invalid debt repayment'; end if;
 end if;
 if tg_op='UPDATE' and (new.bill_id is distinct from old.bill_id or new.debt_id is distinct from old.debt_id or new.payment_period is distinct from old.payment_period or new.user_id<>old.user_id) then
  raise exception 'Linked payment ownership and associations cannot be changed';
 end if;
 return new;
end $$;
drop trigger if exists validate_transaction on public.transactions;
create trigger validate_transaction before insert or update on public.transactions for each row execute function public.validate_pocket_transaction();

create or replace function public.reconcile_pocket_payment() returns trigger
language plpgsql security invoker set search_path=public as $$
declare d debts; delta numeric; bid uuid;
begin
 if tg_op<>'INSERT' and old.debt_id is not null then
  update debts set outstanding=outstanding+old.amount where id=old.debt_id and user_id=auth.uid();
 end if;
 if tg_op<>'DELETE' and new.debt_id is not null then
  select * into d from debts where id=new.debt_id and user_id=auth.uid() for update;
  if new.amount>d.outstanding then raise exception 'Repayment exceeds outstanding balance'; end if;
  update debts set outstanding=outstanding-new.amount where id=new.debt_id and user_id=auth.uid();
 end if;
 if tg_op='DELETE' then bid=old.bill_id; else bid=new.bill_id; end if;
 if bid is not null then
  update bills set paid=exists(select 1 from transactions where bill_id=bid),
   last_paid_at=(select max(created_at) from transactions where bill_id=bid) where id=bid and user_id=auth.uid();
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists reconcile_payment on public.transactions;
create trigger reconcile_payment after insert or update or delete on public.transactions for each row execute function public.reconcile_pocket_payment();

create or replace function public.pay_bill(p_bill_id uuid,p_account_id uuid) returns uuid
language plpgsql security invoker set search_path=public as $$
declare b bills; tid uuid; period text;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into b from bills where id=p_bill_id and user_id=auth.uid() for update;
 if not found then raise exception 'Bill not found'; end if;
 period=case b.repeats
  when 'Once' then 'once'
  when 'Weekly' then to_char(current_date,'IYYY-IW')
  when 'Quarterly' then to_char(current_date,'YYYY-Q')
  when 'Yearly' then to_char(current_date,'YYYY')
  else to_char(current_date,'YYYY-MM') end;
 if exists(select 1 from transactions where bill_id=b.id and payment_period=period) then raise exception 'This bill is already paid for this period'; end if;
 insert into transactions(user_id,type,amount,currency,category,account_id,bill_id,payment_period,note)
 values(auth.uid(),'out',b.amount,b.currency,b.category,p_account_id,b.id,period,b.name)
 returning id into tid;
 return tid;
end $$;
create or replace function public.repay_debt(p_debt_id uuid,p_amount numeric,p_account_id uuid,p_date date) returns uuid
language plpgsql security invoker set search_path=public as $$
declare d debts; tid uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into d from debts where id=p_debt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Debt not found'; end if;
 if p_amount<=0 or p_amount>d.outstanding then raise exception 'Enter a repayment between zero and the outstanding balance'; end if;
 insert into transactions(user_id,type,amount,currency,category,account_id,debt_id,date,note)
 values(auth.uid(),case when d.direction='lent' then 'in' else 'out' end,p_amount,d.currency,case when d.direction='lent' then 'Loan refund' else 'Debt Payment' end,p_account_id,d.id,p_date,d.name)
 returning id into tid;
 return tid;
end $$;
create or replace function public.mark_bill_unpaid(p_bill_id uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare tid uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 perform 1 from bills where id=p_bill_id and user_id=auth.uid() for update;
 if not found then raise exception 'Bill not found'; end if;
 select id into tid from transactions where bill_id=p_bill_id and user_id=auth.uid() order by created_at desc limit 1;
 if tid is null then raise exception 'This bill has no payment to reverse'; end if;
 delete from transactions where id=tid and user_id=auth.uid();
end $$;

-- Currency must never reinterpret existing ledger/history in another currency.
create or replace function public.guard_pocket_record_history() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.user_id<>old.user_id then raise exception 'Record ownership cannot be changed'; end if;
 if tg_table_name='accounts' and new.currency<>old.currency and exists(select 1 from transactions where account_id=old.id or to_account_id=old.id) then
  raise exception 'Account currency cannot change while transaction history exists';
 elsif tg_table_name='investments' and new.currency<>old.currency and exists(select 1 from investment_valuations where investment_id=old.id) then
  raise exception 'Investment currency cannot change while valuation history exists';
 elsif tg_table_name='bills' and new.currency<>old.currency and exists(select 1 from transactions where bill_id=old.id) then
  raise exception 'Bill currency cannot change while payment history exists';
 elsif tg_table_name='debts' then
  if (new.currency<>old.currency or new.direction<>old.direction) and exists(select 1 from transactions where debt_id=old.id) then
   raise exception 'Debt currency or direction cannot change while payment history exists';
  end if;
 end if;
 return new;
end $$;
do $$
declare t text;
begin
 foreach t in array array['accounts','investments','bills','debts'] loop
  execute format('drop trigger if exists guard_record_history on public.%I',t);
  execute format('create trigger guard_record_history before update on public.%I for each row execute function public.guard_pocket_record_history()',t);
 end loop;
end $$;
create or replace function public.save_investment(p_id uuid,p_record jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare iid uuid; previous numeric; latest numeric;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 latest=(p_record->>'current_value')::numeric;
 if p_id is null then
  insert into investments(user_id,name,currency,type,platform,invested,current_value,quantity,purchase_price,purchase_date,notes)
  values(auth.uid(),p_record->>'name',p_record->>'currency',coalesce(p_record->>'type','Stocks'),coalesce(p_record->>'platform',''),
   (p_record->>'invested')::numeric,latest,nullif(p_record->>'quantity','')::numeric,nullif(p_record->>'purchase_price','')::numeric,
   coalesce(nullif(p_record->>'purchase_date','')::date,current_date),coalesce(p_record->>'notes',''))
  returning id into iid;
  insert into investment_valuations(user_id,investment_id,value,date) values(auth.uid(),iid,(p_record->>'invested')::numeric,coalesce(nullif(p_record->>'purchase_date','')::date,current_date));
 else
  select current_value into previous from investments where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Investment not found'; end if;
  iid=p_id;
  update investments set name=coalesce(p_record->>'name',name),currency=coalesce(p_record->>'currency',currency),
   type=coalesce(p_record->>'type',type),platform=coalesce(p_record->>'platform',platform),
   invested=coalesce((p_record->>'invested')::numeric,invested),current_value=coalesce(latest,current_value),
   quantity=nullif(p_record->>'quantity','')::numeric,purchase_price=nullif(p_record->>'purchase_price','')::numeric,
   purchase_date=coalesce(nullif(p_record->>'purchase_date','')::date,purchase_date),notes=coalesce(p_record->>'notes',notes)
   where id=iid and user_id=auth.uid();
 end if;
 if latest is not null and (p_id is null or latest is distinct from previous) then
  insert into investment_valuations(user_id,investment_id,value,date) values(auth.uid(),iid,latest,current_date);
 end if;
 return iid;
end $$;
revoke execute on function public.create_pocket_profile() from public,anon,authenticated;
revoke execute on function public.validate_pocket_transaction() from public,anon;
revoke execute on function public.reconcile_pocket_payment() from public,anon;
revoke execute on function public.pay_bill(uuid,uuid) from public,anon;
revoke execute on function public.repay_debt(uuid,numeric,uuid,date) from public,anon;
revoke execute on function public.save_investment(uuid,jsonb) from public,anon;
revoke execute on function public.mark_bill_unpaid(uuid) from public,anon;
revoke execute on function public.guard_pocket_record_history() from public,anon;
grant execute on function public.pay_bill(uuid,uuid),public.repay_debt(uuid,numeric,uuid,date),public.save_investment(uuid,jsonb),public.mark_bill_unpaid(uuid) to authenticated;
commit;
