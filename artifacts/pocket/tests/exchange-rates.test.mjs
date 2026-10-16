import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUsdRateRows, hasCompleteUsdRatesForDate } from '../lib/exchange-rates.ts';
import { currencies } from '../lib/types.ts';

const payload = (date = '2026-10-16') => ({
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: Date.parse(`${date}T00:00:00Z`) / 1000,
  rates: Object.fromEntries(currencies.filter(code => code !== 'USD').map((code, index) => [code, index + 1])),
});

test('provider payload maps every supported currency to USD and the provider date', () => {
  const rows = buildUsdRateRows('user-1', payload(), currencies);
  assert.equal(rows.length, currencies.length - 1);
  assert.deepEqual(rows.find(row => row.quote_currency === 'PKR'), {
    user_id: 'user-1',
    base_currency: 'USD',
    quote_currency: 'PKR',
    rate: 1,
    effective_date: '2026-10-16',
  });
});

test('rejects unsuccessful or incomplete provider payloads instead of silently omitting rates', () => {
  assert.throws(() => buildUsdRateRows('user-1', { ...payload(), result: 'error' }, currencies), /could not supply USD-based rates/);
  const incomplete = payload();
  delete incomplete.rates.PKR;
  assert.throws(() => buildUsdRateRows('user-1', incomplete, currencies), /valid PKR rate/);
});

test('cache is fresh only when every supported non-USD rate exists for the requested date', () => {
  const rows = buildUsdRateRows('user-1', payload(), currencies);
  assert.equal(hasCompleteUsdRatesForDate(rows, '2026-10-16', currencies), true);
  assert.equal(hasCompleteUsdRatesForDate(rows.slice(1), '2026-10-16', currencies), false);
  assert.equal(hasCompleteUsdRatesForDate(rows, '2026-10-17', currencies), false);
});
