import { Link } from 'wouter';
import { ArrowRight, CalendarCheck, Clock, Play, ShieldCheck, Sunrise } from 'lucide-react';
import type { AutomationRun, GuardState } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { errorMessage, fmt, niceDate, useGuard, useGuardMutations } from '@/lib/guard';

type Wf = 'daily-planning' | 'follow-ups';
const names: Record<Wf, string> = { 'daily-planning': 'Daily planning', 'follow-ups': 'Follow-up handling' };

const flows: Record<Wf, { icon: typeof Sunrise; blurb: string; steps: string[]; links: { href: string; label: string }[] }> = {
  'daily-planning': {
    icon: Sunrise,
    blurb: 'Does the morning arithmetic so you start with a plan, not a spreadsheet.',
    steps: [
      'Forecast tomorrow\'s portions from recent till data',
      'Scan every expiry label and value stock at risk',
      'Save a daily review snapshot of those counts to the run history',
      'Leave recommendation drafts in Decisions for you to approve, edit or reject',
    ],
    links: [{ href: '/forecast', label: 'Tomorrow' }, { href: '/recommendations', label: 'Decisions' }],
  },
  'follow-ups': {
    icon: CalendarCheck,
    blurb: 'Remembers to check whether approved changes actually worked.',
    steps: [
      'Auto-schedule a result check after each new approval (2 days by default, 1 day optional)',
      'Surface due and overdue checks on Today and in the Ledger (no email)',
      'Evaluate outcomes automatically once you submit an observation',
    ],
    links: [{ href: '/#result-checks', label: 'Result checks' }, { href: '/activity', label: 'Ledger' }],
  },
};

const when = (r: AutomationRun) => {
  const t = new Date(r.time);
  return isNaN(t.getTime()) ? niceDate(r.date) : `${niceDate(r.date)} · ${t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}`;
};

function Counts({ run }: { run: AutomationRun }) {
  const items = run.workflow === 'daily-planning'
    ? [['Portions', fmt(run.predictedPortions, 0)], ['Risks', String(run.riskCount)], ['Drafts', String(run.draftCount)]]
    : [['Due', String(run.dueCount)], ['Overdue', String(run.overdueCount)]];
  return (
    <div className="flex gap-4">
      {items.map(([k, v]) => (
        <div key={k}><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div><div className="num font-semibold">{v}</div></div>
      ))}
    </div>
  );
}

function WorkflowCard({ wf, data }: { wf: Wf; data: GuardState }) {
  const { updateAutomation, runAutomation } = useGuardMutations();
  const { toast } = useToast();
  const f = flows[wf];
  const Icon = f.icon;
  const key = wf === 'daily-planning' ? 'dailyPlanning' : 'followUpHandling';
  const on = data.automation[key];
  const last = data.automation.runs.find((r) => r.workflow === wf);
  const saving = updateAutomation.isPending;
  const running = runAutomation.isPending;

  const toggle = (v: boolean) => updateAutomation.mutate({ data: { [key]: v } }, {
    onSuccess: () => toast({ title: `${names[wf]} ${v ? 'enabled' : 'paused'}` }),
    onError: (e) => toast({ title: 'Setting not saved', description: errorMessage(e), variant: 'destructive' }),
  });
  const run = () => runAutomation.mutate({ data: { workflow: wf } }, {
    onSuccess: () => toast({ title: `${names[wf]} ran`, description: 'See the latest run below.' }),
    onError: (e) => toast({ title: 'Run failed', description: errorMessage(e), variant: 'destructive' }),
  });

  return (
    <section className={cn('rise rounded-2xl border bg-card p-5 shadow-sm flex flex-col', !on && 'bg-muted/40')} data-testid={`card-workflow-${wf}`}>
      <div className="flex items-start gap-3">
        <div className={cn('w-11 h-11 rounded-xl grid place-items-center shrink-0', on ? 'bg-ink text-primary' : 'bg-muted text-muted-foreground')}><Icon className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold">{names[wf]}</h2>
          <p className="text-xs text-muted-foreground">{f.blurb}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider', on ? 'text-jade' : 'text-muted-foreground')} data-testid={`status-${wf}`}>{saving ? 'Saving' : on ? 'On' : 'Paused'}</span>
          <Switch checked={on} disabled={saving} onCheckedChange={toggle} data-testid={`switch-${wf}`} aria-label={`Toggle ${names[wf]}`} />
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {f.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="num w-5 h-5 shrink-0 rounded-full border text-[10px] grid place-items-center font-semibold">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {wf === 'follow-ups' && !on && (
        <p className="mt-3 text-xs rounded-lg border border-dashed px-3 py-2 text-muted-foreground">New approvals will not get a check automatically. Existing checks stay, and you can still add one by hand after approving.</p>
      )}
      {wf === 'daily-planning' && !on && (
        <p className="mt-3 text-xs rounded-lg border border-dashed px-3 py-2 text-muted-foreground">Only the daily snapshot is paused. Expiry safety checks and live drafts in Decisions keep working.</p>
      )}

      <div className="mt-4 rounded-xl bg-background/70 border p-3" data-testid={`latest-${wf}`}>
        <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">Latest run</div>
        {last ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground num">{when(last)} · {last.trigger}</div>
            <div className="text-sm">{last.detail}</div>
            <Counts run={last} />
          </div>
        ) : <div className="text-sm text-muted-foreground">Has not run yet.</div>}
      </div>

      <div className="mt-4 pt-1 flex flex-wrap items-center gap-2 mt-auto">
        <Button size="sm" disabled={!on || running} onClick={run} data-testid={`button-run-${wf}`}><Play className="w-4 h-4 mr-1" />{running ? 'Running...' : 'Run now'}</Button>
        {!on && <span className="text-xs text-muted-foreground">Enable first to run.</span>}
        <div className="ml-auto flex gap-3">
          {f.links.map((l) => <Link key={l.href} href={l.href} className="text-xs font-semibold text-primary inline-flex items-center gap-1" data-testid={`link-${wf}-${l.label.toLowerCase().replace(' ', '-')}`}>{l.label}<ArrowRight className="w-3 h-3" /></Link>)}
        </div>
      </div>
    </section>
  );
}

