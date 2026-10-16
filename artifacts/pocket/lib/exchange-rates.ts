import type { ExchangeRate } from './types';

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';

function nonUsdCurrencies(supportedCurrencies: readonly string[]): string[] {
  return supportedCurrencies.map(currency => currency.trim().toUpperCase()).filter(currency => currency !== 'USD');
}

export interface UserExchangeRate extends ExchangeRate {
  user_id: string;
}

type RateApiPayload = {
  result?: unknown;
  base_code?: unknown;
  time_last_update_unix?: unknown;
  time_last_update_utc?: unknown;
  rates?: unknown;
};

function effectiveDate(payload: RateApiPayload): string {
  const timestamp = Number(payload.time_last_update_unix);
  const fromTimestamp = Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000)
    : null;
  const fromText = typeof payload.time_last_update_utc === 'string'
    ? new Date(payload.time_last_update_utc)
    : null;
  const date = fromTimestamp && Number.isFinite(fromTimestamp.getTime())
    ? fromTimestamp
    : fromText;
  if (!date || !Number.isFinite(date.getTime())) {
    throw new Error('The exchange-rate provider returned no valid update date.');
  }
  return date.toISOString().slice(0, 10);
}

export function buildUsdRateRows(userId: string, value: unknown, supportedCurrencies: readonly string[]): UserExchangeRate[] {
  if (!value || typeof value !== 'object') {
    throw new Error('The exchange-rate provider returned invalid data.');
  }
  const payload = value as RateApiPayload;
  if (payload.result !== 'success' || payload.base_code !== 'USD' || !payload.rates || typeof payload.rates !== 'object') {
    throw new Error('The exchange-rate provider could not supply USD-based rates.');
  }

  const rates = payload.rates as Record<string, unknown>;
  const date = effectiveDate(payload);
  return nonUsdCurrencies(supportedCurrencies).map(quoteCurrency => {
    const rate = Number(rates[quoteCurrency]);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`The exchange-rate provider did not return a valid ${quoteCurrency} rate.`);
    }
    return {
      user_id: userId,
      base_currency: 'USD',
      quote_currency: quoteCurrency,
      rate,
      effective_date: date,
    };
  });
}

export function hasCompleteUsdRatesForDate(rates: ExchangeRate[], date: string, supportedCurrencies: readonly string[]): boolean {
  const available = new Set(
    rates
      .filter(rate => rate.base_currency.trim().toUpperCase() === 'USD' && rate.effective_date >= date)
      .map(rate => rate.quote_currency.trim().toUpperCase()),
  );
  return nonUsdCurrencies(supportedCurrencies).every(currency => available.has(currency));
}

export async function fetchLatestUsdRates(userId: string, supportedCurrencies: readonly string[]): Promise<UserExchangeRate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(RATE_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Exchange-rate service returned HTTP ${response.status}.`);
    }
    return buildUsdRateRows(userId, await response.json(), supportedCurrencies);
  } finally {
    clearTimeout(timeout);
  }
}
