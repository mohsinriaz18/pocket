import type { Account, Transaction, ExchangeRate, PocketData, Goal, Money, Bill } from './types';

export function money(value: Money, currency: string): string {
  const n = Number(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'PKR' ? 0 : 2, currencyDisplay: 'symbol' }).format(Number.isFinite(n) ? n : 0);
}
export function accountBalance(account: Account, transactions: Transaction[]): number {
  return transactions.reduce((balance, t) => {
    // DB enforces transaction currency = account currency, including both transfer legs.
    if (t.account_id === account.id) balance += t.type === 'in' ? Number(t.amount) : -Number(t.amount);
    if (t.type === 'transfer' && t.to_account_id === account.id) balance += Number(t.amount);
    return balance;
  }, Number(account.opening_balance));
}
export function convert(value: number, from: string, to: string, rates: ExchangeRate[]): number | null {
  if (!Number.isFinite(value)) return null;
  const source = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  if (source === target) return value;
  const latest = rates.slice().sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  const direct = latest.find(r => r.base_currency.trim().toUpperCase() === source && r.quote_currency.trim().toUpperCase() === target && Number(r.rate) > 0);
  const reverse = latest.find(r => r.base_currency.trim().toUpperCase() === target && r.quote_currency.trim().toUpperCase() === source && Number(r.rate) > 0);

  // Rates are stored against USD, so this also converts between non-USD currencies.
  const usdRate = (currency: string) => currency === 'USD'
    ? null
    : latest.find(r => r.base_currency.trim().toUpperCase() === 'USD' && r.quote_currency.trim().toUpperCase() === currency && Number(r.rate) > 0) ?? null;
  const sourceUsdRate = usdRate(source);
  const targetUsdRate = usdRate(target);
  const usdToSource = source === 'USD' ? 1 : Number(sourceUsdRate?.rate);
  const usdToTarget = target === 'USD' ? 1 : Number(targetUsdRate?.rate);
  const pivotDate = [sourceUsdRate?.effective_date, targetUsdRate?.effective_date]
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  const candidates: { date: string; value: number }[] = [];
  if (direct) candidates.push({ date: direct.effective_date, value: value * Number(direct.rate) });
  if (reverse) candidates.push({ date: reverse.effective_date, value: value / Number(reverse.rate) });
  if (pivotDate && Number.isFinite(usdToSource) && usdToSource > 0 && Number.isFinite(usdToTarget) && usdToTarget > 0) {
    candidates.push({ date: pivotDate, value: value * usdToTarget / usdToSource });
  }
  return candidates.reduce((best, candidate) => candidate.date > best.date ? candidate : best, candidates[0])?.value ?? null;
}
function ymd(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dateRange(period: 'Week' | 'Month' | 'Quarter' | 'Year' | 'Custom', anchor: Date, customFrom?: string, customTo?: string) {
  let start: Date, end: Date;
  if (period === 'Custom' && customFrom && customTo) return { from: customFrom, to: customTo };
  if (period === 'Week') {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - (anchor.getDay() + 6) % 7);
    end = new Date(start); end.setDate(end.getDate() + 6);
  } else if (period === 'Year') {
    start = new Date(anchor.getFullYear(), 0, 1); end = new Date(anchor.getFullYear(), 11, 31);
  } else if (period === 'Quarter') {
    const m = Math.floor(anchor.getMonth() / 3) * 3;
    start = new Date(anchor.getFullYear(), m, 1); end = new Date(anchor.getFullYear(), m + 3, 0);
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1); end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  }
  return { from: ymd(start), to: ymd(end) };
}
export function summary(data: PocketData, currency: string, from: string, to: string) {
  const missing = new Set<string>();
  const cv = (v: Money, c: string) => {
    const converted = convert(Number(v), c, currency, data.exchange_rates);
    if (converted === null && Number(v) !== 0) missing.add(c.trim().toUpperCase());
    return converted ?? 0;
  };
  let assets = 0, liabilities = 0;
  for (const a of data.accounts) {
    const b = cv(accountBalance(a, data.transactions), a.currency);
    if (b >= 0) assets += b; else liabilities += -b;
  }
  const invested = data.investments.reduce((s, i) => s + cv(i.invested, i.currency), 0);
  const portfolio = data.investments.reduce((s, i) => s + cv(i.current_value, i.currency), 0);
  assets += portfolio;
  let debt = 0;
  for (const d of data.debts) {
    const b = cv(d.outstanding, d.currency);
    if (d.direction === 'lent') assets += b; else { liabilities += b; debt += b; }
  }
  // Savings goals are earmarks, not separate assets; do not double count.
  const goalsSaved = data.goals.reduce((s, g) => s + cv(g.saved, g.currency), 0);
  const goalsTarget = data.goals.reduce((s, g) => s + cv(g.target, g.currency), 0);
  const transactions = data.transactions.filter(t => t.date >= from && t.date <= to);
  const cashIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + cv(t.amount, t.currency), 0);
  const cashOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + cv(t.amount, t.currency), 0);
  return { assets, liabilities, netWorth: assets - liabilities, cashIn, cashOut, invested, portfolio, gain: portfolio - invested, goalsSaved, goalsTarget, debt, missingCurrencies: [...missing], transactions };
}
export function categoryTotals(transactions: Transaction[], type: 'in' | 'out', currency: string, rates: ExchangeRate[]) {
  const result: Record<string, number> = {};
  for (const t of transactions.filter(t => t.type === type)) {
    const amount = convert(Number(t.amount), t.currency, currency, rates);
    if (amount !== null) result[t.category || 'Other'] = (result[t.category || 'Other'] ?? 0) + amount;
  }
  return Object.entries(result).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}
