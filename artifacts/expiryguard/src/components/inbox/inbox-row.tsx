import { useLocation } from 'wouter';
import { ArrowRight, Check, CheckCircle2, EyeOff, Mail, MailOpen } from 'lucide-react';
import type { InboxNotification } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/guard';
import { actionLabel, canDismiss, isUnread, kindLabel, sevInfo, useInboxActions, when } from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function InboxRow({ n }: { n: InboxNotification }) {
  const [, go] = useLocation();
  const { toast } = useToast();
  const { update } = useInboxActions();
  const unread = isUnread(n);
  const sev = sevInfo[n.severity] ?? sevInfo.info;
  const busy = update.isPending;
  const act = (action: 'read' | 'unread' | 'dismiss', msg?: string) => update.mutate({ data: { action, id: n.id } }, {
    onSuccess: () => { if (msg) toast({ title: msg, description: n.title }); },
    onError: (e) => toast({ title: 'Notification not updated', description: errorMessage(e), variant: 'destructive' }),
  });
  const open = () => { if (unread) act('read'); go(n.path); };

  return (
    <article className={cn('relative rounded-xl border pl-4 pr-3 py-3 transition-colors overflow-hidden',
      unread ? 'bg-card shadow-sm border-ink/15' : 'bg-background/50', n.resolvedAt && 'opacity-75')} data-testid={`row-inbox-${n.id}`} aria-label={`${unread ? 'Unread. ' : ''}${sev.label}. ${n.title}`}>
      <span className={cn('absolute left-0 inset-y-0 w-1.5', sev.bar)} aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        {unread && <span className="inline-flex items-center gap-1 rounded-full bg-ink text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" data-testid={`status-unread-${n.id}`}><span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />New</span>}
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', sev.cls)}>{sev.label}</span>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{kindLabel[n.kind] ?? n.kind}</span>
        {n.resolvedAt && <span className="inline-flex items-center gap-1 rounded-full border border-jade/30 bg-jade/10 text-jade px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" />Resolved {when(n.resolvedAt)}</span>}
        <time dateTime={n.updatedAt} className="num text-[11px] text-muted-foreground ml-auto">{when(n.updatedAt)}</time>
      </div>
      <button onClick={open} className="block text-left mt-1.5 w-full group" data-testid={`link-inbox-${n.id}`}>
        <div className={cn('text-sm', unread ? 'font-extrabold' : 'font-medium')}>{n.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{n.description}</div>
      </button>
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <Button size="sm" onClick={open} className="h-11 sm:h-8" data-testid={`button-open-${n.id}`}>{actionLabel[n.kind] ?? 'View details'}<ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
        {!n.resolvedAt && (unread
          ? <Button size="sm" variant="ghost" className="h-11 sm:h-8" disabled={busy} onClick={() => act('read')} data-testid={`button-read-${n.id}`}><MailOpen className="w-3.5 h-3.5 mr-1" />Mark read</Button>
          : <Button size="sm" variant="ghost" className="h-11 sm:h-8" disabled={busy} onClick={() => act('unread')} data-testid={`button-unread-${n.id}`}><Mail className="w-3.5 h-3.5 mr-1" />Mark unread</Button>)}
        {canDismiss(n)
          ? <Button size="sm" variant="ghost" className="h-11 sm:h-8 text-muted-foreground" disabled={busy} onClick={() => act('dismiss', 'Notification dismissed')} data-testid={`button-dismiss-${n.id}`}><EyeOff className="w-3.5 h-3.5 mr-1" />Dismiss</Button>
          : !n.resolvedAt && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Check className="w-3 h-3" />{n.kind === 'approvals' ? 'Stays until you decide' : 'Stays until the risk is resolved'}</span>}
      </div>
    </article>
  );
}
