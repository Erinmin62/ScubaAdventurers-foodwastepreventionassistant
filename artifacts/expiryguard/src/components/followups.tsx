import { useState } from 'react';
import { AlertTriangle, CalendarClock, ClipboardCheck, Info } from 'lucide-react';
import type { FollowUp, GuardState } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/bits';
import { addDays, errorMessage, fmt, followTiming, isDate, niceDate, useGuardMutations } from '@/lib/guard';

const toneCls = {
  upcoming: 'bg-jade/12 text-jade border-jade/30',
  due: 'bg-amber/15 text-[hsl(32_80%_32%)] border-amber/40',
  overdue: 'bg-destructive/12 text-destructive border-destructive/30',
};

function assessTone(a: string) {
  const l = a.toLowerCase();
  if (l.includes('on track')) return 'bg-jade/12 text-jade border-jade/30';
  if (l.includes('expired')) return 'bg-destructive/12 text-destructive border-destructive/30';
  if (l.includes('insufficient')) return 'bg-muted text-muted-foreground border-border';
  return 'bg-amber/15 text-[hsl(32_80%_32%)] border-amber/40';
}

const Caveat = () => (
  <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex gap-2">
    <Info className="w-4 h-4 shrink-0 mt-0.5" />
    <p>Expected remaining is a saved forecast estimate, not a stock ledger. It excludes unconfirmed deliveries; deliveries and adjustments since the snapshot affect the comparison. Yuzu does not infer consumption or claim causal savings. If the observation date differs from the scheduled date, results are "insufficient information to assess" unless stock has expired.</p>
  </div>
);

export function UntrackedApprovals({ data }: { data: GuardState }) {
  const { attach } = useGuardMutations();
  const { toast } = useToast();
  const [days, setDays] = useState<1 | 2>(2);
  const list = data.approvedRecommendations.filter((r) => !data.followUps.some((f) => f.recommendationId === r.id));
  if (!list.length) return null;
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Earlier approvals without a check</h3>
      <p className="text-xs text-muted-foreground">Attach a check explicitly using today's pantry snapshot. Historical stock is unknown; legacy approval times and original wording may also be unknown. Nothing is backfilled.</p>
      <label className="text-xs font-semibold block">Check after attaching
        <select className="ml-2 rounded border bg-background p-2" value={days} onChange={(e) => setDays(Number(e.target.value) as 1 | 2)}>
          <option value={1}>1 day · {niceDate(addDays(data.today, 1))}</option>
          <option value={2}>2 days · {niceDate(addDays(data.today, 2))}</option>
        </select>
      </label>
      {list.map((r) => (
        <div key={r.id} className="flex flex-wrap gap-3 items-center rounded-lg bg-muted/50 p-3">
          <div className="flex-1 min-w-0 text-sm"><b>{r.title}</b><div className="text-xs text-muted-foreground">{r.id.split(':')[0]} plan · approved {fmt(r.approvedQuantity ?? 0)} {r.unit}</div></div>
          <Button size="sm" variant="outline" disabled={attach.isPending} data-testid={`button-attach-history-${r.id}`} onClick={() => attach.mutate({ id: r.id, data: { followUpDays: days } }, {
            onSuccess: () => toast({ title: 'Follow-up attached', description: 'Current snapshot saved. Find this check on the dashboard.' }),
            onError: (e) => toast({ title: 'Follow-up not attached', description: errorMessage(e), variant: 'destructive' }),
          })}>Attach current snapshot</Button>
        </div>
      ))}
    </section>
  );
}

