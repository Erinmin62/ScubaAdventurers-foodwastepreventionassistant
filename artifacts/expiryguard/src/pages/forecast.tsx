import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, RecCard, Stat } from '@/components/bits';
import { AiForecastDemo } from '@/components/ai-forecast-demo';
import { ForecastAccuracy } from '@/components/forecast-accuracy';
import { fmt, niceDate, useGuard } from '@/lib/guard';
import { cn } from '@/lib/utils';

export default function Forecast() {
  const { data, isLoading, error, refetch } = useGuard();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const activeIds = new Set(data.menu.filter((m) => m.archivedAt === null).map((m) => m.id));
  const forecasts = data.forecasts.filter((f) => activeIds.has(f.menuId));
  const preps = data.recommendations.filter((r) => r.type === 'preparation' && activeIds.has(r.targetId));
  const approved = preps.filter((r) => r.status === 'approved' || r.status === 'edited');
  const hasRecentOwnerSales = forecasts.some((forecast) => forecast.confidence !== 'No sales history');
  const awaitingOwnerSales = data.workspaceMode === 'owner_data' && !hasRecentOwnerSales;
  const max = Math.max(1, ...forecasts.map((f) => Math.max(f.predicted, f.capacity, f.suggested)));

  return (
    <div className="space-y-5">
      <PageHeader kicker={`Planning ${niceDate(data.tomorrow)}`} title="What tomorrow will ask for.">
        {data.synthetic
          ? "Demo demand uses the last 7 days' sample average adjusted by a weekday factor."
          : "Demand uses only sales recorded in this workspace, averaged over the last 7 days and adjusted by a weekday factor."}
        {' '}Capacity is limited by non-expired stock, with shared ingredients allocated across dishes.
      </PageHeader>
      {awaitingOwnerSales && (
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm" role="note" data-testid="notice-forecast-needs-sales">
          <b>{data.sales.length === 0 ? 'No actual sales history yet.' : 'No recent sales in the forecast window.'}</b>{' '}
          Add your menu and pantry, then record daily sales. The app will not display a demand estimate until recent sales are available.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Predicted portions" value={awaitingOwnerSales ? '—' : fmt(forecasts.reduce((sum, f) => sum + f.predicted, 0), 0)} note={awaitingOwnerSales ? 'waiting for actual sales' : undefined} tone="primary" />
        <Stat label="Suggested prep" value={awaitingOwnerSales ? '—' : fmt(forecasts.reduce((a, f) => a + f.suggested, 0), 0)} note={awaitingOwnerSales ? 'waiting for actual sales' : undefined} tone="ink" />
        <Stat label="Prep plans approved" value={`${approved.length} / ${preps.length}`} tone="jade" />
        <Stat label="Capacity-limited" value={String(forecasts.filter((f) => f.capacity < f.predicted).length)} note="dishes short on stock" tone="amber" />
      </div>
      <Panel title="Demand by dish" sub="Bar = predicted, marker = stock capacity, number = suggested prep">
        {awaitingOwnerSales
          ? <EmptyState title="Forecast unavailable" body="These menu items are not yet a demand forecast. Record actual daily sales to build a history." />
          : forecasts.length === 0 ? <EmptyState title="No active dishes to forecast" body="Add or restore a dish in Menu to include it in future demand and preparation plans." /> : (
          <div className="space-y-4">
            {forecasts.map((f) => {
              const rec = preps.find((r) => r.targetId === f.menuId);
              const plan = rec && (rec.status === 'approved' || rec.status === 'edited') ? rec.approvedQuantity ?? rec.suggested : null;
              return (
                <div key={f.menuId} className="grid md:grid-cols-[200px_1fr_140px] gap-3 items-center" data-testid={`row-forecast-${f.menuId}`}>
                  <div><div className="font-semibold">{f.name}</div><span className={cn('text-[10px] uppercase tracking-wider font-bold', f.confidence.toLowerCase() === 'high' ? 'text-jade' : f.confidence.toLowerCase() === 'low' ? 'text-destructive' : 'text-amber')}>{f.confidence === 'No sales history' ? f.confidence : `${f.confidence} confidence`}</span></div>
                  <div>
                    <div className="relative h-3 rounded-full bg-muted">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-primary/80 origin-left rise" style={{ width: `${(f.predicted / max) * 100}%` }} />
                      <div className="absolute -top-1 -bottom-1 w-0.5 bg-ink" style={{ left: `${Math.min(100, (f.capacity / max) * 100)}%` }} title="capacity" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">{f.reason}</div>
                  </div>
                  <div className="text-right num text-xs">
                    <div><span className="text-muted-foreground">pred</span> {fmt(f.predicted)} · <span className="text-muted-foreground">cap</span> {fmt(f.capacity, 0)}</div>
                    <div className="text-lg font-semibold">{fmt(f.suggested, 0)} <span className="text-xs text-muted-foreground">prep</span></div>
                    {plan !== null && <div className="text-jade font-semibold">approved {fmt(plan, 0)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <ForecastAccuracy state={data} />
      <Panel title="Preparation plan" sub="Approve, edit the portion count, or reject. Plans only become final with your decision.">
        {awaitingOwnerSales
          ? <EmptyState title="No prep plans yet" body="Preparation recommendations will be created after you record actual sales." />
          : preps.length === 0 ? <EmptyState title="No prep plans" body="Recommendations appear once a forecast exists." /> : (
          <div className="grid md:grid-cols-2 gap-3">{preps.map((r) => <RecCard key={r.id} rec={r} />)}</div>
        )}
      </Panel>
      <AiForecastDemo ownerDataMode={data.workspaceMode === 'owner_data'} today={data.today} />
    </div>
  );
}
