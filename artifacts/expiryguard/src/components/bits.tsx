import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Check, Download, FileUp, Pencil, RotateCw, X } from 'lucide-react';
import type { Recommendation } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { addDays, downloadCsv, errorMessage, fmt, niceDate, parseCsv, rm, useGuard, useGuardMutations, type FollowDays } from '@/lib/guard';

export const guardianSrc = `${import.meta.env.BASE_URL}guardian.png`;

export function PageHeader({ kicker, title, children, aside }: { kicker: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">{kicker}</div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">{title}</h1>
        {children && <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{children}</p>}
      </div>
      {aside && <div className="flex flex-wrap gap-2">{aside}</div>}
    </div>
  );
}

export function Panel({ title, sub, children, className, action }: { title?: string; sub?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('rise min-w-0 rounded-2xl border bg-card p-5 shadow-sm', className)}>
      {title && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone = 'ink', testId }: { label: string; value: string; note?: string; tone?: 'ink' | 'primary' | 'jade' | 'amber'; testId?: string }) {
  const bar = { ink: 'bg-ink', primary: 'bg-primary', jade: 'bg-jade', amber: 'bg-amber' }[tone];
  return (
    <div className="rise lift relative overflow-hidden rounded-2xl border bg-card p-4">
      <span className={cn('absolute left-0 top-4 bottom-4 w-1 rounded-r', bar)} />
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="num text-2xl font-semibold mt-1" data-testid={testId}>{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-1">{note}</div>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-4" data-testid="status-loading">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center max-w-lg mx-auto mt-10" data-testid="status-error">
      <img src={guardianSrc} alt="" className="w-28 mx-auto opacity-70 grayscale" />
      <h2 className="text-xl font-bold mt-3">Yuzu lost the pantry ledger</h2>
      <p className="text-sm text-muted-foreground mt-1">{errorMessage(error)}</p>
      <Button className="mt-4" onClick={onRetry} data-testid="button-retry"><RotateCw className="w-4 h-4 mr-2" />Try again</Button>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed p-6 bg-muted/40">
      <img src={guardianSrc} alt="" className="w-16 shrink-0" />
      <div><div className="font-semibold">{title}</div><div className="text-sm text-muted-foreground">{body}</div></div>
    </div>
  );
}

export function LevelPill({ level }: { level: string }) {
  const l = level.toLowerCase();
  const cls = l === 'high' || l === 'critical' || l === 'expired' ? 'bg-destructive/12 text-destructive border-destructive/30'
    : l === 'medium' ? 'bg-amber/15 text-[hsl(32_80%_32%)] border-amber/40' : 'bg-jade/12 text-jade border-jade/30';
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cls)}>{level}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: 'bg-amber/15 text-[hsl(32_80%_32%)] border-amber/40',
    approved: 'bg-jade/12 text-jade border-jade/30',
    edited: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
    rejected: 'bg-muted text-muted-foreground border-border line-through',
  };
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cls[status] ?? cls.pending)}>{status}</span>;
}

const typeLabel: Record<string, string> = { purchase: 'Purchase', preparation: 'Prep plan', 'use-first': 'Use first' };

