import { useState } from 'react';
import type { GuardState } from '@workspace/api-client-react';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { Panel } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { evaluateForecastHistory, type ForecastEvaluation } from '@/lib/forecast-evaluation';
import { niceDate } from '@/lib/guard';

function percent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function count(value: number) {
  return value.toLocaleString('en-MY', { maximumFractionDigits: 1 });
}

function MetricLine({
  label,
  metric,
}: {
  label: string;
  metric: ForecastEvaluation['sales']['rules'];
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-right font-semibold">
        MAE {count(metric.mae)} · WAPE {percent(metric.wape)} · n={metric.observations}
      </span>
    </div>
  );
}

function ScoreCard({
  title,
  unit,
  rules,
  priorWeek,
}: {
  title: string;
  unit: string;
  rules: ForecastEvaluation['sales']['rules'];
  priorWeek: ForecastEvaluation['sales']['priorWeek'];
}) {
  return (
    <section className="rounded-xl border border-border bg-background/75 p-3">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">Errors in {unit}; lower is better</p>
      <MetricLine label="Live seven-day rule" metric={rules} />
      <MetricLine label="Same weekday, prior week" metric={priorWeek} />
      {rules.observations === 0 && (
        <p className="pt-2 text-xs text-amber">Not enough complete dates to score this measure.</p>
      )}
    </section>
  );
}

export function ForecastAccuracy({ state }: { state: Pick<GuardState, 'sales' | 'results' | 'menu' | 'synthetic'> }) {
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [approved, setApproved] = useState(false);
  const evaluation = state.synthetic || approved ? evaluateForecastHistory(state) : null;
  const hasResults = (evaluation?.heldOutDays ?? 0) > 0;

  return (
    <Panel
      title="Forecast check"
      sub="A rolling backtest holds out the latest complete dates and compares the live rule with a prior-week benchmark."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/5 p-3 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <p>
            {state.synthetic
              ? <><b>Sample-history check only.</b> This workspace contains synthetic sample records. These scores do not establish accuracy for a food business and do not evaluate the experimental AI forecast.</>
              : approved
                ? <><b>Owner-approved local check.</b> This backtest uses sales and preparation records in this workspace. Records are not sent to AI.</>
                : <><b>Approval required.</b> Review the statement below before scoring these owner-entered records. Records stay in this workspace.</>}
          </p>
        </div>

        {!state.synthetic && !approved ? (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
              <Checkbox
                checked={approvalChecked}
                onCheckedChange={(checked) => setApprovalChecked(checked === true)}
                aria-label="Approve local evaluation of workspace records"
                data-testid="checkbox-approve-forecast-evaluation"
              />
              <span>I approve using the sales and preparation records in this workspace for this local historical check. The records will not be sent to an AI service.</span>
            </label>
            <Button disabled={!approvalChecked} onClick={() => setApproved(true)} data-testid="button-run-forecast-evaluation">
              Run local history check
            </Button>
          </div>
        ) : hasResults && evaluation ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Held-out period: <b className="text-foreground">{niceDate(evaluation.testedFrom!)} – {niceDate(evaluation.testedThrough!)}</b>
              </span>
              <span>{evaluation.heldOutDays} held-out days · rolling one-day-ahead checks</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ScoreCard title="Sales" unit="portions per dish-day" rules={evaluation.sales.rules} priorWeek={evaluation.sales.priorWeek} />
              <ScoreCard title="Waste proxy" unit="leftover portions per dish-day" rules={evaluation.waste.rules} priorWeek={evaluation.waste.priorWeek} />
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Not enough complete daily sales and preparation history is available for a held-out comparison yet. Add complete records for a training window and later test dates.</p>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          MAE is the average number of portions the prediction missed by. WAPE is total absolute error as a share of
          actual portions; it is unavailable when actual totals are zero. Waste uses recorded leftovers as a proxy,
          not discarded ingredient weight or cost. Results cover only the dates shown, can be affected by menu or
          recording changes, and do not validate AI output, stock decisions, ordering, or food safety.
        </p>
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-semibold">
          AI-generated forecasts and order ideas remain experimental and are not enabled for live recommendations.
        </div>
      </div>
    </Panel>
  );
}
