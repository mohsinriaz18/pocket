export type Period = 'Week' | 'Month' | 'Quarter' | 'Year' | 'Custom';

export const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const today = () => iso(new Date());
export const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function fmtDate(s: string | null | undefined) {
  if (!s) return '';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysUntil(dueDay: number) {
  const now = new Date();
  const d = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const due = Math.min(dueDay, dim);
  if (due >= d) return due - d;
  const nextDim = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  return dim - d + Math.min(dueDay, nextDim);
}

export function shiftAnchor(p: Period, a: Date, dir: 1 | -1) {
  const n = new Date(a);
  if (p === 'Week') n.setDate(n.getDate() + 7 * dir);
  else if (p === 'Month') n.setMonth(n.getMonth() + dir);
  else if (p === 'Quarter') n.setMonth(n.getMonth() + 3 * dir);
  else if (p === 'Year') n.setFullYear(n.getFullYear() + dir);
  return n;
}

export function daysBetween(from: string, to: string) {
  const a = new Date(from + 'T00:00:00').getTime();
  const b = new Date(to + 'T00:00:00').getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
};

export const MIN_PASSWORD = 8;
export const passwordProblem = (pw: string) => (pw.length < MIN_PASSWORD ? `Use a password of at least ${MIN_PASSWORD} characters.` : null);

interface AccLike { id: string; name: string; currency: string; last_four?: string }
export function accountLabels(list: AccLike[]): Record<string, string> {
  const out: Record<string, string> = {};
  const seen: Record<string, number> = {};
  list.forEach((a) => {
    let l = `${a.name} · ${a.currency}${a.last_four ? ` ···${a.last_four}` : ''}`;
    seen[l] = (seen[l] ?? 0) + 1;
    if (seen[l] > 1) l = `${l} #${seen[l]}`;
    out[a.id] = l;
  });
  return out;
}
