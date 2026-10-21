import { Link } from 'wouter';
import { BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInbox } from '@/lib/inbox';

export function NotificationBell({ className }: { className?: string }) {
  const { data, isError } = useInbox();
  const unread = data?.unreadCount;
  const critical = data?.counts.critical ?? 0;
  const label = data ? `Notifications, ${unread} unread${critical ? `, ${critical} critical` : ''}` : isError ? 'Notifications, count unavailable' : 'Notifications, loading';
  return (
    <Link href="/notifications" aria-label={label} title={label} data-testid="button-bell"
      className={cn('relative inline-flex items-center gap-2 rounded-full border px-3 py-1 min-h-11 sm:min-h-0 text-xs font-bold transition-colors',
        critical ? 'border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15' : 'border-ink/20 bg-card hover:bg-muted', className)}>
      <BellRing className={cn('w-4 h-4', critical > 0 && 'ring-bell')} aria-hidden />
      <span className="hidden sm:inline">Notifications</span>
      {data && unread! > 0 && (
        <span className={cn('num min-w-5 h-5 rounded-full px-1.5 grid place-items-center text-[11px]', critical ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')} data-testid="text-unread-count" aria-hidden>
          {unread! > 99 ? '99+' : unread}
        </span>
      )}
      {isError && !data && <span className="text-[10px] text-muted-foreground" aria-hidden>?</span>}
    </Link>
  );
}
