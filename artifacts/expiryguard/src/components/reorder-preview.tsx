import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { usePreviewReorder, type ReorderPlan, type ReorderPreview, type ReorderScenario } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { errorMessage, fmt, niceDate, rm } from '@/lib/guard';

export type PreviewStatus = { key: string; approvalAllowed: boolean } | null;
export const previewKey = (id: string, qty: string, date: string) => JSON.stringify([id, qty, date]);

type State =
  | { kind: 'idle' }
  | { kind: 'invalid' }
  | { kind: 'loading'; key: string }
  | { kind: 'error'; key: string; message: string }
  | { kind: 'ready'; key: string; data: ReorderPreview };

export function ReorderPreviewPanel({ plan, qty, date, inputsValid, onStatus, onRestore }: {
  plan: ReorderPlan; qty: string; date: string; inputsValid: boolean;
  onStatus: (s: PreviewStatus) => void;
  onRestore: (qty: string, date: string) => void;
}) {
  const l = plan.line;
  const preview = usePreviewReorder();
  const mutateRef = useRef(preview.mutateAsync);
  mutateRef.current = preview.mutateAsync;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const seq = useRef(0);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [retryTick, setRetryTick] = useState(0);
  const key = previewKey(plan.id, qty, date);

  useEffect(() => {
    const my = ++seq.current;
    statusRef.current(null);
    if (!l.demandAvailable) { setState({ kind: 'idle' }); return; }
    if (!inputsValid) { setState({ kind: 'invalid' }); return; }
    setState({ kind: 'loading', key });
    const t = setTimeout(async () => {
      try {
        const data = await mutateRef.current({ id: plan.id, data: { quantity: Number(qty), deliveryDate: date } });
        if (my !== seq.current) return;
        setState({ kind: 'ready', key, data });
        statusRef.current({ key, approvalAllowed: data.approvalAllowed });
      } catch (e) {
        if (my !== seq.current) return;
        setState({ kind: 'error', key, message: errorMessage(e) });
        statusRef.current({ key, approvalAllowed: false });
      }
    }, 350);
    return () => { clearTimeout(t); ++seq.current; };
  }, [key, plan.id, qty, date, inputsValid, l.demandAvailable, retryTick]);

  const isRec = qty === String(l.recommendedQuantity) && date === l.deliveryDate;
  const isOrig = qty === String(l.originalQuantity) && date === l.deliveryDate;
  const current = state.kind === 'ready' && state.key === key ? state.data : null;

  const statusText = !l.demandAvailable ? 'Preview unavailable: demand information is missing.'
    : state.kind === 'invalid' ? 'Preview paused: fix the quantity or date to see an estimate.'
    : state.kind === 'loading' ? 'Calculating your scenario...'
    : state.kind === 'error' ? 'Preview failed. Approval is blocked until a preview succeeds.'
    : current ? `Preview updated for ${fmt(current.scenario.quantity)} ${l.unit} on ${niceDate(current.scenario.deliveryDate)}.` : '';

  return (
    <section className="rounded-xl border-2 border-ink/15 bg-card overflow-hidden" aria-labelledby={`preview-heading-${plan.id}`} data-testid={`panel-preview-${plan.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-ink text-[hsl(38_40%_92%)]">
        <div>
          <h4 id={`preview-heading-${plan.id}`} className="font-display text-base font-bold">What if: live order preview</h4>
          <p className="text-[11px] opacity-80">Estimates only, not realised savings. Nothing is saved; inventory, orders and activity stay untouched.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" className="min-h-11" disabled={isRec} onClick={() => onRestore(String(l.recommendedQuantity), l.deliveryDate)} data-testid={`button-restore-recommended-${plan.id}`}><RotateCcw className="w-4 h-4 mr-1" />Recommended</Button>
          <Button type="button" size="sm" variant="secondary" className="min-h-11" disabled={isOrig} onClick={() => onRestore(String(l.originalQuantity), l.deliveryDate)} data-testid={`button-restore-original-${plan.id}`}><RotateCcw className="w-4 h-4 mr-1" />Original order</Button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p role="status" aria-live="polite" className={cn('text-xs font-semibold flex items-center gap-2', state.kind === 'error' && 'text-destructive')} data-testid={`status-preview-${plan.id}`}>
          {state.kind === 'loading' && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />}{statusText}
        </p>

        {!l.demandAvailable && <p className="text-xs rounded-lg border border-destructive/30 bg-destructive/5 p-3">Without usage data the server cannot estimate waste or shortage for any quantity. Approval remains blocked; you can still reject this plan.</p>}

        {state.kind === 'error' && state.key === key && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-destructive" aria-hidden /><span className="flex-1">{state.message}</span>
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => setRetryTick((n) => n + 1)} data-testid={`button-retry-preview-${plan.id}`}>Retry preview</Button>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="grid md:grid-cols-3 gap-2" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-lg bg-muted/60 animate-pulse" />)}</div>
        )}

        {current && (
          <>
            <div className="grid md:grid-cols-3 gap-2">
              <ScenarioCol title="Original order" s={current.original} unit={l.unit} />
              <ScenarioCol title="Recommended" s={current.recommended} unit={l.unit} />
              <ScenarioCol title="Your scenario" s={current.scenario} unit={l.unit} highlight compare={current.original} testId={`col-scenario-${plan.id}`} />
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div className={cn('rounded-lg px-3 py-2', current.purchaseReduction < 0 ? 'bg-destructive/10 text-destructive' : 'bg-jade/10 text-jade')}><span className="block text-[10px] uppercase tracking-wider font-bold">Purchase change vs original (est.)</span><span className="num text-2xl font-extrabold" data-testid={`text-purchase-reduction-${plan.id}`}>{current.purchaseReduction > 0 ? '-' : current.purchaseReduction < 0 ? '+' : ''}{rm(Math.abs(current.purchaseReduction))}</span></div>
              <div className={cn('rounded-lg px-3 py-2', current.wasteReduction < 0 ? 'bg-destructive/10 text-destructive' : 'bg-jade/10 text-jade')}><span className="block text-[10px] uppercase tracking-wider font-bold">Waste change vs original (est.)</span><span className="num text-2xl font-extrabold" data-testid={`text-waste-reduction-${plan.id}`}>{current.wasteReduction > 0 ? '-' : current.wasteReduction < 0 ? '+' : ''}{fmt(Math.abs(current.wasteReduction))} {current.unit}</span></div>
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>Usage assumption: <b className="num text-foreground">{fmt(current.dailyUsage, 2)} {current.unit}/day</b>.</li>
              <li>Demand reviewed through <b className="text-foreground">{niceDate(current.reviewThrough)}</b> for every column; waste evaluated through <b className="text-foreground">{niceDate(current.evaluatedThrough)}</b>.</li>
              <li>Your quantity replaces the planned incoming delivery ({fmt(l.incomingQuantity)} {l.unit}); it is not added on top.</li>
            </ul>
            {current.warnings.length > 0 && (
              <ul className="space-y-1" data-testid={`list-preview-warnings-${plan.id}`}>
                {current.warnings.map((w, i) => <li key={i} className="flex gap-2 text-xs rounded-lg border border-amber/40 bg-amber/10 p-2"><AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />{w}</li>)}
              </ul>
            )}
            {!current.approvalAllowed && <p className="text-xs font-semibold text-destructive">The server will not allow approval of this scenario. Adjust it or reject.</p>}
          </>
        )}
      </div>
    </section>
  );
}

function ScenarioCol({ title, s, unit, highlight, compare, testId }: { title: string; s: ReorderScenario; unit: string; highlight?: boolean; compare?: ReorderScenario; testId?: string }) {
  const diff = compare ? s.purchaseCost - compare.purchaseCost : 0;
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', highlight ? 'border-primary bg-primary/[0.05] ring-1 ring-primary/30' : 'bg-muted/30')} data-testid={testId}>
      <div className={cn('text-[10px] uppercase tracking-wider font-bold', highlight ? 'text-primary' : 'text-muted-foreground')}>{title}</div>
      <div className="num text-xs text-muted-foreground">{fmt(s.quantity)} {unit} · {niceDate(s.deliveryDate)}</div>
      <div>
        <div className="num text-2xl sm:text-3xl font-extrabold leading-none">{rm(s.purchaseCost)}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">purchase cost{compare && diff !== 0 && <span className={cn('ml-1 font-bold', diff < 0 ? 'text-jade' : 'text-destructive')}>{diff < 0 ? '-' : '+'}{rm(Math.abs(diff))}</span>}</div>
      </div>
      <dl className="num text-xs grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground font-sans">Est. waste</dt><dd className={cn(s.wasteQuantity > 0 && 'text-destructive font-semibold')}>{fmt(s.wasteQuantity)} {unit} · {rm(s.wasteCost)}</dd>
        <dt className="text-muted-foreground font-sans">Shortage</dt><dd className={cn(s.shortageQuantity > 0 && 'text-destructive font-semibold')}>{fmt(s.shortageQuantity)} {unit}</dd>
        <dt className="text-muted-foreground font-sans">of which before delivery</dt><dd className={cn(s.shortageBeforeDelivery > 0 && 'text-destructive font-semibold')}>{fmt(s.shortageBeforeDelivery)} {unit}</dd>
        <dt className="text-muted-foreground font-sans">Closing stock</dt><dd>{fmt(s.closingStock)} {unit}</dd>
      </dl>
    </div>
  );
}
