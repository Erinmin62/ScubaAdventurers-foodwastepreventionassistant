import { useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Bot, Truck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, ErrorState, LevelPill, LoadingState, Panel, RecCard, Stat, guardianSrc } from '@/components/bits';
import { ImpactBoard } from '@/components/money';
import { FollowUpList } from '@/components/followups';
import type { GuardState } from '@workspace/api-client-react';
import { addDays, fmt, niceDate, rm, useGuard } from '@/lib/guard';

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useGuard();
  useEffect(() => {
    if (!isLoading && window.location.hash === '#result-checks') {
      document.getElementById('result-checks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isLoading]);
  const chart = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(data.today, i - 13);
      return { d: niceDate(d).split(' ').slice(0, 2).join(' '), portions: data.sales.filter((s) => s.date.slice(0, 10) === d).reduce((a, s) => a + s.portions, 0) };
    });
  }, [data]);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const s = data.summary;
  const pending = data.recommendations.filter((r) => r.status === 'pending');
  const deliveries = data.ingredients.filter((i) => i.deliveryQuantity > 0 && i.deliveryDate).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)).slice(0, 6);
  const risks = data.risks.filter(r => r.level !== 'low').sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div className="space-y-5">
      <ImpactBoard data={data} showLink />
      <section className="rise relative overflow-hidden rounded-3xl bg-ink text-[hsl(38_40%_94%)] p-6 md:p-8">
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold">Morning briefing · {niceDate(data.today)}</div>
            <h1 className="text-3xl md:text-5xl font-extrabold mt-2 leading-[1.05]">
              Tomorrow, prep <span className="text-primary num">{fmt(s.predictedPortions, 0)}</span> portions.<br />
              {s.riskValue > 0 ? <><span className="text-amber num">{rm(s.riskValue)}</span> of stock needs review.</> : <>Your pantry is calm.</>}
            </h1>
            <p className="mt-3 text-sm opacity-75 max-w-xl">Yuzu read yesterday's till and every expiry label. {s.pendingCount} decision{s.pendingCount === 1 ? '' : 's'} wait for your sign-off — nothing moves without you.</p>
            <Link href="/recommendations" className="inline-flex items-center gap-2 mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:translate-x-1" data-testid="link-review">Review decisions <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/reordering" className="ml-3 inline-flex items-center gap-1 mt-4 text-xs font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-reordering-today"><Truck className="w-3.5 h-3.5" />Reorder plans (owner approval)</Link>
          </div>
          <img src={guardianSrc} alt="" className="bob hidden md:block w-44" />
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Predicted portions" value={fmt(s.predictedPortions, 0)} note={`for ${niceDate(data.tomorrow)}`} tone="primary" testId="text-predicted" />
        <Stat label="Stock value at risk" value={rm(s.riskValue)} note={`${data.risks.filter(r => r.level !== 'low').length} ingredients flagged`} tone="amber" testId="text-risk" />
        <Stat label="Pending decisions" value={String(s.pendingCount)} note="human approval required" tone="ink" testId="text-pending" />
        <Stat label="Approved projection" value={rm(s.estimatedSavings)} note="estimate, not yet realised" tone="jade" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <Panel title="Portions sold, last 14 days" sub="All menu items combined">
          <div className="h-56 min-w-0 w-full">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Bar dataKey="portions" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Stock risks" sub="Highest value first" action={<Link href="/inventory" className="text-xs text-primary font-semibold">Pantry</Link>}>
          {risks.length === 0 ? <EmptyState title="No expiry risks" body="Everything should be used in time." /> : (
            <div className="divide-y">
              {risks.map((r) => (
                <div key={r.ingredientId} className="py-2 flex items-center gap-3" data-testid={`row-risk-${r.ingredientId}`}>
                  <LevelPill level={r.level} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{r.name}</div><div className="text-xs text-muted-foreground truncate">{r.message}</div></div>
                  <div className="text-right num text-xs"><div className="font-semibold">{rm(r.value)}</div><div className="text-muted-foreground">{r.daysLeft}d left</div></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <AutomationSummary data={data} />

      <div id="result-checks" className="scroll-mt-16">
      <Panel title="Result checks" sub="Outstanding follow-ups, soonest first. Completed and cancelled checks live in Activity." action={<Link href="/activity" className="text-xs text-primary font-semibold">History</Link>}>
        <FollowUpList data={data} />
      </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <Panel title="Waiting for your call" sub="Top pending recommendations" action={<Link href="/recommendations" className="text-xs text-primary font-semibold">All</Link>}>
          {pending.length === 0 ? <EmptyState title="All decided" body="Every recommendation has a human decision." /> : (
            <div className="space-y-3">{pending.slice(0, 3).map((r) => <RecCard key={r.id} rec={r} compact />)}</div>
          )}
        </Panel>
        <Panel title="Incoming deliveries">
          {deliveries.length === 0 ? <EmptyState title="No deliveries booked" body="Add delivery details in the pantry." /> : (
            <div className="space-y-2">
              {deliveries.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                  <Truck className="w-4 h-4 text-jade" />
                  <div className="flex-1 min-w-0 text-sm font-medium">{i.name}</div>
                  <div className="num text-xs">{fmt(i.deliveryQuantity)} {i.unit}</div>
                  <div className="num text-xs text-muted-foreground shrink-0 text-right">{niceDate(i.deliveryDate)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function AutomationSummary({ data }: { data: GuardState }) {
  const a = data.automation;
  const lastPlan = a.runs.find((r) => r.workflow === 'daily-planning');
  const lastFollow = a.runs.find((r) => r.workflow === 'follow-ups');
  const out = data.followUps.filter((f) => f.status === 'outstanding');
  const due = out.filter((f) => f.scheduledDate.slice(0, 10) === data.today).length;
  const overdue = out.filter((f) => f.scheduledDate.slice(0, 10) < data.today).length;
  const chip = (on: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${on ? 'bg-jade/12 text-jade border-jade/30' : 'bg-muted text-muted-foreground'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-jade' : 'bg-muted-foreground'}`} />{label} {on ? 'on' : 'paused'}
    </span>
  );
  return (
    <section className="rise rounded-2xl border bg-card p-4 flex flex-col md:flex-row md:items-center gap-3" data-testid="panel-automation-summary">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-ink text-primary grid place-items-center shrink-0"><Bot className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">{chip(a.dailyPlanning, 'Daily planning')}{chip(a.followUpHandling, 'Follow-ups')}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {lastPlan ? <>Planned {niceDate(lastPlan.date)}: <span className="num">{fmt(lastPlan.predictedPortions, 0)}</span> portions, <span className="num">{lastPlan.riskCount}</span> risks, <span className="num">{lastPlan.draftCount}</span> drafts. </> : <>No daily planning run yet. </>}
            Result checks: <span className="num">{due}</span> due, <span className="num">{overdue}</span> overdue{lastFollow ? <> (scanned {niceDate(lastFollow.date)})</> : null}.
          </div>
        </div>
      </div>
      <Link href="/automation" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary shrink-0" data-testid="link-automation-summary">Automations <ArrowRight className="w-4 h-4" /></Link>
    </section>
  );
}
