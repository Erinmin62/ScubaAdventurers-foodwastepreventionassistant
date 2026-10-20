import { useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusPill } from '@/components/bits';
import { Input } from '@/components/ui/input';
import { rm, useGuard } from '@/lib/guard';

export default function Activity() {
  const { data, isLoading, error, refetch } = useGuard();
  const [q, setQ] = useState('');
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const list = [...data.activity].sort((a, b) => b.time.localeCompare(a.time))
    .filter((a) => (a.title + a.detail + a.decision).toLowerCase().includes(q.toLowerCase()));
  const total = data.activity.reduce((s, a) => s + (a.impact || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader kicker="Ledger" title="Every decision, kept.">Permanent record of imports, approvals, edits and rejections. Impact values are synthetic estimates. Total logged impact: <b className="num">{rm(total)}</b>.</PageHeader>
      <Panel>
        <div className="relative mb-4 max-w-sm"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search history" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-search-activity" /></div>
        {list.length === 0 ? <EmptyState title="The ledger is empty" body="Decisions and imports will be written here." /> : (
          <ol className="relative border-l-2 border-dashed border-border ml-2">
            {list.map((a) => (
              <li key={a.id} className="ml-5 pb-5 relative" data-testid={`row-activity-${a.id}`}>
                <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-[11px] text-muted-foreground">{new Date(a.time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {a.decision && <StatusPill status={a.decision} />}
                  {a.impact !== 0 && <span className="num text-xs font-semibold text-jade">{rm(a.impact)}</span>}
                </div>
                <div className="font-semibold mt-0.5">{a.title}</div>
                <div className="text-sm text-muted-foreground">{a.detail}</div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
