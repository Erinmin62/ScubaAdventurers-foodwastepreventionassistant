import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'wouter';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isActiveCritical, summaryParts, useInbox } from '@/lib/inbox';

const KEY = 'expiryguard.inbox.session';
type Seen = { shown: boolean; critical: string[] };
const read = (key: string): Seen | null => { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) as Seen : null; } catch { return null; } };
const write = (key: string, s: Seen) => { try { sessionStorage.setItem(key, JSON.stringify(s)); } catch { /* storage unavailable */ } };

/** Shows once per browser session, and again only when a genuinely new (or escalated) critical notification appears. */
export function SessionSummary() {
  const { userId, sessionId } = useAuth();
  const key = `${KEY}:${userId}:${sessionId}`;
  const { data } = useInbox();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (!data) return;
    const crit = data.items.filter(isActiveCritical);
    // Fingerprint = set of active critical ids only. Text/quantity edits do not re-trigger; new, escalated or reopened ids do.
    const snapshot = crit.map((n) => n.id);
    const seen = read(key);
    if (!seen) {
      const show = data.unreadCount > 0 || crit.length > 0;
      write(key, { shown: show, critical: snapshot });
      if (show) { setOpen(true); setFresh(false); }
      return;
    }
    const prev = new Set(Array.isArray(seen.critical) ? seen.critical : []);
    const isNew = crit.some((n) => !prev.has(n.id));
    if (isNew) { setOpen(true); setFresh(true); }
    write(key, { shown: true, critical: snapshot });
  }, [data, key]);

  if (!open || !data) return null;
  const parts = summaryParts(data.counts);
  const crit = data.counts.critical > 0;
  return (
    <div role="status" className={cn('rise mx-4 md:mx-8 mt-3 rounded-2xl border-2 p-3 md:p-4 flex gap-3 items-start',
      crit ? 'border-destructive/40 bg-destructive/[0.05]' : 'border-primary/40 bg-primary/[0.05]')} data-testid="banner-session-summary">
      <AlertTriangle className={cn('w-5 h-5 shrink-0 mt-0.5', crit ? 'text-destructive' : 'text-primary')} aria-hidden />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-bold" data-testid="text-session-title">
          {fresh ? 'New critical notification. ' : ''}{data.unreadCount} unread notification{data.unreadCount === 1 ? '' : 's'} need{data.unreadCount === 1 ? 's' : ''} your attention
        </div>
        {parts.length > 0 && <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground list-disc pl-4">{parts.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Link href="/notifications" onClick={() => setOpen(false)} className="inline-block mt-2 text-xs font-bold text-primary underline-offset-4 hover:underline" data-testid="link-session-open">Open notification centre</Link>
      </div>
      <button onClick={() => setOpen(false)} aria-label="Dismiss summary" className="rounded-full p-1 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 grid place-items-center hover:bg-muted" data-testid="button-dismiss-summary"><X className="w-4 h-4" /></button>
    </div>
  );
}