export function FollowUpList({ data }: { data: GuardState }) {
  const [open, setOpen] = useState<FollowUp | null>(null);
  const list = data.followUps.filter((f) => f.status === 'outstanding').sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return (
    <>
      {list.length === 0 ? <EmptyState title="No checks outstanding" body="Approve a recommendation to schedule a one or two day result check." /> : (
        <div className="space-y-2">
          {list.map((f) => {
            const t = followTiming(f.scheduledDate, data.today);
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2" data-testid={`row-followup-${f.id}`}>
                <CalendarClock className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground num">Scheduled {niceDate(f.scheduledDate)} · {f.ingredients.length} ingredient{f.ingredients.length === 1 ? '' : 's'}</div>
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', toneCls[t.tone])}>{t.label}</span>
                <Button size="sm" variant={t.tone === 'upcoming' ? 'outline' : 'default'} onClick={() => setOpen(f)} data-testid={`button-record-${f.id}`}><ClipboardCheck className="w-4 h-4 mr-1" />Record result</Button>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="min-w-0 w-[calc(100%_-_2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
          {open && <OutcomeForm f={open} data={data} onDone={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OutcomeForm({ f, data, onDone }: { f: FollowUp; data: GuardState; onDone: () => void }) {
  const { record } = useGuardMutations();
  const { toast } = useToast();
  const [date, setDate] = useState(data.today);
  const [action, setAction] = useState('');
  const [update, setUpdate] = useState(false);
  const [saved, setSaved] = useState<FollowUp | null>(null);
  const [vals, setVals] = useState<Record<string, { remaining: string; wasted: string }>>(
    Object.fromEntries(f.ingredients.map((i) => [i.ingredientId, { remaining: '', wasted: '' }])),
  );
  const ok = (s: string) => s !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 1e6;
  const dateOk = isDate(date) && date >= f.startingDate.slice(0, 10) && date <= data.today;
  const valid = dateOk && action.trim().length > 0 && action.length <= 1000 && f.ingredients.every((i) => ok(vals[i.ingredientId].remaining) && ok(vals[i.ingredientId].wasted));
  const historical = date < data.today;
  const mismatch = date !== f.scheduledDate.slice(0, 10);

  const submit = () => record.mutate({
    id: f.id,
    data: { observationDate: date, actionTaken: action.trim(), updateInventory: update, rows: f.ingredients.map((i) => ({ ingredientId: i.ingredientId, remaining: Number(vals[i.ingredientId].remaining), wasted: Number(vals[i.ingredientId].wasted) })) },
  }, {
    onSuccess: (state) => { setSaved(state.followUps.find((item) => item.id === f.id) ?? null); toast({ title: 'Result recorded', description: 'Saved to the activity ledger with the full comparison.' }); },
    onError: (e) => toast({ title: 'Result not saved', description: errorMessage(e), variant: 'destructive' }),
  });

  if (saved) return (
    <div className="min-w-0 space-y-4">
      <DialogHeader><DialogTitle>Result recorded</DialogTitle><DialogDescription>The saved comparison is also available in Activity.</DialogDescription></DialogHeader>
      <FollowUpDetail f={saved} />
      <Button className="w-full" onClick={onDone}>Done</Button>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      <DialogHeader>
        <DialogTitle>{f.name}</DialogTitle>
        <DialogDescription>Approved: {f.approvedAction} · <span className="num">{fmt(f.approvedQuantity)} {f.recommendation.unit}</span>. Snapshot {niceDate(f.snapshotAt)}, scheduled check {niceDate(f.scheduledDate)}.</DialogDescription>
      </DialogHeader>
      <Caveat />
      <div className="grid sm:grid-cols-[180px_1fr] gap-3">
        <label className="text-xs font-semibold">Observation date
          <Input type="date" className="mt-1" min={f.startingDate.slice(0, 10)} max={data.today} value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-observation-date" />
          {!dateOk && <span className="text-destructive text-[11px]">Between {niceDate(f.startingDate)} and today.</span>}
        </label>
        <label className="text-xs font-semibold">Action taken (required)
          <Textarea className="mt-1" maxLength={1000} rows={2} placeholder="What did the kitchen actually do?" value={action} onChange={(e) => setAction(e.target.value)} data-testid="input-action-taken" />
        </label>
      </div>
      {mismatch && dateOk && <div className="text-xs text-[hsl(32_80%_32%)] flex gap-1.5"><AlertTriangle className="w-4 h-4" />Observation date differs from the scheduled date; non-expired rows will be assessed as insufficient information.</div>}
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Raw ingredient stock only — not prepared-food leftovers. Discarded quantities since {niceDate(f.startingDate)}.</div>
      <div className="space-y-2">
        {f.ingredients.map((i) => {
          const cur = data.ingredients.find((x) => x.id === i.ingredientId);
          const v = vals[i.ingredientId];
          const set = (k: 'remaining' | 'wasted', s: string) => setVals((p) => ({ ...p, [i.ingredientId]: { ...p[i.ingredientId], [k]: s } }));
          return (
            <div key={i.ingredientId} className="rounded-xl border p-3 grid gap-2 md:grid-cols-[1fr_130px_130px] items-end">
              <div className="text-xs">
                <div className="font-semibold text-sm">{i.name}</div>
                <div className="num text-muted-foreground">Start {fmt(i.startingQuantity)} {i.unit} · earliest expiry {niceDate(i.expiry)}</div>
                {i.batches && i.batches.length > 1 && <div className="text-muted-foreground">Saved batches: {i.batches.map(b => `${fmt(b.quantity)} ${i.unit} expires ${b.expiry}`).join('; ')}. Correct current counts per batch in Pantry; this total observation will not overwrite them.</div>}
                <div className="num text-muted-foreground">Saved forecast at {niceDate(f.scheduledDate)}: <b>{fmt(i.expectedRemaining)} {i.unit}</b> remaining (usage {fmt(i.expectedUsage)})</div>
                {i.deliveryQuantity > 0 && <div className="num text-muted-foreground">Delivery {fmt(i.deliveryQuantity)} {i.unit} on {niceDate(i.deliveryDate)} — excluded unless confirmed</div>}
              </div>
              <label className="text-[11px] font-semibold">Ingredient remaining ({i.unit})<Input type="number" min={0} max={1e6} step="0.1" value={v.remaining} onChange={(e) => set('remaining', e.target.value)} className={cn('mt-1', v.remaining !== '' && !ok(v.remaining) && 'border-destructive')} data-testid={`input-remaining-${i.ingredientId}`} /></label>
              <label className="text-[11px] font-semibold">Ingredient discarded ({i.unit})<Input type="number" min={0} max={1e6} step="0.1" value={v.wasted} onChange={(e) => set('wasted', e.target.value)} className={cn('mt-1', v.wasted !== '' && !ok(v.wasted) && 'border-destructive')} data-testid={`input-wasted-${i.ingredientId}`} /></label>
              <div className="md:col-span-3 text-[11px] text-muted-foreground num">Current pantry measurement: {cur?.measuredDate ? niceDate(cur.measuredDate) : 'unknown (legacy)'}</div>
            </div>
          );
        })}
      </div>
      <label className="flex gap-3 rounded-xl border p-3 cursor-pointer">
        <Checkbox checked={update} onCheckedChange={(c) => setUpdate(c === true)} data-testid="checkbox-update-inventory" />
        <span className="text-xs">
          <b className="text-sm">I confirm: update measured pantry stock with these remaining amounts</b><br />
          Observation date <span className="num">{niceDate(date)}</span>. {historical
            ? 'This is a historical observation: it never overwrites newer measurements. Rows with unknown, newer or same-day measurements are skipped.'
            : 'Today\'s observation may replace older or unknown (legacy) measurements; same-day or newer measurements are kept.'} The server reports what happened to each row.
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button disabled={!valid || record.isPending} onClick={submit} data-testid="button-submit-outcome">{record.isPending ? 'Saving...' : 'Save result'}</Button>
      </div>
    </div>
  );
}

export function FollowUpDetail({ f }: { f: FollowUp }) {
  const rows = f.outcome?.rows ?? [];
  return (
    <div className="min-w-0 rounded-xl border bg-background/60 p-4 space-y-3" data-testid={`detail-followup-${f.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase', f.status === 'completed' ? 'bg-jade/12 text-jade border-jade/30' : 'bg-muted text-muted-foreground border-border')}>{f.status}</span>
        <span className="font-semibold">{f.name}</span>
      </div>
      <div className="text-xs text-muted-foreground num">
        Approved {f.approvedAction} · {fmt(f.approvedQuantity)} {f.recommendation.unit} · approved {f.approvedAt ? new Date(f.approvedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'time unknown (check attached later)'} · scheduled {niceDate(f.scheduledDate)}
        {f.outcome && <> · observed {niceDate(f.outcome.observationDate)} · recorded {new Date(f.outcome.recordedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</>}
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold">Saved recommendation and stock snapshot</summary>
        <div className="mt-2 space-y-1">
          <p>{f.recommendation.title} — {f.recommendation.description}</p>
          <p>Original amount {fmt(f.recommendation.original)} {f.recommendation.unit}; suggested {fmt(f.recommendation.suggested)} {f.recommendation.unit}. Starting point {niceDate(f.startingDate)}.</p>
          {f.ingredients.map((i) => <p key={i.ingredientId}>{i.name}: start {fmt(i.startingQuantity)} {i.unit}, earliest expiry {niceDate(i.expiry)}; forecast usage {fmt(i.expectedUsage)} {i.unit}, remaining estimate {fmt(i.expectedRemaining)} {i.unit} at {niceDate(f.scheduledDate)}. Planned delivery {fmt(i.deliveryQuantity)} {i.unit} on {niceDate(i.deliveryDate)} (not assumed received). {i.batches && `Saved batches: ${i.batches.map(b => `${fmt(b.quantity)} ${i.unit}, expiry ${b.expiry}, received ${b.receivedDate ?? 'unknown'}`).join('; ')}.`}</p>)}
        </div>
      </details>
      {f.cancellationReason && <div className="text-sm">Cancelled: {f.cancellationReason}</div>}
      {f.outcome && <div className="text-sm"><b>Action taken:</b> {f.outcome.actionTaken}</div>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground text-left"><tr><th className="p-1.5">Ingredient</th><th className="p-1.5">Start</th><th className="p-1.5">Forecast left</th><th className="p-1.5">Measured left</th><th className="p-1.5">Ingredient discarded</th><th className="p-1.5">Assessment</th><th className="p-1.5">Next action (needs your approval)</th><th className="p-1.5">Inventory</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const i = f.ingredients.find((x) => x.ingredientId === r.ingredientId);
                return (
                  <tr key={r.ingredientId} className="border-t align-top">
                    <td className="p-1.5 font-semibold">{i?.name ?? r.ingredientId}</td>
                    <td className="p-1.5 num">{i ? `${fmt(i.startingQuantity)} ${i.unit}` : '-'}</td>
                    <td className="p-1.5 num">{i ? `${fmt(i.expectedRemaining)} ${i.unit}` : '-'}</td>
                    <td className="p-1.5 num">{fmt(r.remaining)} {i?.unit}</td>
                    <td className="p-1.5 num">{fmt(r.wasted)} {i?.unit}</td>
                    <td className="p-1.5"><span className={cn('inline-block rounded-full border px-2 py-0.5 font-semibold', assessTone(r.assessment))}>{r.assessment}</span></td>
                    <td className="p-1.5">{r.nextAction}</td>
                    <td className="p-1.5 text-muted-foreground">{r.inventoryUpdate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {f.outcome && <Caveat />}
    </div>
  );
}
