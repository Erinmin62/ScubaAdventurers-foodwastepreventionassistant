import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { GuardState } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { fmt, rm } from '@/lib/guard';
import { impactNumbers } from '@/lib/impact';
export { impactNumbers } from '@/lib/impact';

export function EstTag({ children = 'Estimate · not yet realised', className }: { children?: string; className?: string }) {
  return <span className={cn('inline-flex rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', className)}>{children}</span>;
}

function deltaText(d: number, money: boolean) {
  if (Math.abs(d) < 0.005) return money ? 'RM 0.00' : '0 kg';
  const v = money ? rm(Math.abs(d)) : `${fmt(Math.abs(d))} kg`;
  return `${d > 0 ? '-' : '+'}${v}`;
}

export function ImpactBoard({ data, showLink }: { data: GuardState; showLink?: boolean }) {
  const n = impactNumbers(data);
  const tone = n.wasteDelta > 0.005 ? 'text-jade' : n.wasteDelta < -0.005 ? 'text-destructive' : 'text-foreground';
  const deltaNote = n.wasteDelta > 0.005 ? 'less recorded waste than baseline' : n.wasteDelta < -0.005 ? 'more recorded waste than baseline' : 'no change from baseline';
  return (
    <section className="rise rounded-3xl border bg-card p-5 md:p-6 shadow-sm" data-testid="panel-money-impact">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-bold">Money at stake</div>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-1">What prevention could be worth</h2>
        </div>
        {showLink && <Link href="/impact" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary" data-testid="link-impact-today">See full impact <ArrowRight className="w-4 h-4" /></Link>}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl bg-jade/10 border border-jade/30 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-jade">Waiting for your decision</div>
          <div className="num text-4xl xl:text-[2.5rem] 2xl:text-5xl font-extrabold text-jade mt-1 break-words" data-testid="text-pending-potential">{rm(n.pendingPotential)}</div>
          <div className="text-sm mt-1">Potential purchasing reduction from {n.pendingCount} pending purchase suggestion{n.pendingCount === 1 ? '' : 's'}</div>
          <EstTag className="mt-2 text-jade" children="Potential estimate · not yet realised" />
        </div>
        <div className="rounded-2xl bg-ink text-[hsl(38_40%_94%)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Already approved</div>
          <div className="num text-4xl xl:text-[2.5rem] 2xl:text-5xl font-extrabold mt-1 break-words" data-testid="text-impact-approved">{rm(n.approvedProjection)}</div>
          <div className="text-sm mt-1 opacity-80">Projected purchasing change from approved decisions</div>
          <EstTag className="mt-2 text-primary" children="Projected estimate · not cash saved" />
        </div>
        <div className="rounded-2xl bg-muted/50 border p-4 md:col-span-2 xl:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recorded waste, last 7 days</div>
          <div className={cn('num text-4xl xl:text-[2.5rem] 2xl:text-5xl font-extrabold mt-1 break-words', tone)} data-testid="text-impact-waste-change">{deltaText(n.wasteDelta, true)}</div>
          <div className="text-sm mt-1">{deltaNote} <span className="num">({deltaText(n.kgDelta, false)})</span></div>
          <div className="num text-xs text-muted-foreground mt-1">Baseline {rm(n.baselineCost)} · {fmt(n.baselineKg)} kg → Recent {rm(n.recentCost)} · {fmt(n.recentKg)} kg</div>
          <EstTag className="mt-2 text-muted-foreground" children="Synthetic comparison · not proven savings" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">These three figures are separate and are not added together. Purchasing figures are estimates from suggestions; nothing is ordered automatically.</p>
    </section>
  );
}

/** Large savings figure for a single decision. */
export function SavingsBadge({ amount, status, id }: { amount: number; status: string; id: string }) {
  if (!(amount > 0)) return null;
  if (status === 'rejected') {
    return <div className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground" data-testid={`text-savings-${id}`}>Rejected: the <span className="num line-through">{rm(amount)}</span> estimate will not apply</div>;
  }
  const label = status === 'pending' ? 'Could save' : 'Projected to save';
  const tag = status === 'pending' ? 'Potential estimate · not yet realised' : 'Projected estimate · not yet realised';
  return (
    <div className="rounded-xl bg-jade/10 border border-jade/30 px-3 py-2" data-testid={`text-savings-${id}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-jade">{label}</div>
      <div className="num text-3xl font-extrabold text-jade leading-tight">{rm(amount)}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-jade/80">{tag}</div>
    </div>
  );
}
