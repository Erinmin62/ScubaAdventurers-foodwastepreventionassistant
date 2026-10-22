import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, RecCard, Stat } from '@/components/bits';
import { impactNumbers } from '@/components/money';
import { rm, useGuard } from '@/lib/guard';
import { cn } from '@/lib/utils';
import { FocusBanner, useFocusItem, useScrollHighlight } from '@/components/focus-target';

const types = [
  { k: 'all', l: 'All' }, { k: 'use-first', l: 'Use first' }, { k: 'purchase', l: 'Purchase' }, { k: 'preparation', l: 'Prep plan' },
];
const statuses = ['pending', 'approved', 'edited', 'rejected', 'all'];

export default function Recommendations() {
  const { data, isLoading, error, refetch } = useGuard();
  const [t, setT] = useState('all');
  const [s, setS] = useState('pending');
  const focus = useFocusItem();
  useScrollHighlight(focus ? 'focus-target' : null, !!data);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const activeMenuIds = new Set(data.menu.filter((m) => m.archivedAt === null).map((m) => m.id));
  const availableRecommendations = data.recommendations.filter((r) => r.type !== 'preparation' || activeMenuIds.has(r.targetId));
  const list = availableRecommendations.filter((r) => (t === 'all' || r.type === t) && (s === 'all' || r.status === s));
  const count = (st: string) => availableRecommendations.filter((r) => (t === 'all' || r.type === t) && (st === 'all' || r.status === st)).length;
  const impact = impactNumbers(data);

  return (
    <div className="space-y-5">
      <PageHeader kicker="Decisions" title="You decide. Yuzu suggests.">
        Purchasing suggestions are never sent to suppliers — approving records your intent only. Edit any amount before approving, or reject.
      </PageHeader>
      {focus && (() => { const f = availableRecommendations.find((r) => r.id === focus); return (
        <div id="focus-target" className="scroll-mt-24"><FocusBanner found={!!f} clearHref="/recommendations" label={f ? `${f.title} (${f.status})` : ''}>
          {f && <div className="max-w-2xl"><RecCard rec={f} /></div>}
        </FocusBanner></div>); })()}
      <div className="grid sm:grid-cols-2 gap-3">
        <Stat label="Potential purchasing reduction" value={rm(impact.pendingPotential)} note="All pending purchase suggestions · estimate, not yet realised" tone="jade" testId="text-decisions-potential" />
        <Stat label="Approved purchasing projection" value={rm(impact.approvedProjection)} note="Already approved changes · estimate, not cash saved" tone="ink" testId="text-decisions-approved" />
      </div>
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-1 rounded-full bg-muted p-1">{types.map((x) => (
          <button key={x.k} onClick={() => setT(x.k)} className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-all', t === x.k ? 'bg-card shadow-sm' : 'text-muted-foreground')} data-testid={`button-type-${x.k}`}>{x.l}</button>
        ))}</div>
        <div className="flex gap-1 flex-wrap">{statuses.map((x) => (
          <button key={x} onClick={() => setS(x)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors', s === x ? 'bg-ink text-background border-ink' : 'hover:bg-muted')} data-testid={`button-status-${x}`}>{x} <span className="num opacity-70">{count(x)}</span></button>
        ))}</div>
      </div>
      <Panel title={`${list.length} recommendation${list.length === 1 ? '' : 's'}`} sub="Each saving below is an estimate for that decision. Review the amount before approving.">
        {list.length === 0 ? <EmptyState title={s === 'pending' ? 'Inbox zero' : 'Nothing here'} body="No recommendations match these filters." /> : (
          <div className="grid lg:grid-cols-2 gap-3">{list.map((r) => <RecCard key={r.id} rec={r} />)}</div>
        )}
      </Panel>
    </div>
  );
}
