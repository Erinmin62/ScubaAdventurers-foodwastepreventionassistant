import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, RefreshCw, Settings2, Truck, X } from 'lucide-react';
import {
  getGetGuardStateQueryKey, getGetReordersQueryKey, useConfigureReorder, useDecideReorder, useGetReorders, useScanReorders,
  type ReorderConfig, type ReorderLine, type ReorderPlan, type ReorderState,
} from '@workspace/api-client-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, Stat } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ReorderPreviewPanel, previewKey, type PreviewStatus } from '@/components/reorder-preview';
import { addDays, errorMessage, fmt, niceDate, rm, useGuard } from '@/lib/guard';

function useInvalidate() {
  const qc = useQueryClient();
  return (state?: ReorderState) => {
    if (state) qc.setQueryData(getGetReordersQueryKey(), state);
    qc.invalidateQueries({ queryKey: getGetReordersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetGuardStateQueryKey() });
  };
}

const statusCls: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber/15 text-[hsl(32_80%_32%)] border-amber/40',
  EXECUTED: 'bg-jade/12 text-jade border-jade/30',
  REJECTED: 'bg-muted text-muted-foreground border-border',
  FAILED: 'bg-destructive/12 text-destructive border-destructive/30',
  SUPERSEDED: 'bg-muted text-muted-foreground border-border line-through',
};
const pendingPlanPlaceholder = 'Awaiting explicit owner approval. No simulated delivery changed.';
function PlanStatus({ s }: { s: string }) {
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusCls[s] ?? statusCls.REJECTED)} data-testid="status-plan">{s.replace('_', ' ').toLowerCase()}</span>;
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn('num text-sm font-semibold', tone === 'bad' && 'text-destructive', tone === 'good' && 'text-jade')}>{value}</div>
    </div>
  );
}

function LineFacts({ l }: { l: ReorderLine }) {
  const u = l.unit;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Cell label="Current stock (1 batch)" value={`${fmt(l.currentStock)} ${u}`} />
      <Cell label="Earliest received batch expiry" value={niceDate(l.expiry)} />
      <Cell label="Expiry risk" value={`${fmt(l.wasteQuantity)} ${u} · ${rm(l.wasteCost)}`} tone={l.wasteQuantity > 0 ? 'bad' : undefined} />
      <Cell label="Already expired" value={`${fmt(l.expiredQuantity)} ${u}`} tone={l.expiredQuantity > 0 ? 'bad' : undefined} />
      <Cell label="Incoming (1 batch)" value={`${fmt(l.incomingQuantity)} ${u} · ${niceDate(l.incomingDate)}`} />
      <Cell label="Daily usage" value={l.demandAvailable ? `${fmt(l.dailyUsage, 2)} ${u}/day` : 'Review needed'} tone={l.demandAvailable ? undefined : 'bad'} />
      <Cell label="Horizon demand" value={`${fmt(l.expectedDemand)} ${u}`} />
      <Cell label="Original order (snapshot)" value={`${fmt(l.originalQuantity)} ${u} · ${rm(l.originalCost)}`} />
      <Cell label="Proposed total delivery" value={`${fmt(l.recommendedQuantity)} ${u} · ${rm(l.proposedCost)}`} tone="good" />
      <Cell label="Additional beyond incoming" value={`${fmt(l.additionalQuantity)} ${u}`} />
      <Cell label="Delivery date" value={niceDate(l.deliveryDate)} />
      <Cell label="Modeled waste reduction" value={`${fmt(l.potentialWasteReduction)} ${u}`} tone="good" />
      <Cell label="Shortfall before delivery" value={`${fmt(l.shortageBeforeDelivery)} ${u}`} tone={l.shortageBeforeDelivery > 0 ? 'bad' : undefined} />
      <Cell label="Lead / review" value={`${l.config.leadDays}d / ${l.config.reviewDays}d`} />
    </div>
  );
}

function Assumptions({ l }: { l: ReorderLine }) {
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p className="text-foreground">{l.explanation}</p>
      <ul className="list-disc pl-4">{l.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </div>
  );
}

