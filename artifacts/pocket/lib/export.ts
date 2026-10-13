import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import type { PocketData } from './types';
import { accountBalance, summary, money, categoryTotals } from './finance';

function esc(v: unknown): string { return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!)); }
function safeCell(v: unknown): unknown { return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; }
function csvCell(v: unknown) { return `"${String(safeCell(v) ?? '').replace(/"/g, '""')}"`; }
async function saveFile(name: string, content: string | Uint8Array, mime: string) {
  if (Platform.OS === 'web') {
    const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : new Blob([new Uint8Array(content).buffer], { type: mime });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true }); file.write(content);
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Pocket report' });
  }
}
export async function exportReport(format: 'Excel' | 'CSV' | 'PDF', data: PocketData, currency: string, from: string, to: string) {
  if (!data.profile) throw new Error('Log in and load your records before exporting.');
  const s = summary(data, currency, from, to);
  const now = new Date(), currentDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const last = to < currentDay ? to : currentDay;
  const elapsedDays = Math.max(1, Math.round((new Date(`${last}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)+1);
  const tables: { title: string; rows: unknown[][] }[] = [
    { title: 'Summary', rows: [
      ['Pocket report', from, to], ['Report currency', currency],
      ['Earned', s.cashIn], ['Spent', s.cashOut], ['Net saved', s.cashIn - s.cashOut], ['Avg / day spent', s.cashOut / elapsedDays],
      ['Current balance sheet', 'Current snapshot, not historical'],
      ['Total assets', s.assets], ['Total liabilities', -s.liabilities], ['Net worth', s.netWorth],
      ['Total invested', s.invested], ['Current value', s.portfolio], ['Gain / loss', s.gain],
      ['Saved toward goals', s.goalsSaved], ['Goal target', s.goalsTarget],
      ['Conversion', s.missingCurrencies.length ? `Partial totals: no rate for ${s.missingCurrencies.join(', ')}` : 'Persisted exchange rates only; original amounts retained'],
    ] },
    { title: 'All activity', rows: [['Date', 'Type', 'Category', 'Account', 'To account', 'Amount', 'Currency', 'Note'], ...s.transactions.map(t => [
      t.date, t.type === 'in' ? 'Money In' : t.type === 'out' ? 'Money Out' : 'Transfer', t.category,
      data.accounts.find(a => a.id === t.account_id)?.name ?? '', data.accounts.find(a => a.id === t.to_account_id)?.name ?? '',
      Number(t.amount), t.currency, t.note,
    ])] },
    { title: 'Accounts', rows: [['Name', 'Type', 'Balance', 'Currency'], ...data.accounts.map(a => [a.name, a.type, accountBalance(a, data.transactions), a.currency])] },
    { title: 'Investments', rows: [['Name', 'Type', 'Amount invested', 'Current value', 'Gain / loss', 'Currency'], ...data.investments.map(i => [i.name, i.type, Number(i.invested), Number(i.current_value), Number(i.current_value) - Number(i.invested), i.currency])] },
    { title: 'Goals', rows: [['Goal name', 'Category', 'Target', 'Already saved', 'Target date', 'Currency'], ...data.goals.map(g => [g.name, g.category, Number(g.target), Number(g.saved), g.target_date, g.currency])] },
    { title: 'Debts', rows: [['Name', 'Direction', 'Original amount', 'Outstanding now', 'Currency'], ...data.debts.map(d => [d.name, d.direction, Number(d.original_amount), Number(d.outstanding), d.currency])] },
    { title: 'Where you spent', rows: [['Category', 'Amount', 'Currency'], ...categoryTotals(s.transactions, 'out', currency, data.exchange_rates).map(c => [c.category, c.amount, currency])] },
    { title: 'Where you earned', rows: [['Category', 'Amount', 'Currency'], ...categoryTotals(s.transactions, 'in', currency, data.exchange_rates).map(c => [c.category, c.amount, currency])] },
  ];
  const filename = `Pocket-${from}-${to}`;
  if (format === 'Excel') {
    const book = XLSX.utils.book_new();
    tables.forEach(t => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(t.rows.map(row => row.map(safeCell))), t.title));
    await saveFile(`${filename}.xlsx`, new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else if (format === 'CSV') {
    await saveFile(`${filename}.csv`, '\uFEFF' + tables.map(t => [t.title, ...t.rows.map(r => r.map(csvCell).join(','))].join('\r\n')).join('\r\n\r\n'), 'text/csv;charset=utf-8');
  } else {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pocket report</title><style>body{font:12px Arial;color:#102b25;padding:24px}h1{color:#009d7d}h2{margin-top:28px}table{border-collapse:collapse;width:100%;margin-top:10px}td{border-bottom:1px solid #dbe6e0;padding:7px;text-align:left}tr:first-child{background:#e3f7ee;font-weight:bold}small{color:#61746c}tr{break-inside:avoid}</style></head><body><h1>Pocket</h1><p>Wealth &amp; Expense Tracker · ${esc(from)} – ${esc(to)}</p><p>Net worth ${esc(money(s.netWorth, currency))}</p><small>Current balance sheet snapshots; cash flow uses the selected dates. ${esc(s.missingCurrencies.length ? 'Partial totals. Missing exchange rates: ' + s.missingCurrencies.join(', ') : '')}</small>${tables.map(t => `<h2>${esc(t.title)}</h2><table>${t.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`).join('')}</body></html>`;
    const Print = await import('expo-print');
    if (Platform.OS === 'web') await Print.printAsync({ html });
    else {
      const { uri } = await Print.printToFileAsync({ html });
      const Sharing = await import('expo-sharing');
      if (!await Sharing.isAvailableAsync()) throw new Error('PDF sharing is unavailable on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Pocket PDF report' });
    }
  }
}