export default function Automation() {
  const { data, isLoading, error, refetch } = useGuard();
  const { runAutomation } = useGuardMutations();
  const { toast } = useToast();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const a = data.automation;
  const anyOn = a.dailyPlanning || a.followUpHandling;
  const runAll = () => runAutomation.mutate({ data: { workflow: 'all' } }, {
    onSuccess: () => toast({ title: 'Enabled workflows ran' }),
    onError: (e) => toast({ title: 'Run failed', description: errorMessage(e), variant: 'destructive' }),
  });

  return (
    <div className="space-y-5">
      <PageHeader kicker="Routine, handled" title="Automations"
        aside={<Button disabled={!anyOn || runAutomation.isPending} onClick={runAll} data-testid="button-run-all"><Play className="w-4 h-4 mr-1" />{runAutomation.isPending ? 'Running...' : anyOn ? 'Run enabled workflows' : 'Enable a workflow first'}</Button>}>
        Yuzu takes the daily checks off your list. Decisions stay yours: nothing is ordered, approved or sent anywhere automatically.
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WorkflowCard wf="daily-planning" data={data} />
        <WorkflowCard wf="follow-ups" data={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
        <Panel title="When it runs" sub="Times are Kuala Lumpur (MYT)">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3"><Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>Daily planning runs once per Kuala Lumpur day and includes a reorder scan that drafts plans for owner approval on the Reordering page. Nothing is ordered automatically.</span></li>
            <li className="flex gap-3"><Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>The follow-up scan runs once a day, and again when an outstanding check becomes due.</span></li>
            <li className="flex gap-3"><Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>While the app server is running it checks every minute. If it was stopped, it catches up when the app next opens. It cannot run while the server is off.</span></li>
            <li className="flex gap-3"><ShieldCheck className="w-4 h-4 text-jade shrink-0 mt-0.5" /><span>Expiry safety checks always run, even with automations paused. Outcomes are only evaluated from observations you submit; stock and results are never invented. Older approvals get a check only when you attach one.</span></li>
            <li className="flex gap-3"><ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>Want a nudge when something needs you? <Link href="/notifications" className="font-semibold text-primary" data-testid="link-automation-notifications">Set up WhatsApp notifications (demo)</Link>.</span></li>
          </ul>
        </Panel>
        <Panel title="Run history" sub={`Newest first · last ${a.runs.length} of up to 30`}>
          {a.runs.length === 0 ? <EmptyState title="No runs yet" body="Run an enabled workflow, or wait for the daily schedule." /> : (
            <div className="divide-y max-h-[460px] overflow-auto -mx-1 px-1">
              {a.runs.map((r) => (
                <div key={r.id} className="py-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center" data-testid={`row-run-${r.id}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-primary">{names[r.workflow]}</span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', r.trigger === 'manual' ? 'bg-secondary' : 'bg-jade/12 text-jade border-jade/30')}>{r.trigger}</span>
                      <span className="num text-[11px] text-muted-foreground">{when(r)}</span>
                    </div>
                    <div className="text-sm mt-1">{r.detail}</div>
                  </div>
                  <Counts run={r} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