export function RecCard({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  const { decide, attach } = useGuardMutations();
  const { data } = useGuard();
  const { toast } = useToast();
  const [days, setDays] = useState<FollowDays>(2);
  const [attaching, setAttaching] = useState(false);
  const today = data?.today;
  const autoFollow = data?.automation?.followUpHandling ?? true;
  const hasFollowUp = !!data?.followUps.some((f) => f.recommendationId === rec.id);
  const decidedYes = rec.status === 'approved' || rec.status === 'edited';
  const doAttach = () => attach.mutate({ id: rec.id, data: { followUpDays: days } }, {
    onSuccess: () => { setAttaching(false); toast({ title: 'Follow-up check scheduled', description: rec.title }); },
    onError: (e) => toast({ title: 'Follow-up not scheduled', description: errorMessage(e), variant: 'destructive' }),
  });
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(rec.approvedQuantity ?? rec.suggested));
  const [note, setNote] = useState('');
  const pending = rec.status === 'pending';
  const busy = decide.isPending || attach.isPending;

  const send = (decision: 'approved' | 'edited' | 'rejected', quantity?: number) => {
    decide.mutate(
      { id: rec.id, data: { decision, ...(quantity !== undefined ? { quantity } : {}), ...(note ? { note } : {}), ...(decision !== 'rejected' && autoFollow ? { followUpDays: days } : {}) } },
      {
        onSuccess: () => { setEditing(false); toast({ title: `${typeLabel[rec.type] ?? 'Item'} ${decision}`, description: rec.title }); },
        onError: (e) => toast({ title: 'Decision not saved', description: errorMessage(e), variant: 'destructive' }),
      },
    );
  };

  return (
    <div className={cn('rounded-xl border bg-background/60 p-4 transition-colors', pending && 'border-primary/30 bg-primary/[0.03]')} data-testid={`card-rec-${rec.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary">{typeLabel[rec.type] ?? rec.type}</span>
            <StatusPill status={rec.status} />
          </div>
          <div className="font-semibold mt-1">{rec.title}</div>
          {!compact && <p className="text-sm text-muted-foreground mt-1">{decidedYes && <b>Forecast suggestion (before your decision): </b>}{rec.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="num text-lg font-semibold">{fmt(rec.approvedQuantity ?? rec.suggested)} <span className="text-xs text-muted-foreground">{rec.unit}</span></div>
          <div className="num text-[11px] text-muted-foreground">was {fmt(rec.original)} {rec.unit}</div>
          {rec.savings > 0 && <div className="num text-xs text-jade font-semibold">saves {rm(rec.savings)} est.</div>}
        </div>
      </div>
      {(editing || pending) && !attaching && today && autoFollow && (
        <DaySelect value={days} onChange={setDays} today={today} id={rec.id} />
      )}
      {(editing || pending) && !attaching && data && !autoFollow && (
        <div className="mt-3 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid={`text-autofollow-paused-${rec.id}`}>
          <b className="text-foreground">Auto-scheduling of result checks is paused.</b> Existing checks are kept. After approving you can still add a follow-up check by hand.
        </div>
      )}
      {attaching && today && <DaySelect value={days} onChange={setDays} today={today} id={rec.id} />}
      {attaching && (
        <div className="mt-2 rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs space-y-2" data-testid={`text-attach-explain-${rec.id}`}>
          <p>{!autoFollow && <>Auto-scheduling is paused, so this check is attached by you. </>}If this decision was made before follow-up checks existed, Yuzu will take a <b>current</b> pantry snapshot as the starting point and any unknown approval time is recorded as unknown. Nothing is backfilled.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={doAttach} data-testid={`button-confirm-attach-${rec.id}`}><CalendarClock className="w-4 h-4 mr-1" />Schedule check</Button>
            <Button size="sm" variant="ghost" onClick={() => setAttaching(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {editing ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto] items-center">
          <Input type="number" min={0} step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} data-testid={`input-qty-${rec.id}`} />
          <Input placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} data-testid={`input-note-${rec.id}`} />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || qty === '' || !Number.isFinite(Number(qty)) || Number(qty) < 0} onClick={() => send('edited', Number(qty))} data-testid={`button-save-edit-${rec.id}`}><Check className="w-4 h-4 mr-1" />Approve edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {pending ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => send('approved', rec.suggested)} data-testid={`button-approve-${rec.id}`}><Check className="w-4 h-4 mr-1" />Approve</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)} data-testid={`button-edit-${rec.id}`}><Pencil className="w-4 h-4 mr-1" />Edit amount</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => send('rejected')} data-testid={`button-reject-${rec.id}`}><X className="w-4 h-4 mr-1" />Reject</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)} data-testid={`button-revise-${rec.id}`}><Pencil className="w-4 h-4 mr-1" />Revise decision</Button>
              {rec.status !== 'rejected' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => send('rejected')} data-testid={`button-reject-revision-${rec.id}`}><X className="w-4 h-4 mr-1" />Reject</Button>}
              {decidedYes && !hasFollowUp && !attaching && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAttaching(true)} data-testid={`button-attach-${rec.id}`}><CalendarClock className="w-4 h-4 mr-1" />Add follow-up check</Button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface ImportSpec {
  kind: 'sales' | 'inventory' | 'results';
  columns: { name: string; required: boolean; hint: string }[];
  template: string;
  validate: (row: Record<string, string>) => string | null;
  transform: (row: Record<string, string>) => Record<string, unknown>;
}

export function CsvImport({ spec }: { spec: ImportSpec }) {
  const { add } = useGuardMutations();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const onFile = async (f: File) => {
    setFile(f.name);
    const text = await f.text();
    const parsed = parseCsv(text);
    const errs: string[] = [];
    if (!parsed.length) errs.push('No data rows found. The first line must be the header.');
    const head = parsed[0] ? Object.keys(parsed[0]) : [];
    spec.columns.filter((c) => c.required && parsed.length && !head.includes(c.name)).forEach((c) => errs.push(`Missing required column "${c.name}".`));
    if (!errs.length) parsed.forEach((r, i) => { const m = spec.validate(r); if (m) errs.push(`Row ${i + 2}: ${m}`); });
    if (parsed.length > 2000) errs.push('Maximum 2000 rows per import.');
    setRows(parsed); setErrors(errs);
  };

  const submit = () => {
    add.mutate({ data: { kind: spec.kind, rows: rows.map(spec.transform) } }, {
      onSuccess: () => { toast({ title: `Imported ${rows.length} rows`, description: file }); setRows([]); setFile(''); setErrors([]); },
      onError: (e) => toast({ title: 'Import failed', description: errorMessage(e), variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-muted/50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Columns</div>
        <div className="grid gap-1.5">
          {spec.columns.map((c) => (
            <div key={c.name} className="flex gap-2 text-xs">
              <code className="num font-semibold min-w-[120px]">{c.name}{c.required ? '' : '?'}</code>
              <span className="text-muted-foreground">{c.hint}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadCsv(`${spec.kind}-template.csv`, spec.template)} data-testid={`button-template-${spec.kind}`}><Download className="w-4 h-4 mr-1" />Download template</Button>
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} data-testid={`button-choose-${spec.kind}`}><FileUp className="w-4 h-4 mr-1" />Choose CSV</Button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      {file && (
        <div className="text-sm">
          <span className="font-semibold">{file}</span> <span className="text-muted-foreground">— {rows.length} rows parsed</span>
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 max-h-40 overflow-auto" data-testid="text-import-errors">
          <div className="flex items-center gap-1.5 text-destructive text-sm font-semibold mb-1"><AlertTriangle className="w-4 h-4" />{errors.length} problem{errors.length > 1 ? 's' : ''} — fix the file and choose it again</div>
          {errors.slice(0, 30).map((e, i) => <div key={i} className="text-xs num">{e}</div>)}
        </div>
      )}
      {rows.length > 0 && errors.length === 0 && (
        <div className="space-y-2">
          <div className="overflow-auto max-h-44 rounded-lg border text-xs">
            <table className="w-full num">
              <thead className="bg-muted sticky top-0"><tr>{Object.keys(rows[0]).map((h) => <th key={h} className="text-left p-1.5">{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 8).map((r, i) => <tr key={i} className="border-t">{Object.values(r).map((v, j) => <td key={j} className="p-1.5">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <Button onClick={submit} disabled={add.isPending} data-testid={`button-import-${spec.kind}`}>{add.isPending ? 'Importing...' : `Import ${rows.length} rows`}</Button>
        </div>
      )}
    </div>
  );
}

export function DaySelect({ value, onChange, today, id }: { value: FollowDays; onChange: (d: FollowDays) => void; today: string; id: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground font-semibold uppercase tracking-wider">Check result in</span>
      {([1, 2] as FollowDays[]).map((d) => (
        <button key={d} type="button" onClick={() => onChange(d)} data-testid={`button-days-${d}-${id}`}
          className={cn('rounded-full border px-3 py-1 font-semibold transition-colors', value === d ? 'bg-ink text-[hsl(38_40%_94%)] border-ink' : 'bg-background hover:bg-muted')}>
          {d} day{d > 1 ? 's' : ''} <span className="num opacity-70">· {niceDate(addDays(today, d))}</span>
        </button>
      ))}
    </div>
  );
}
