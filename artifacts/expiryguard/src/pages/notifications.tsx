import { getGetMonitorHeartbeatStatusQueryKey, useGetMonitorHeartbeatStatus } from '@workspace/api-client-react';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/bits';
import { InboxCentre } from '@/components/inbox/inbox-centre';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const monitorStyles = {
  healthy: {
    title: 'Monitoring is healthy',
    detail: 'The latest expiry and workflow check completed successfully.',
    className: 'border-jade/40 bg-jade/10 text-jade',
    Icon: CheckCircle2,
  },
  stale: {
    title: 'Monitoring check is overdue',
    detail: 'No successful check has been recorded in the last five minutes.',
    className: 'border-amber/40 bg-amber/10 text-[hsl(32_80%_32%)]',
    Icon: Clock3,
  },
  failed: {
    title: 'The latest monitoring check failed',
    detail: 'The last attempt did not complete. The previous successful check is shown below.',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
  'not-started': {
    title: 'No successful check yet',
    detail: 'The monitor has not reported a successful check for this workspace yet.',
    className: 'border-ink/15 bg-muted text-muted-foreground',
    Icon: AlertCircle,
  },
} as const;

function MonitorStatus() {
  const { data, isLoading, error, refetch, isFetching } = useGetMonitorHeartbeatStatus({
    query: {
      queryKey: getGetMonitorHeartbeatStatusQueryKey(),
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });

  if (isLoading) {
    return <Skeleton className="h-28 rounded-2xl" data-testid="state-monitor-loading" />;
  }

  const view = data ? monitorStyles[data.status] : null;
  const checkedAt = data?.lastSuccessfulAt
    ? new Date(data.lastSuccessfulAt).toLocaleString()
    : null;

  return (
    <section
      className={cn('rounded-2xl border-2 p-4 md:p-5', view?.className ?? 'border-destructive/40 bg-destructive/10 text-destructive')}
      aria-live="polite"
      data-testid="panel-monitor-status"
    >
      <div className="flex items-start gap-3">
        {view && <view.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest">Expiry monitor</p>
          <h2 className="mt-1 text-base font-bold">
            {view?.title ?? 'Monitor status unavailable'}
          </h2>
          <p className="mt-1 text-sm">
            {error || !data
              ? 'Could not load monitoring status. Try refreshing; this view does not run checks.'
              : view?.detail}
          </p>
          <p className="mt-2 text-xs">
            Last successful check: <strong>{checkedAt ?? 'None recorded'}</strong>
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-11 shrink-0 sm:h-9"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh monitor status"
          data-testid="button-refresh-monitor"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>
    </section>
  );
}

export default function Notifications() {
  return (
    <div className="space-y-6">
      <PageHeader kicker="What needs your attention" title="Notifications">
        Your alerts update automatically from stock and workflow changes. Review expiry risks and pending actions here; opening a notification never approves an action or places an order.
      </PageHeader>
      <MonitorStatus />
      <InboxCentre />
    </div>
  );
}
