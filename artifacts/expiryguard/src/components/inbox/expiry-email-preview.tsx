import { getGetEmailPreviewQueryKey, useGetEmailPreview, type ExpiryEmailPreviewItem } from '@workspace/api-client-react';
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function PreviewGroup({
  title,
  description,
  items,
  tone,
  synthetic,
}: {
  title: string;
  description: string;
  items: ExpiryEmailPreviewItem[];
  tone: 'urgent' | 'digest';
  synthetic: boolean;
}) {
  const frame = tone === 'urgent'
    ? 'border-destructive/25 bg-destructive/[0.035]'
    : 'border-amber/35 bg-amber/[0.06]';

  return (
    <section className={`rounded-xl border p-4 ${frame}`} data-testid={`panel-email-preview-${tone}`}>
      <div className="flex items-start gap-3">
        {tone === 'urgent'
          ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          : <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(32_80%_32%)]" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold" data-testid={`text-email-preview-title-${tone}`}>{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="num shrink-0 rounded-full border bg-background px-2 py-1 text-xs font-semibold" data-testid={`count-email-preview-${tone}`}>
          {items.length} {items.length === 1 ? 'email' : 'emails'}
        </span>
      </div>
      {items.length === 0
        ? <p className="mt-4 text-sm text-muted-foreground" data-testid={`empty-email-preview-${tone}`}>No matching expiry items right now.</p>
        : <ul className="mt-4 divide-y divide-ink/10">
          {items.map((item, index) => (
            <li key={`${item.kind}-${index}`} className="py-4 first:pt-0 last:pb-0" data-testid={`email-preview-message-${tone}-${index}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="min-w-0 flex-1 break-words text-sm font-bold" data-testid={`text-email-preview-subject-${tone}-${index}`}>{item.subject}</h4>
                {synthetic && <span className="rounded-full border border-amber/40 bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[hsl(32_80%_32%)]" data-testid={`badge-email-preview-synthetic-${tone}-${index}`}>Synthetic sample</span>}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.itemCount} expiry {item.itemCount === 1 ? 'item' : 'items'}</p>
              <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground" data-testid={`text-email-preview-body-${tone}-${index}`}>{item.text}</pre>
            </li>
          ))}
        </ul>}
    </section>
  );
}

export function ExpiryEmailPreview() {
  const { data, isLoading, error, refetch, isFetching } = useGetEmailPreview({
    query: { queryKey: getGetEmailPreviewQueryKey(), staleTime: 0 },
  });

  return (
    <section className="rounded-2xl border-2 border-ink/15 bg-card p-4 md:p-5" data-testid="panel-expiry-email-preview">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Read-only preview</p>
          <h2 className="mt-1 text-lg font-bold">Expiry email preview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check the workspace and message content before any recurring email is enabled. This preview never sends email or creates notification records.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-11 shrink-0 sm:h-9"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh expiry email preview"
          data-testid="button-refresh-email-preview"
        >
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {isLoading ? <Skeleton className="mt-4 h-28 rounded-xl" data-testid="state-email-preview-loading" />
        : error || !data ? <p className="mt-4 text-sm text-destructive" role="alert" data-testid="status-email-preview-error">Could not load this workspace's email preview. Refresh to try again.</p>
        : <>
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4" data-testid="panel-email-preview-workspace">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target workspace</p>
            <p className="mt-1 font-bold" data-testid="text-email-preview-workspace">{data.workspaceName} · Your signed-in workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">Preview generated {new Date(data.generatedAt).toLocaleString()} ({data.timeZone.replace('_', ' ')}).</p>
            {data.synthetic && <p className="mt-3 rounded-lg border border-amber/40 bg-amber/15 px-3 py-2 text-sm text-[hsl(32_80%_32%)]" role="note" data-testid="warning-email-preview-synthetic">
              This workspace contains synthetic sample stock. Each listed message is labelled as a synthetic sample; verify the records before enabling email.
            </p>}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <PreviewGroup
              title="Urgent expiry alerts"
              description="Critical items expiring today, already expired, or within 24 hours."
              items={data.urgentAlerts}
              tone="urgent"
              synthetic={data.synthetic}
            />
            <PreviewGroup
              title="2–3 day expiry digest"
              description="One daily digest for stock with expiry dates two or three calendar days away."
              items={data.digest}
              tone="digest"
              synthetic={data.synthetic}
            />
          </div>
        </>}
    </section>
  );
}
