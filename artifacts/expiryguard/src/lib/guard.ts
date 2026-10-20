import { useQueryClient } from '@tanstack/react-query';
import {
  getGetGuardStateQueryKey,
  useAddGuardRecords,
  useAttachFollowUp,
  useRecordFollowUpOutcome,
  useDecideRecommendation,
  useGetGuardState,
} from '@workspace/api-client-react';

export function useGuard() {
  return useGetGuardState({ query: { queryKey: getGetGuardStateQueryKey(), refetchInterval: 30000 } });
}

export function useGuardMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: getGetGuardStateQueryKey() });
  const add = useAddGuardRecords({ mutation: { onSuccess } });
  const decide = useDecideRecommendation({ mutation: { onSuccess } });
  const attach = useAttachFollowUp({ mutation: { onSuccess } });
  const record = useRecordFollowUpOutcome({ mutation: { onSuccess } });
  return { add, decide, attach, record };
}

export const rm = (n: number) => `RM ${(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmt = (n: number, d = 1) => (n ?? 0).toLocaleString('en-MY', { maximumFractionDigits: d });

export function addDays(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b.slice(0, 10) + 'T00:00:00Z').getTime() - new Date(a.slice(0, 10) + 'T00:00:00Z').getTime()) / 86400000);
}
export function niceDate(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong.';
  const anyE = e as { data?: { error?: string; message?: string }; message?: string };
  return anyE.data?.error || anyE.data?.message || anyE.message || 'Something went wrong.';
}

// CSV
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); rows.push(cur); cur = []; field = '';
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const clean = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export const isNum = (s: unknown) => s !== '' && s !== undefined && s !== null && !isNaN(Number(s)) && Number(s) >= 0;

export type FollowDays = 1 | 2;
export function followTiming(scheduled: string, today: string): { label: string; tone: 'upcoming' | 'due' | 'overdue'; days: number } {
  const d = daysBetween(today, scheduled);
  if (d > 0) return { label: `Upcoming · in ${d} day${d === 1 ? '' : 's'}`, tone: 'upcoming', days: d };
  if (d === 0) return { label: 'Due today', tone: 'due', days: 0 };
  return { label: `Overdue · ${-d} day${d === -1 ? '' : 's'}`, tone: 'overdue', days: d };
}
