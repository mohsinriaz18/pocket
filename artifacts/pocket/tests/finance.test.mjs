import test from 'node:test';
import assert from 'node:assert/strict';
import { accountBalance, convert, dateRange, goalProgress, summary, categoryTotals, billPeriod, billDueInDays } from '../lib/finance.ts';
const owner = 'test-owner', created = '2026-01-01T00:00:00Z';
const account = (id, opening_balance, currency = 'PKR') => ({ id, user_id: owner, created_at: created, name: id, bank: '', last_four: '', currency, type: 'Checking', opening_balance, archived: false });
const entry = (type, amount, account_id, to_account_id = null) => ({ id: `${type}-${amount}`, user_id: owner, created_at: created, type, amount, currency: 'PKR', category: 'Food', account_id, to_account_id, date: '2026-10-12', note: '', bill_id: null, debt_id: null });
const blank = () => ({ accounts: [], transactions: [], bills: [], goals: [], investments: [], debts: [], exchange_rates: [], investment_valuations: [], profile: null });
test('cash flow, transfer legs, transaction editing and deletion reconcile', () => {
  const a = account('a', 1000), b = account('b', 200);
  const rows = [entry('in', 100, 'a'), entry('out', 50, 'a'), entry('transfer', 250, 'a', 'b')];
  assert.equal(accountBalance(a, rows), 800);
  assert.equal(accountBalance(b, rows), 450);
  rows[1] = entry('out', 100, 'a');
  assert.equal(accountBalance(a, rows), 750);
  rows.splice(2, 1);
  assert.equal(accountBalance(a, rows), 1000);
  assert.equal(accountBalance(b, rows), 200);
});
test('transfers excluded; goals not double counted; net worth includes signed balances and debts', () => {
  const data = blank();
  data.accounts = [account('a', 1000), account('b', -200)];
  data.transactions = [entry('in', 100, 'a'), entry('out', 50, 'a'), entry('transfer', 250, 'a', 'b')];
  data.investments = [{ invested: 200, current_value: 300, currency: 'PKR' }];
  data.debts = [{ direction: 'owed', outstanding: 100, currency: 'PKR' }, { direction: 'lent', outstanding: 50, currency: 'PKR' }];
  data.goals = [{ target: 1000, saved: 400, currency: 'PKR' }];
  const s = summary(data, 'PKR', '2026-10-01', '2026-10-31');
  assert.equal(s.cashIn, 100); assert.equal(s.cashOut, 50);
  assert.equal(s.assets, 1200); assert.equal(s.liabilities, 100); assert.equal(s.netWorth, 1100);
  assert.equal(s.gain, 100); assert.equal(s.goalsSaved, 400);
});
test('missing currency rate excluded transparently, original records unchanged', () => {
  const data = blank(); data.accounts = [account('usd', 100, 'USD'), account('pkr', 1000)];
  const s = summary(data, 'PKR', '2026-10-01', '2026-10-31');
  assert.equal(s.netWorth, 1000); assert.deepEqual(s.missingCurrencies, ['USD']);
  assert.equal(data.accounts[0].opening_balance, 100);
  assert.equal(convert(100, 'USD', 'PKR', []), null);
  const rates = [{ base_currency: 'USD', quote_currency: 'PKR', rate: 280, effective_date: '2026-10-01' }];
  assert.equal(convert(100, 'USD', 'PKR', rates), 28000);
  assert.equal(convert(28000, 'PKR', 'USD', rates), 100);
});
test('category filters and exact periods derive from records', () => {
  const rows = [entry('in', 100, 'a'), entry('out', 50, 'a'), entry('transfer', 250, 'a', 'b')];
  assert.deepEqual(categoryTotals(rows, 'out', 'PKR', []), [{ category: 'Food', amount: 50 }]);
  assert.deepEqual(dateRange('Quarter', new Date(2026, 9, 13)), { from: '2026-10-01', to: '2026-12-31' });
  assert.deepEqual(dateRange('Week', new Date(2026, 9, 13)), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(dateRange('Year', new Date(2026, 9, 13)), { from: '2026-01-01', to: '2026-12-31' });
});
test('goal progress guards zero targets and clamps completed goals', () => {
  assert.equal(goalProgress({ saved: 20, target: 0 }), 0);
  assert.equal(goalProgress({ saved: 50, target: 100 }), .5);
  assert.equal(goalProgress({ saved: 150, target: 100 }), 1);
});
test('bill recurrence periods match SQL format and short months clamp due day', () => {
  const bill = { repeats: 'Monthly', due_day: 31, created_at: created };
  assert.equal(billPeriod(bill, new Date(2026, 9, 13)), '2026-10');
  assert.equal(billPeriod({ ...bill, repeats: 'Quarterly' }, new Date(2026, 9, 13)), '2026-4');
  assert.equal(billPeriod({ ...bill, repeats: 'Weekly' }, new Date(2026, 9, 13)), '2026-42');
  assert.equal(billDueInDays(bill, new Date(2026, 1, 27)), 1);
});
