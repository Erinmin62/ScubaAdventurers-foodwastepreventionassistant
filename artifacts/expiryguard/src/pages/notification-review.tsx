import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Eye, KeyRound, ShieldAlert } from 'lucide-react';
import { useReviewNotification } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/bits';
import { errorMessage } from '@/lib/guard';

function readToken(): string {
  const h = window.location.hash.replace(/^#/, '');
  const t = new URLSearchParams(h).get('token') ?? '';
  return t;
}

export default function NotificationReview() {
  const [token] = useState(readToken);
  const review = useReviewNotification();
  const fired = useRef(false);
  const mutateRef = useRef(review.mutate);
  mutateRef.current = review.mutate;

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    if (fired.current || !token) return;
    fired.current = true;
    mutateRef.current({ data: { token } });
  }, [token]);

  const status = (review.error as { status?: number } | null)?.status;
  const r = review.data;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader kicker="Notification link" title="Read-only review">
        This page only shows what a notification said. Opening a link is not owner sign-in and cannot approve, order or change anything.
      </PageHeader>

      {!token && (
        <section className="rise rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5" data-testid="state-no-token">
          <div className="flex gap-3"><KeyRound className="w-5 h-5 text-destructive shrink-0" />
            <div><h2 className="font-bold">No review token in this link</h2>
              <p className="text-sm text-muted-foreground mt-1">Open the full link from the notification history. If you copied it, make sure the part after # was included.</p>
              <Link href="/notifications" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Open notification history<ArrowRight className="w-3 h-3" /></Link>
            </div></div>
        </section>
      )}

      {token && review.isPending && (
        <div className="rounded-2xl border bg-card p-5 space-y-3 animate-pulse" data-testid="state-loading">
          <div className="h-5 w-1/2 rounded bg-muted" /><div className="h-4 w-full rounded bg-muted" /><div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      )}

      {review.isError && (
        <section className="rise rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5" data-testid="state-error">
          <div className="flex gap-3"><ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <h2 className="font-bold">{status === 410 ? 'This link has expired or is no longer valid' : 'Could not open this review'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {status === 410
                  ? 'Review links are short-lived on purpose. Open the app directly to see the current state; nothing was lost.'
                  : errorMessage(review.error)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/notifications" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Notification history<ArrowRight className="w-3 h-3" /></Link>
                <Link href="/recommendations" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Decisions<ArrowRight className="w-3 h-3" /></Link>
              </div>
            </div></div>
        </section>
      )}

      {r && (
        <section className="rise rounded-2xl border bg-card p-5 shadow-sm space-y-4" data-testid="state-review">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-secondary"><Eye className="w-3 h-3" />Read only</span>
            {r.demo && <span className="rounded-full border border-amber/40 bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Demo, not sent</span>}
            <span className="num text-[11px] text-muted-foreground ml-auto">Link expires {r.expiresAt.replace('T', ' ').slice(0, 16)}</span>
          </div>
          <h2 className="text-xl font-bold" data-testid="text-review-title">{r.title}</h2>
          <p className="text-sm whitespace-pre-line" data-testid="text-review-message">{r.message}</p>
          <p className="text-xs rounded-lg border border-dashed px-3 py-2 text-muted-foreground">{r.notice}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild size="sm"><Link href={r.path} data-testid="link-review-path">Open in app to review<ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
            <span className="text-xs text-muted-foreground">Any approval happens there, explicitly, by you.</span>
          </div>
        </section>
      )}
    </div>
  );
}