export function trend(data: PocketData, currency: string, from: string, to: string) {
  const start = new Date(`${from}T12:00:00`), end = new Date(`${to}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const stride = Math.max(1, Math.ceil(days / 31));
  const items: { label: string; income: number; spending: number }[] = [];
  for (let offset = 0; offset < days; offset += stride) {
    const d = new Date(start); d.setDate(d.getDate() + offset);
    const last = new Date(d); last.setDate(last.getDate() + stride - 1);
    const rows = data.transactions.filter(t => t.date >= ymd(d) && t.date <= ymd(last) && t.date <= to);
    items.push({
      label: days > 60 ? d.toLocaleDateString('en-US', { month: 'short' }) : String(d.getDate()),
      income: rows.filter(t => t.type === 'in').reduce((s, t) => s + (convert(Number(t.amount), t.currency, currency, data.exchange_rates) ?? 0), 0),
      spending: rows.filter(t => t.type === 'out').reduce((s, t) => s + (convert(Number(t.amount), t.currency, currency, data.exchange_rates) ?? 0), 0),
    });
  }
  return items;
}
export function goalProgress(g: Goal): number { return Number(g.target) > 0 ? Math.max(0, Math.min(1, Number(g.saved) / Number(g.target))) : 0; }

export function billPeriod(bill: Bill, day = new Date()): string {
  const year = day.getFullYear();
  if (bill.repeats === 'Once') return 'once';
  if (bill.repeats === 'Yearly') return String(year);
  if (bill.repeats === 'Quarterly') return `${year}-${Math.floor(day.getMonth() / 3) + 1}`;
  if (bill.repeats === 'Weekly') {
    const d = new Date(Date.UTC(year, day.getMonth(), day.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const isoYear = d.getUTCFullYear(), start = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil((((d.getTime() - start.getTime()) / 86400000) + 1) / 7);
    return `${isoYear}-${String(week).padStart(2, '0')}`;
  }
  return `${year}-${String(day.getMonth() + 1).padStart(2, '0')}`;
}
export function billDueInDays(bill: Bill, today = new Date()): number {
  const created = new Date(bill.created_at);
  const anchorMonth = created.getMonth(), day = Math.min(bill.due_day, 31);
  let due: Date;
  if (bill.repeats === 'Weekly') {
    const weekday = new Date(created.getFullYear(), created.getMonth(), Math.min(day, new Date(created.getFullYear(), created.getMonth()+1,0).getDate())).getDay();
    const offset = (weekday - today.getDay() + 7) % 7;
    due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  } else {
    let month = today.getMonth(), year = today.getFullYear();
    if (bill.repeats === 'Yearly') month = anchorMonth;
    if (bill.repeats === 'Quarterly') while ((month - anchorMonth + 12) % 3 !== 0) month++;
    const makeDue = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m+1, 0).getDate()));
    due = makeDue(year, month);
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (due < current && bill.repeats !== 'Once') {
      const advance = bill.repeats === 'Yearly' ? 12 : bill.repeats === 'Quarterly' ? 3 : 1;
      due = makeDue(year, month + advance);
    }
    if (bill.repeats === 'Once') due = makeDue(created.getFullYear(), created.getMonth());
  }
  return Math.round((due.getTime() - new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime())/86400000);
}
export function netWorthTrend(data: PocketData, currency: string, from: string, to: string): { label: string; value: number }[] {
  // Reconstruct available history, never extrapolate a fabricated growth curve.
  // Account opening dates are record creation dates. Values edited without
  // historical records cannot be reconstructed; UI describes this limitation.
  const start = new Date(`${from}T12:00:00`), end = new Date(`${to}T12:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [];
  const days = Math.round((end.getTime()-start.getTime())/86400000) + 1;
  const stride = Math.max(1, Math.ceil(days/12));
  const result: { label: string; value: number }[] = [];
  const now = ymd(new Date());
  for (let offset = 0; offset < days; offset += stride) {
    const point = new Date(start); point.setDate(point.getDate() + Math.min(offset + stride - 1, days - 1));
    const day = ymd(point);
    if (day > now) continue;
    let value = 0;
    const cv = (amount: number, original: string) => {
      const historical = convert(amount, original, currency, data.exchange_rates.filter(r => r.effective_date <= day));
      return historical ?? convert(amount, original, currency, data.exchange_rates) ?? 0;
    };
    for (const a of data.accounts.filter(a => a.created_at.slice(0,10) <= day)) {
      value += cv(accountBalance(a, data.transactions.filter(t => t.date<=day)),a.currency);
    }
    for (const i of data.investments.filter(i => i.purchase_date <= day)) {
      const v = data.investment_valuations.filter(v => v.investment_id===i.id && v.date<=day).sort((a,b)=>b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))[0];
      value += cv(Number(v?.value ?? i.invested),i.currency);
    }
    for (const d of data.debts.filter(d => (d.start_date ?? d.created_at.slice(0,10)) <= day)) {
      const laterPayments = data.transactions.filter(t => t.debt_id===d.id && t.date>day).reduce((sum,t)=>sum+Number(t.amount),0);
      const outstanding = Number(d.outstanding)+laterPayments;
      value += cv(outstanding,d.currency)*(d.direction==='lent'?1:-1);
    }
    result.push({ label: days>60 ? point.toLocaleDateString('en-US',{month:'short'}) : String(point.getDate()), value });
  }
  return result;
}
