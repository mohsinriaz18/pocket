-- Isolated test fixture only. Never run against production user records.
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','one@example.test'),
 ('22222222-2222-4222-8222-222222222222','two@example.test');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into accounts(id,user_id,name,currency,type,opening_balance) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'Cash','PKR','Cash',1000),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth.uid(),'Bank','PKR','Checking',200);
insert into transactions(user_id,type,amount,currency,account_id,category) values
 (auth.uid(),'in',100,'PKR','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Salary'),
 (auth.uid(),'out',50,'PKR','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Food');
insert into transactions(user_id,type,amount,currency,account_id,to_account_id,category) values
 (auth.uid(),'transfer',250,'PKR','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Transfer');
insert into bills(id,user_id,name,amount,currency) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',auth.uid(),'Rent',80,'PKR');
select pay_bill('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
do $$ begin
 if not (select paid from bills where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'Bill status failed'; end if;
 begin
  perform pay_bill('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Duplicate bill payment accepted';
 exception when raise_exception then
  if sqlerrm='Duplicate bill payment accepted' then raise; end if;
 end;
end $$;
select mark_bill_unpaid('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
do $$ begin
 if (select paid from bills where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'Unpaid reversal failed'; end if;
end $$;
insert into debts(id,user_id,name,currency,original_amount,outstanding) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',auth.uid(),'Loan','PKR',500,500);
select repay_debt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',100,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date);
do $$ begin
 if (select outstanding from debts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>400 then raise exception 'Debt repayment failed'; end if;
end $$;
update transactions set amount=150 where debt_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ begin
 if (select outstanding from debts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>350 then raise exception 'Debt edit reconciliation failed'; end if;
end $$;
delete from transactions where debt_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ begin
 if (select outstanding from debts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>500 then raise exception 'Debt delete reconciliation failed'; end if;
 begin
  delete from accounts where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'Account history deleted';
 exception when foreign_key_violation then null;
 end;
 begin
  update accounts set currency='USD' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'Currency history reinterpreted';
 exception when raise_exception then
  if sqlerrm='Currency history reinterpreted' then raise; end if;
 end;
end $$;
select save_investment(null,'{"name":"Fund","currency":"PKR","type":"Mutual Funds","invested":1000,"current_value":1100}'::jsonb);
select save_investment((select id from investments limit 1),'{"current_value":1200}'::jsonb);
do $$ begin
 if (select current_value from investments limit 1)<>1200 then raise exception 'Valuation update failed'; end if;
 if (select invested from investments limit 1)<>1000 then raise exception 'Historical contributions modified'; end if;
 if (select count(*) from investment_valuations)<>3 then raise exception 'Valuation history failed'; end if;
 if (select sum(case type when 'in' then amount when 'out' then -amount else -amount end) from transactions where account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>-200 then raise exception 'Ledger balance incorrect'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
 if exists(select 1 from accounts) or exists(select 1 from transactions) or exists(select 1 from bills) or exists(select 1 from investments) then raise exception 'RLS leaked another user data'; end if;
 begin
  insert into transactions(user_id,type,amount,currency,account_id) values(auth.uid(),'out',1,'PKR','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Cross-owner transaction accepted';
 exception when raise_exception then
  if sqlerrm='Cross-owner transaction accepted' then raise; end if;
 end;
end $$;
reset role;
select 'PASS: ledger, bill duplicate protection/reversal, debt edit/delete reconciliation, account history preservation, investment values/history, RLS isolation and cross-owner rejection' as result;