function PlanCard({ plan, today }: { plan: ReorderPlan; today: string }) {
  const l = plan.line;
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const decide = useDecideReorder();
  const [mode, setMode] = useState<null | 'approve' | 'reject'>(null);
  const [qty, setQty] = useState(String(l.recommendedQuantity));
  const [date, setDate] = useState(l.deliveryDate);
  const [name, setName] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>(null);
  useEffect(() => { setReviewed(false); }, [qty, date]);
  const approveButton = useRef<HTMLButtonElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const decisionHeading = useRef<HTMLDivElement>(null);
  const planTitle = useRef<HTMLHeadingElement>(null);
  const returnFocusTo = useRef<'approve' | 'reject' | null>(null);
  const minDate = addDays(today, l.config.leadDays);
  const keepsExisting = date === l.deliveryDate && date > today;
  const qn = Number(qty);
  const qtyOk = qty.trim() !== '' && Number.isFinite(qn) && qn >= 0 && (l.unit !== 'pcs' || Number.isInteger(qn));
  const dateOk = !!date && (date >= minDate || keepsExisting);
  const nameOk = name.trim().length > 0 && name.trim().length <= 80;
  const delayed = date > l.deliveryDate;
  const previewOk = !!previewStatus && previewStatus.key === previewKey(plan.id, qty, date) && previewStatus.approvalAllowed;
  const canApprove = l.demandAvailable && qtyOk && dateOk && nameOk && reviewed && previewOk;
  const pending = plan.status === 'PENDING_APPROVAL';
  useEffect(() => {
    if (mode) {
      decisionHeading.current?.focus();
      return;
    }
    const returnTo = returnFocusTo.current;
    if (!returnTo) return;
    returnFocusTo.current = null;
    const target = pending
      ? returnTo === 'approve' ? approveButton.current : rejectButton.current
      : planTitle.current;
    target?.focus();
  }, [mode, pending]);

  const submit = (decision: 'approve' | 'reject') => {
    decide.mutate(
      { id: plan.id, data: { decision, approver: name.trim(), ...(decision === 'approve' ? { quantity: qn, deliveryDate: date } : {}) } },
      {
        onSuccess: (state) => {
          invalidate(state);
          const after = state.plans.find((p) => p.id === plan.id);
          setMode(null);
          if (after?.status === 'FAILED') toast({ title: 'Execution failed', description: after.detail, variant: 'destructive' });
          else if (after?.status === 'EXECUTED') toast({ title: 'Plan recorded (demo only, no supplier order)', description: l.name });
          else if (after?.status === 'REJECTED') toast({ title: 'Plan rejected', description: l.name });
          else toast({ title: 'Decision returned status ' + (after?.status ?? 'unknown'), description: after?.detail ?? l.name });
        },
        onError: (e) => { invalidate(); toast({ title: 'Decision not saved', description: errorMessage(e), variant: 'destructive' }); },
      },
    );
  };

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', pending ? 'border-primary/30 bg-primary/[0.03]' : 'bg-background/60', plan.status === 'FAILED' && 'border-destructive/40 bg-destructive/[0.03]')} data-testid={`card-plan-${plan.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><PlanStatus s={plan.status} /><span className="num text-[11px] text-muted-foreground">drafted {niceDate(plan.createdAt.slice(0, 10))}</span></div>
          <h3 ref={planTitle} tabIndex={-1} className="font-semibold text-lg mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{l.name}</h3>
        </div>
        <div className="text-right num">
          <div className="text-lg font-semibold">{fmt(l.recommendedQuantity)} <span className="text-xs text-muted-foreground">{l.unit}</span></div>
          <div className="text-[11px] text-muted-foreground">was {fmt(l.originalQuantity)} {l.unit} · {rm(l.originalCost)}</div>
          {l.originalCost - l.proposedCost > 0 && <div className="mt-1 text-jade"><div className="text-2xl font-extrabold">{rm(l.originalCost - l.proposedCost)}</div><div className="text-[10px] font-bold uppercase tracking-wider">less purchasing · est., not realised</div></div>}
        </div>
      </div>
      {!l.demandAvailable && <div id={`review-required-${plan.id}`} role="status" className="flex gap-2 text-xs rounded-lg border border-destructive/30 bg-destructive/5 p-2"><AlertTriangle className="w-4 h-4 text-destructive shrink-0" />Review available. Approval stays disabled until the missing demand, delivery or planning information is resolved. You can still reject.</div>}
      {!mode && <details className="rounded-lg border bg-muted/20 p-3 text-xs">
        <summary className="cursor-pointer font-semibold">Review quantities, explanation and assumptions</summary>
        <div className="mt-3 space-y-3"><LineFacts l={l} /><Assumptions l={l} /></div>
      </details>}
      {l.shortageBeforeDelivery > 0 && <div className="flex gap-2 text-xs rounded-lg border border-amber/40 bg-amber/10 p-2" data-testid={`text-shortfall-${plan.id}`}><AlertTriangle className="w-4 h-4 shrink-0" />Expected shortfall of {fmt(l.shortageBeforeDelivery)} {l.unit} before delivery on {niceDate(l.deliveryDate)}.</div>}
      {plan.detail && plan.detail !== pendingPlanPlaceholder && <p className={cn('text-xs', plan.status === 'FAILED' ? 'text-destructive font-semibold' : 'text-muted-foreground')} data-testid={`text-detail-${plan.id}`}>{plan.status === 'FAILED' ? 'Failure reason: ' : ''}{plan.detail}</p>}
      {plan.decidedAt && (
        <div className="num text-[11px] text-muted-foreground">
          Decided {plan.decidedAt.replace('T', ' ').slice(0, 16)} by {plan.approver ?? 'unknown'} (self-reported)
          {plan.approvedQuantity !== undefined && <> · approved {fmt(plan.approvedQuantity)} {l.unit}</>}
          {plan.approvedDate && <> for {niceDate(plan.approvedDate)}</>}
        </div>
      )}
      {pending && !mode && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button ref={approveButton} size="sm" className="min-h-11 w-full sm:w-auto font-semibold" onClick={() => { returnFocusTo.current = 'approve'; setReviewed(false); setPreviewStatus(null); setMode('approve'); }} aria-describedby={!l.demandAvailable ? `review-required-${plan.id}` : undefined} data-testid={`button-review-${plan.id}`}><Check className="w-4 h-4 mr-1" />Review and approve</Button>
          <Button ref={rejectButton} size="sm" variant="outline" className="min-h-11 w-full sm:w-auto border-destructive/50 text-destructive hover:bg-destructive/5" onClick={() => { returnFocusTo.current = 'reject'; setMode('reject'); }} data-testid={`button-reject-${plan.id}`}><X className="w-4 h-4 mr-1" />Reject</Button>
        </div>
      )}
      {pending && mode && (
        <div className="rounded-xl border bg-card p-4 space-y-3" role="region" aria-labelledby={`decision-heading-${plan.id}`}>
          <div ref={decisionHeading} id={`decision-heading-${plan.id}`} tabIndex={-1} className="text-xs font-bold uppercase tracking-wider text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{mode === 'approve' ? 'Full review before approval' : 'Confirm rejection'}</div>
          <LineFacts l={l} />
          <Assumptions l={l} />
          {mode === 'approve' && <p className="text-[11px] text-muted-foreground">Figures above are the original recommendation snapshot from the scan. The live preview below re-estimates for your quantity and date.</p>}
          {mode === 'approve' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold space-y-1">Quantity ({l.unit})
                <Input type="number" min={0} step={l.unit === 'pcs' ? '1' : '0.1'} value={qty} onChange={(e) => setQty(e.target.value)} data-testid={`input-qty-${plan.id}`} />
                <span className="block font-normal text-muted-foreground">Positive quantities must meet minimum order {fmt(l.config.minOrder)} {l.unit} (checked by server).</span>
                {!qtyOk && <span className="block text-destructive">{l.unit === 'pcs' ? 'Enter a whole number of 0 or more.' : 'Enter a number of 0 or more.'}</span>}
              </label>
              <label className="text-xs font-semibold space-y-1">Delivery date
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid={`input-date-${plan.id}`} />
                <span className="block font-normal text-muted-foreground">Earliest new date {niceDate(minDate)} (today + {l.config.leadDays} lead days).</span>
                {!dateOk && <span className="block text-destructive">Date must be on or after {niceDate(minDate)}.</span>}
                {delayed && dateOk && <span className="block text-[hsl(32_80%_32%)]">You are explicitly approving a delay from {niceDate(l.deliveryDate)}.</span>}
              </label>
            </div>
          )}
          {mode === 'approve' && <ReorderPreviewPanel plan={plan} qty={qty} date={date} inputsValid={qtyOk && dateOk} onStatus={setPreviewStatus} onRestore={(q, d) => { setQty(q); setDate(d); }} />}
          {mode === 'approve' && l.demandAvailable && !previewOk && <p className="text-xs text-muted-foreground" data-testid={`text-approval-needs-preview-${plan.id}`}>Approval unlocks only after a successful preview of the current quantity and date that the server allows.</p>}
          <label className="text-xs font-semibold space-y-1 block">Decision note / name (self-reported; access is restricted to your signed-in account)
            <Input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Owner name" data-testid={`input-approver-${plan.id}`} />
          </label>
          {mode === 'approve' && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5" data-testid={`checkbox-reviewed-${plan.id}`} />
              I reviewed original and proposed quantity, date, purchase cost, estimated waste and assumptions. This records a synthetic plan only; no supplier is contacted.
            </label>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            {mode === 'approve'
              ? <Button size="sm" className="min-h-11 w-full sm:w-auto font-semibold" disabled={!canApprove || decide.isPending} onClick={() => submit('approve')} data-testid={`button-confirm-approve-${plan.id}`}>{decide.isPending ? 'Saving...' : 'Confirm approval'}</Button>
              : <Button size="sm" variant="destructive" className="min-h-11 w-full sm:w-auto" disabled={!nameOk || decide.isPending} onClick={() => submit('reject')} data-testid={`button-confirm-reject-${plan.id}`}>{decide.isPending ? 'Saving...' : 'Confirm rejection'}</Button>}
            <Button size="sm" variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={() => setMode(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigRow({ cfg, name, unit }: { cfg: ReorderConfig; name: string; unit: string }) {
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const configure = useConfigureReorder();
  const [v, setV] = useState({
    leadDays: String(cfg.leadDays), reviewDays: String(cfg.reviewDays), minOrder: String(cfg.minOrder),
    safetyStock: String(cfg.safetyStock), shelfDays: String(cfg.shelfDays), dailyUsage: cfg.dailyUsage === undefined ? '' : String(cfg.dailyUsage),
  });
  const n = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const intIn = (s: string, lo: number, hi: number) => Number.isInteger(n(s)) && n(s) >= lo && n(s) <= hi;
  const nonneg = (s: string) => Number.isFinite(n(s)) && n(s) >= 0;
  const errs = {
    leadDays: !intIn(v.leadDays, 1, 14), reviewDays: !intIn(v.reviewDays, 1, 14), minOrder: !nonneg(v.minOrder),
    safetyStock: !nonneg(v.safetyStock), shelfDays: !intIn(v.shelfDays, 1, 90), dailyUsage: v.dailyUsage.trim() !== '' && !nonneg(v.dailyUsage),
  };
  const bad = Object.values(errs).some(Boolean);
  const save = () => configure.mutate({ data: {
    ingredientId: cfg.ingredientId, leadDays: n(v.leadDays), reviewDays: n(v.reviewDays), minOrder: n(v.minOrder),
    safetyStock: n(v.safetyStock), shelfDays: n(v.shelfDays), ...(v.dailyUsage.trim() !== '' ? { dailyUsage: n(v.dailyUsage) } : {}),
  } }, {
    onSuccess: (state) => { invalidate(state); toast({ title: 'Assumptions saved', description: name }); },
    onError: (e) => toast({ title: 'Assumptions not saved', description: errorMessage(e), variant: 'destructive' }),
  });
  const fields: [keyof typeof v, string][] = [['leadDays', 'Lead days (1-14)'], ['reviewDays', 'Review days (1-14)'], ['minOrder', `Min order (${unit})`], ['safetyStock', `Safety stock (${unit})`], ['shelfDays', 'Shelf days (1-90)'], ['dailyUsage', `Daily usage override (${unit}/day, optional)`]];
  return (
    <div className="rounded-xl border p-3" data-testid={`row-config-${cfg.ingredientId}`}>
      <div className="font-semibold text-sm mb-2">{name}</div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        {fields.map(([k, label]) => (
          <label key={k} className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold space-y-1">{label}
            <Input type="number" min={0} step={k === 'minOrder' || k === 'safetyStock' || k === 'dailyUsage' ? '0.1' : '1'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className={cn('num', errs[k] && 'border-destructive')} data-testid={`input-${k}-${cfg.ingredientId}`} />
          </label>
        ))}
      </div>
      <div className="flex justify-end mt-2"><Button size="sm" variant="secondary" disabled={bad || configure.isPending} onClick={save} data-testid={`button-save-config-${cfg.ingredientId}`}>{configure.isPending ? 'Saving...' : 'Save assumptions'}</Button></div>
    </div>
  );
}

import { FocusBanner, useFocusItem, useScrollHighlight } from '@/components/focus-target';

export default function Reordering() {
  const { data, isLoading, error, refetch } = useGetReorders({ query: { queryKey: getGetReordersQueryKey(), refetchInterval: 30000 } });
  const { data: guard } = useGuard();
  const scan = useScanReorders();
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [tab, setTab] = useState<'plans' | 'analysis' | 'config' | 'history'>('plans');
  const focus = useFocusItem();
  useScrollHighlight(focus ? 'focus-target' : null, !!data);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const today = guard?.today ?? new Date().toISOString().slice(0, 10);
  const pending = data.plans.filter((p) => p.status === 'PENDING_APPROVAL');
  const history = data.plans.filter((p) => p.status !== 'PENDING_APPROVAL').sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt));
  const failed = history.filter((p) => p.status === 'FAILED').length;
  const riskCost = data.analysis.reduce((s, l) => s + l.wasteCost, 0);
  const savedCost = data.analysis.reduce((s, l) => s + (l.originalCost - l.proposedCost), 0);
  const doScan = () => scan.mutate(undefined, {
    onSuccess: (s) => { invalidate(s); toast({ title: 'Reorder scan complete', description: `${s.plans.filter((p) => p.status === 'PENDING_APPROVAL').length} plans awaiting approval` }); },
    onError: (e) => toast({ title: 'Scan failed', description: errorMessage(e), variant: 'destructive' }),
  });
  const tabs: [typeof tab, string][] = [['plans', `Proposed (${pending.length})`], ['analysis', 'Live analysis'], ['config', 'Supplier assumptions'], ['history', `History (${history.length})`]];

  return (
    <div className="space-y-6">
      <PageHeader kicker="Waste-aware reordering" title="Order what will be used" aside={
        <Button onClick={doScan} disabled={scan.isPending} data-testid="button-scan"><RefreshCw className={cn('w-4 h-4 mr-2', scan.isPending && 'animate-spin')} />{scan.isPending ? 'Scanning...' : 'Run reorder scan'}</Button>
      }>
        Simple rules, not machine learning: usage history, lead time, shelf life and safety stock size each order. Synthetic demo: no supplier orders are ever placed, and waste reduction is modeled, not measured.
        {data.lastScan && <> Last scan {data.lastScan.replace('T', ' ').slice(0, 16)}.</>}
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Awaiting approval" value={String(pending.length)} tone="primary" testId="text-pending-reorders" />
        <Stat label="Expiry risk now" value={rm(riskCost)} tone="amber" note="Stock likely to expire unused" />
        <Stat label="Modeled purchase change" value={rm(savedCost)} tone="jade" note="Original minus recommended, est." />
        <Stat label="Failed executions" value={String(failed)} tone="ink" note="See history for reasons" />
      </div>
      {focus && (() => { const f = data.plans.find((p) => p.id === focus); return (
        <div id="focus-target" className="scroll-mt-24"><FocusBanner found={!!f} clearHref="/reordering" label={f ? `${f.line.name} reorder plan: ${f.status.replace('_', ' ').toLowerCase()}` : ''}>
          {f && (f.status === 'PENDING_APPROVAL' ? <PlanCard plan={f} today={today} />
            : <div className={cn('rounded-lg border bg-card p-3 text-sm', f.status === 'FAILED' && 'border-destructive/40')} data-testid={`focus-plan-${f.id}`}>
                <div className="flex flex-wrap items-center gap-2"><PlanStatus s={f.status} /><b>{f.line.name}</b><span className="num text-xs text-muted-foreground ml-auto">{(f.decidedAt ?? f.createdAt).replace('T', ' ').slice(0, 16)}{f.approver && ` · ${f.approver}`}</span></div>
                {f.detail && <div className={cn('text-xs mt-1', f.status === 'FAILED' ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{f.status === 'FAILED' ? 'Reason: ' : ''}{f.detail}</div>}
              </div>)}
        </FocusBanner></div>); })()}
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1 w-fit">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`tab-${k}`} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
        ))}
      </div>
      {tab === 'plans' && (
        <Panel title="Proposed order plans" sub="Each plan needs an explicit owner decision. Approval records a synthetic plan only.">
          {pending.length ? <div className="space-y-3">{pending.filter((p) => p.id !== focus).map((p) => <PlanCard key={p.id} plan={p} today={today} />)}</div>
            : <EmptyState title="No plans waiting" body="Run a reorder scan to draft a plan per ingredient." />}
        </Panel>
      )}
      {tab === 'analysis' && (
        <Panel title="Live ingredient analysis" sub="Received batches are allocated by earliest expiry. The incoming delivery is a separate plan, not received stock.">
          {data.analysis.length ? <div className="space-y-4">{data.analysis.map((l) => (
            <div key={l.ingredientId} className="rounded-xl border p-4 space-y-3" data-testid={`card-analysis-${l.ingredientId}`}>
              <div className="flex items-center gap-2 font-semibold"><Truck className="w-4 h-4 text-primary" />{l.name}</div>
              {l.shortageBeforeDelivery > 0 && <div className="text-xs text-destructive font-semibold">Shortfall warning: {fmt(l.shortageBeforeDelivery)} {l.unit} short before delivery.</div>}
              <LineFacts l={l} />
              <Assumptions l={l} />
            </div>
          ))}</div> : <EmptyState title="No ingredients to analyse" body="Add pantry stock first." />}
        </Panel>
      )}
      {tab === 'config' && (
        <Panel title="Supplier assumptions" sub="Owner-entered assumptions, not verified supplier terms." action={<Settings2 className="w-5 h-5 text-muted-foreground" />}>
          {data.analysis.length ? <div className="space-y-3">{data.analysis.map((l) =>
            <ConfigRow key={l.ingredientId + JSON.stringify(l.config)} cfg={l.config} name={l.name} unit={l.unit} />
          )}</div> : <EmptyState title="No ingredients yet" body="Add pantry ingredients to configure supplier assumptions." />}
        </Panel>
      )}
      {tab === 'history' && (
        <Panel title="Execution history" sub="Immutable audit trail. Failures show their reason; nothing here is a real supplier order.">
          {history.length ? <div className="space-y-2">{history.map((p) => (
            <div key={p.id} className={cn('rounded-lg border p-3 text-sm', p.status === 'FAILED' && 'border-destructive/40 bg-destructive/[0.04]')} data-testid={`row-history-${p.id}`}>
              <div className="flex flex-wrap items-center gap-2"><PlanStatus s={p.status} /><b>{p.line.name}</b>
                <span className="num text-xs text-muted-foreground ml-auto">{(p.decidedAt ?? p.createdAt).replace('T', ' ').slice(0, 16)}{p.approver && ` · ${p.approver}`}</span></div>
              <div className="num text-xs text-muted-foreground mt-1">
                Proposed {fmt(p.line.recommendedQuantity)} {p.line.unit} for {niceDate(p.line.deliveryDate)} ({rm(p.line.proposedCost)})
                {p.beforeQuantity !== undefined && <> · incoming {fmt(p.beforeQuantity)} to {fmt(p.afterQuantity ?? 0)} {p.line.unit}</>}
                {p.beforeDate && <> · date {niceDate(p.beforeDate)} to {p.afterDate ? niceDate(p.afterDate) : '-'}</>}
              </div>
              {p.detail && p.detail !== pendingPlanPlaceholder && <div className={cn('text-xs mt-1', p.status === 'FAILED' ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{p.status === 'FAILED' ? 'Reason: ' : ''}{p.detail}</div>}
            </div>
          ))}</div> : <EmptyState title="No decisions yet" body="Approved, rejected, failed and superseded plans are kept here." />}
        </Panel>
      )}
    </div>
  );
}
