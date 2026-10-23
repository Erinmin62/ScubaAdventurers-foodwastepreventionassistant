import { useState } from 'react';
import { useSearch } from 'wouter';
import { BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import type { InboxNotification } from '@workspace/api-client-react';
import { EmptyState, ErrorState } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/guard';
import { isActive, isActiveCritical, isUnread, sortInbox, summaryParts, useInbox, useInboxActions, when } from '@/lib/inbox';
import { cn } from '@/lib/utils';
import { InboxRow } from './inbox-row';
import { ThresholdForm } from './threshold-form';

const filters = [
  ['all', 'All'], ['unread', 'Unread'], ['critical', 'Critical'], ['expiry', 'Expiry'], ['approval', 'Pending approval'], ['failures', 'Failures'],
] as const;
type F = typeof filters[number][0];
const test: Record<F, (n: InboxNotification) => boolean> = {
  all: () => true,
  unread: isUnread,
  critical: isActiveCritical,
  expiry: (n) => n.kind === 'expiry' && isActive(n),
  approval: (n) => n.kind === 'approvals' && isActive(n),
  failures: (n) => n.kind === 'failures' && isActive(n),
};

function filterHeading(filter: F) {
  switch (filter) {
    case 'all': return 'All notifications';
    case 'unread': return 'Unread notifications';
    case 'critical': return 'Critical expiry risks';
    case 'expiry': return 'Expiry notifications';
    case 'approval': return 'Pending approval';
    case 'failures': return 'Failures';
  }
}

export function InboxCentre() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get('filter') as F | null;
  const [f, setF] = useState<F>(initial && initial in test ? initial : 'all');
  const [showResolved, setShowResolved] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useInbox();
  const { update } = useInboxActions();
  const { toast } = useToast();

  const list = data ? sortInbox(data.items.filter((n) => !n.dismissedAt && test[f](n) && (f !== 'all' || showResolved || !n.resolvedAt))) : [];
  const activeList = list.filter(isActive);
  const visibleCounts = {
    critical: new Set(activeList.filter((n) => n.kind === 'expiry' && n.severity === 'critical').map((n) => n.relatedId)).size,
    approaching: new Set(activeList.filter((n) => n.kind === 'expiry' && n.severity !== 'critical').map((n) => n.relatedId)).size,
    pendingApproval: activeList.filter((n) => n.kind === 'approvals').length,
    failed: activeList.filter((n) => n.kind === 'failures').length,
  };
  const visibleSummary = summaryParts(visibleCounts).join(' · ');

  const readAll = () => update.mutate({ data: { action: 'read-all' } }, {
    onSuccess: () => toast({ title: 'All notifications marked read' }),
    onError: (e) => toast({ title: 'Could not mark all read', description: errorMessage(e), variant: 'destructive' }),
  });

  return (
    <section className="rise rounded-2xl border-2 border-ink/15 bg-card p-4 md:p-5 space-y-4" data-testid="panel-inbox">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-ink text-primary grid place-items-center shrink-0"><BellRing className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-primary">In-app notification centre</div>
          <h2 className="text-lg font-bold">
            {data ? (
              <>
                <span data-testid="text-inbox-filter-summary">{filterHeading(f)}</span>
                <span className="num ml-2 text-sm font-semibold text-muted-foreground" data-testid="text-inbox-filter-count">({list.length})</span>
              </>
            ) : 'Your notifications'}
          </h2>
          {data && (
            <p className="text-xs text-muted-foreground" data-testid="text-inbox-filter-details">
              {visibleSummary || (list.length ? 'No urgent items in this view.' : 'No notifications in this view.')} Checked {when(data.checkedAt)}.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-11 sm:h-9" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-inbox" aria-label="Refresh notifications"><RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} /></Button>
          <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={readAll} disabled={!data || data.unreadCount === 0 || update.isPending} data-testid="button-read-all"><CheckCheck className="w-4 h-4 mr-1" />Mark all read</Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Filter notifications">
        {filters.map(([k, l]) => {
          const n = data ? data.items.filter((x) => !x.dismissedAt && test[k](x) && (k !== 'all' || !x.resolvedAt)).length : null;
          return (
            <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)} data-testid={`filter-${k}`}
              className={cn('shrink-0 min-h-11 sm:min-h-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors', f === k ? 'bg-ink text-background border-ink' : 'hover:bg-muted')}>
              {l}{n !== null && <span className="num opacity-70 ml-1">{n}</span>}
            </button>
          );
        })}
        {f === 'all' && <label className="shrink-0 ml-auto min-h-11 sm:min-h-0 flex items-center gap-1.5 text-xs text-muted-foreground px-2"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} data-testid="checkbox-show-resolved" />Show resolved</label>}
      </div>

      {isLoading ? (
        <div className="space-y-2" data-testid="state-inbox-loading">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title={f === 'all' ? 'All clear' : 'Nothing in this view'} body={f === 'unread' ? 'You have read everything.' : 'No notifications match this filter.'} />
      ) : (
        <div className="space-y-2 max-h-[720px] overflow-auto -mx-1 px-1" aria-live="polite">{list.map((n) => <InboxRow key={n.id} n={n} />)}</div>
      )}

      {data && <ThresholdForm value={data.thresholds} />}
    </section>
  );
}
