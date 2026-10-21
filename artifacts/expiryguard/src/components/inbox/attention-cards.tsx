import { Link } from 'wouter';
import { AlertOctagon, ArrowRight, ClipboardCheck, Hourglass, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useInbox } from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function AttentionCards() {
  const { data, isLoading, error, refetch } = useInbox();
  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  if (error || !data) return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-center gap-3" data-testid="state-attention-error">
      <span className="flex-1">Notifications could not be loaded, so counts are not shown.</span>
      <button onClick={() => refetch()} className="text-xs font-bold text-primary" data-testid="button-retry-attention">Retry</button>
    </div>
  );
  const c = data.counts;
  const cards = [
    { k: 'critical', label: 'Critical expiry', n: c.critical, note: 'Expired or expires today', icon: AlertOctagon, href: '/notifications?filter=critical', cta: 'See critical', tone: 'border-destructive/40 bg-destructive/[0.06] text-destructive' },
    { k: 'approaching', label: 'Approaching expiry', n: c.approaching, note: `Within ${data.thresholds.upcomingDays} days`, icon: Hourglass, href: '/notifications?filter=expiry', cta: 'See expiry', tone: 'border-amber/50 bg-amber/10 text-[hsl(32_80%_32%)]' },
    { k: 'approval', label: 'Pending approval', n: c.pendingApproval, note: 'Needs your decision', icon: ClipboardCheck, href: '/notifications?filter=approval', cta: 'Review', tone: 'border-primary/40 bg-primary/[0.06] text-primary' },
    { k: 'failures', label: 'Failures', n: c.failed, note: 'Steps that did not complete', icon: XCircle, href: '/notifications?filter=failures', cta: 'Details', tone: 'border-ink/20 bg-card text-foreground' },
  ];
  return (
    <section aria-label="Needs attention" className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="panel-attention">
      {cards.map(({ k, label, n, note, icon: Icon, href, cta, tone }) => (
        <Link key={k} href={href} data-testid={`card-attention-${k}`}
          className={cn('rise group rounded-2xl border-2 p-3.5 flex flex-col gap-1 transition-transform hover:-translate-y-0.5', n > 0 ? tone : 'border-border bg-card text-muted-foreground')}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold"><Icon className="w-4 h-4" />{label}</div>
          <div className="num text-3xl font-extrabold text-foreground" data-testid={`text-attention-${k}`}>{n}</div>
          <div className="text-[11px] text-muted-foreground">{n === 0 ? 'All clear' : note}</div>
          <div className="mt-auto inline-flex items-center gap-1 text-xs font-bold">{cta}<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" /></div>
        </Link>
      ))}
    </section>
  );
}
