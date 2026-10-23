import { getGetEmailHistoryQueryKey, useGetEmailHistory, type EmailHistoryRecord } from '@workspace/api-client-react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const attempts: Record<EmailHistoryRecord['attemptStatus'], string> = {
  queued: 'Queued — no attempt yet',
  sending: 'Attempt in progress — acceptance not confirmed',
  accepted: 'Accepted by Resend — not proof of inbox delivery',
  failed: 'Request failed — no automatic retry',
  uncertain: 'Acceptance unknown — provider review required; no automatic retry',
  cancelled: 'Cancelled before sending',
};
const delivery: Record<EmailHistoryRecord['deliveryStatus'], string> = {
  unconfirmed: 'No verified delivery update',
  'email.sent': 'Sending — delivery not confirmed',
  'email.delivery_delayed': 'Delivery delayed',
  'email.delivered': 'Delivered to recipient mail server — inbox placement not guaranteed',
  'email.failed': 'Provider reports sending failed',
  'email.bounced': 'Bounced — recipient mail server rejected the email',
  'email.complained': 'Recipient reported spam',
};
const date = (value: string) => new Date(value).toLocaleString();

export function EmailHistory() {
  const { data, isLoading, error, refetch, isFetching } = useGetEmailHistory({
    query: { queryKey: getGetEmailHistoryQueryKey(), refetchInterval: 30_000, refetchIntervalInBackground: false, staleTime: 0 },
  });
  return (
    <section className="rounded-2xl border-2 border-ink/15 bg-card p-4 md:p-5" data-testid="panel-email-history">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Email history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Latest 50 email notifications for your workspace. API acceptance and verified delivery are shown separately. This history does not enable email or send anything.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh email history">
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>
      {isLoading ? <p className="mt-4 text-sm" role="status">Loading email history…</p>
        : error ? <p className="mt-4 text-sm text-destructive" role="alert">Could not load email history. Please refresh to try again.</p>
        : !data?.records.length ? <p className="mt-4 text-sm text-muted-foreground">No email notifications recorded. Real email sending requires separate opt-in setup.</p>
        : <ul className="mt-4 divide-y divide-ink/10">
          {data.records.map(record => (
            <li key={record.id} className="py-4 space-y-1 text-sm" data-testid="email-history-record">
              <h3 className="font-bold break-words">{record.subject}</h3>
              <p className="text-xs text-muted-foreground">Recorded: {date(record.observedAt)}</p>
              <p><strong>Attempt:</strong> {attempts[record.attemptStatus]}</p>
              {record.attemptedAt && <p className="text-xs text-muted-foreground">Attempted: {date(record.attemptedAt)}</p>}
              {record.acceptedAt && <p className="text-xs text-muted-foreground">Accepted: {date(record.acceptedAt)}</p>}
              <p><strong>Delivery:</strong> {delivery[record.deliveryStatus]}</p>
              {record.deliveryUpdatedAt && <p className="text-xs text-muted-foreground">Verified event: {date(record.deliveryUpdatedAt)}</p>}
            </li>
          ))}
        </ul>}
    </section>
  );
}
