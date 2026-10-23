import { getGetHistoricalRecordsQueryKey, useGenerateAiDemoForecast, useGenerateAiOwnerHistoryForecast, useGetHistoricalRecords } from '@workspace/api-client-react';
import type { AiForecastDemoResponse, AiOwnerHistoryForecastResponse, HistoricalRecord } from '@workspace/api-client-react';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Beaker, CalendarDays, Clock3, FlaskConical, RotateCw, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/guard';

const requiredWarning = 'results are illustrative, the model is not trained on real business-specific data and has not been evaluated against real outcomes; they must not be used for real purchasing or food-safety decisions.';

function dateLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function quantity(value: number) {
  return Number.isFinite(value) ? value.toLocaleString('en-MY', { maximumFractionDigits: 1 }) : '—';
}

function ForecastResult({ result }: { result: AiForecastDemoResponse }) {
  const dayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${result.horizonStart.slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  });
  const maxDaily = Math.max(1, ...result.demandForecasts.flatMap((dish) => dish.predictedPortionsByDay));

  return (
    <div className="space-y-5 border-t border-dashed border-primary/30 pt-5" data-testid="panel-ai-demo-result">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Experimental model output
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Synthetic sample only</span>
          </div>
          <h3 className="mt-3 text-xl font-bold">A separate 7-day scenario</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{result.summary}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-muted/70 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold"><Beaker className="h-3.5 w-3.5 text-primary" /> {result.model}</div>
          <div className="mt-1 text-muted-foreground">Generated {new Date(result.generatedAt).toLocaleString('en-GB')}</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/70 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Sample history</div>
          <div className="mt-1.5 num text-lg font-semibold">{result.historyDays} days</div>
          <div className="text-xs text-muted-foreground">Generated dataset, not workspace sales</div>
        </div>
        <div className="rounded-xl border border-border bg-background/70 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Scenario window</div>
          <div className="mt-1.5 text-sm font-semibold">{dateLabel(result.horizonStart)} – {dateLabel(result.horizonEnd)}</div>
          <div className="text-xs text-muted-foreground">Illustrative horizon only</div>
        </div>
        <div className="rounded-xl border border-border bg-background/70 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><FlaskConical className="h-3.5 w-3.5" /> Not connected to operations</div>
          <div className="mt-1.5 text-sm font-semibold">No stock or plans changed</div>
          <div className="text-xs text-muted-foreground">This result is temporary and not saved</div>
        </div>
      </div>

      <section aria-labelledby="ai-demo-demand-heading">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Model output · synthetic</div>
            <h4 id="ai-demo-demand-heading" className="mt-1 font-display text-lg font-bold">Dish demand by day</h4>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">Portions · seven-day illustration</span>
        </div>
        {result.demandForecasts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No dish demand rows were returned for this demonstration.</p>
        ) : (
          <div className="space-y-2">
            {result.demandForecasts.map((dish) => (
              <article key={dish.menuId} className="rounded-xl border border-border bg-background/80 p-3" data-testid={`row-ai-demo-dish-${dish.menuId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h5 className="font-semibold">{dish.name}</h5>
                  <span className="num text-sm font-bold text-primary">{quantity(dish.totalPredictedPortions)} <span className="text-xs font-medium text-muted-foreground">total portions</span></span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label={`${dish.name} illustrative portions by day`}>
                  {dayLabels.map((day, index) => {
                    const value = dish.predictedPortionsByDay[index] ?? 0;
                    const height = Math.max(4, (value / maxDaily) * 34);
                    return (
                      <div key={`${dish.menuId}-${day}`} className="min-w-0 text-center">
                        <div className="flex h-9 items-end justify-center">
                          <div className="w-full max-w-8 rounded-t bg-primary/70" style={{ height }} />
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{day}</div>
                        <div className="num text-[11px] font-semibold">{quantity(value)}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 border-t border-border/70 pt-2 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Model-provided note, not validation:</span> {dish.explanation}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="ai-demo-waste-heading" className="rounded-2xl border border-amber/30 bg-amber/5 p-4">
          <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber">Model output · synthetic</div>
            <h4 id="ai-demo-waste-heading" className="mt-1 font-display text-lg font-bold">Illustrative items at risk</h4>
            <p className="text-xs text-muted-foreground">These are not checks of your pantry or actual expiry dates.</p>
          </div>
          {result.wastePredictions.length === 0 ? <p className="text-sm text-muted-foreground">No at-risk ingredient estimates returned.</p> : (
            <div className="space-y-2">
              {result.wastePredictions.map((item) => (
                <article key={item.ingredientId} className="rounded-xl border border-amber/20 bg-background/75 p-3" data-testid={`row-ai-demo-risk-${item.ingredientId}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><h5 className="font-semibold">{item.name}</h5><div className="mt-0.5 text-xs text-muted-foreground">Sample expiry · {dateLabel(item.expiryDate)}</div></div>
                    <div className="num whitespace-nowrap text-right text-sm font-bold text-amber">{quantity(item.estimatedAtRisk)} <span className="font-sans text-xs">{item.unit}</span></div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.explanation}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="ai-demo-orders-heading" className="rounded-2xl border border-jade/25 bg-jade/5 p-4">
          <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jade">Model output · synthetic</div>
            <h4 id="ai-demo-orders-heading" className="mt-1 font-display text-lg font-bold">Illustrative order ideas · not enabled</h4>
            <p className="text-xs text-muted-foreground">Unvalidated sample output only; not connected to live recommendations, purchase orders, approvals, or saved plans.</p>
          </div>
          {result.orderRecommendations.length === 0 ? <p className="text-sm text-muted-foreground">No order estimate rows returned.</p> : (
            <div className="space-y-2">
              {result.orderRecommendations.map((item) => (
                <article key={item.ingredientId} className="rounded-xl border border-jade/20 bg-background/75 p-3" data-testid={`row-ai-demo-order-${item.ingredientId}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><h5 className="font-semibold">{item.name}</h5><div className="mt-0.5 text-xs text-muted-foreground">Sample delivery date · {dateLabel(item.proposedDeliveryDate)}</div></div>
                    <div className="num whitespace-nowrap text-right text-sm font-bold text-jade">{quantity(item.suggestedOrderQuantity)} <span className="font-sans text-xs">{item.unit}</span></div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.explanation}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-relaxed" data-testid="warning-ai-demo-result">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="font-semibold">{requiredWarning}</p>
        </div>
        {result.disclaimer && result.disclaimer !== requiredWarning && <p className="ml-6 mt-2 text-xs text-muted-foreground">{result.disclaimer}</p>}
      </div>
    </div>
  );
}

function OwnerHistoryResult({ result }: { result: AiOwnerHistoryForecastResponse }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${result.horizonStart.slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  });
  return (
    <div className="space-y-4 border-t border-dashed border-jade/30 pt-4" data-testid="panel-ai-owner-history-result">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-jade/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-jade">Owner history · experimental</span>
          <h3 className="mt-2 text-lg font-bold">Advisory 7-day demand scenario</h3>
          <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
        </div>
        <div className="text-xs text-muted-foreground">Generated by {result.model}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">History used</div><div className="mt-1 text-sm font-semibold">{dateLabel(result.historyStart)} – {dateLabel(result.historyEnd)}</div></div>
        <div className="rounded-xl border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Records sent</div><div className="mt-1 text-sm font-semibold">{result.salesCount} sales · {result.preparationCount} preparation</div></div>
        <div className="rounded-xl border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Forecast window</div><div className="mt-1 text-sm font-semibold">{dateLabel(result.horizonStart)} – {dateLabel(result.horizonEnd)}</div></div>
      </div>
      <div className="space-y-2">
        {result.demandForecasts.map((dish) => (
          <article key={dish.itemName} className="rounded-xl border border-border bg-background/75 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold">{dish.itemName}</h4>
              <span className="num text-sm font-bold text-primary">{quantity(dish.totalPredictedPortions)} portions over 7 days</span>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {days.map((day, index) => (
                <div key={`${dish.itemName}-${day}`} className="min-w-0 text-center">
                  <div className="text-[10px] text-muted-foreground">{day}</div>
                  <div className="num text-xs font-semibold">{quantity(dish.predictedPortionsByDay[index] ?? 0)}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{dish.explanation}</p>
          </article>
        ))}
      </div>
      <div className="rounded-xl border border-amber/30 bg-amber/5 p-3 text-xs leading-relaxed" role="note" data-testid="warning-ai-owner-history-result">
        <strong>Advisory only.</strong> {result.disclaimer} This result does not alter stock, orders, approvals, or plans.
      </div>
    </div>
  );
}

function isUsableForecastHistoryRecord(record: HistoricalRecord, today: string) {
  if ((record.kind !== 'sales' && record.kind !== 'preparation') || !/^\d{4}-\d{2}-\d{2}$/.test(record.date) || record.date > today) return false;
  if (!(record.menuName ?? record.itemName ?? '').trim()) return false;
  if (record.kind === 'sales') return Number.isFinite(record.quantity) && (record.quantity ?? -1) >= 0 && (record.quantity ?? Infinity) <= 1_000_000;
  return [record.prepared, record.sold, record.leftover].every(value => Number.isInteger(value) && (value ?? -1) >= 0 && (value ?? Infinity) <= 1_000_000) &&
    record.prepared === (record.sold ?? -1) + (record.leftover ?? -1);
}

function OwnerHistoryForecast({ today }: { today: string }) {
  const history = useGetHistoricalRecords({
    query: { queryKey: getGetHistoricalRecordsQueryKey(), enabled: true, staleTime: 0, refetchOnMount: 'always' },
  });
  const forecast = useGenerateAiOwnerHistoryForecast();
  const [consent, setConsent] = useState(false);
  const records = history.data?.records ?? [];
  const preview = useMemo(() => {
    const eligible = records.filter((record) => isUsableForecastHistoryRecord(record, today));
    const dates = eligible.map((record) => record.date);
    return {
      salesCount: eligible.filter((record) => record.kind === 'sales').length,
      preparationCount: eligible.filter((record) => record.kind === 'preparation').length,
      historyStart: dates.length ? dates.reduce((min, date) => date < min ? date : min) : '',
      historyEnd: dates.length ? dates.reduce((max, date) => date > max ? date : max) : '',
    };
  }, [records, today]);
  const canRun = consent && preview.salesCount + preview.preparationCount > 0 && !history.isLoading && !history.isError && !forecast.isPending;
  const runOwnerForecast = () => {
    if (!canRun) return;
    forecast.reset();
    forecast.mutate({ data: {
      ownerHistoryConsent: true,
      expectedHistoryStart: preview.historyStart,
      expectedHistoryEnd: preview.historyEnd,
      expectedSalesCount: preview.salesCount,
      expectedPreparationCount: preview.preparationCount,
    } });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-jade/30 bg-card shadow-sm" data-testid="section-ai-owner-history-forecast">
      <div className="bg-jade/[0.06] p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-jade px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Optional owner data</span>
          <span className="text-[11px] font-semibold text-muted-foreground">Separate from operational planning</span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Forecast from your archived history.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          No records are sent to an AI model unless you review the preview, check the consent box, and request a forecast. Only archived sales and preparation records are eligible; stock records and current workspace data are excluded. The result is temporary and advisory.
        </p>
      </div>
      <div className="space-y-4 p-4 md:p-6">
        {history.isLoading ? <p className="text-sm text-muted-foreground" role="status">Loading your archive preview…</p> :
          history.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              <p>Could not load the history preview: {errorMessage(history.error)}</p>
              <button type="button" className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold" onClick={() => void history.refetch()}>Refresh preview</button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-background/70 p-4" data-testid="preview-ai-owner-history">
              {preview.salesCount + preview.preparationCount > 0 ? (
                <>
                  <p className="text-sm font-bold">Before the request, review the exact history scope:</p>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs text-muted-foreground">Date range</dt><dd className="mt-0.5 font-semibold">{dateLabel(preview.historyStart)} – {dateLabel(preview.historyEnd)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Record types and counts</dt><dd className="mt-0.5 font-semibold">{preview.salesCount} sales · {preview.preparationCount} preparation</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Not included</dt><dd className="mt-0.5 font-semibold">Stock history, file names, IDs, live data</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">The model receives these records’ dates, dish names, and sales/preparation quantities. If this archive changes after the preview, the request is rejected and no history is sent.</p>
                </>
              ) : <p className="text-sm text-muted-foreground">No usable archived sales or preparation records are available. Import historical records first, then review them here. Stock-only history is not used for this forecast.</p>}
            </div>
          )}

        <div className="flex items-start gap-3">
          <Checkbox
            id="consent-owner-history-forecast"
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            disabled={history.isLoading || history.isError || preview.salesCount + preview.preparationCount === 0 || forecast.isPending}
            data-testid="checkbox-consent-owner-history-forecast"
          />
          <Label htmlFor="consent-owner-history-forecast" className="cursor-pointer text-sm leading-relaxed">
            I explicitly consent to sending the sales and preparation records in the preview above to the AI model for this one forecast.
          </Label>
        </div>
        <button
          type="button"
          onClick={runOwnerForecast}
          disabled={!canRun}
          data-testid="button-run-ai-owner-history-forecast"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-jade px-5 py-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {forecast.isPending ? <><RotateCw className="h-4 w-4 animate-spin" /> Forecasting…</> : <><Sparkles className="h-4 w-4" /> Generate owner-history forecast <ArrowRight className="h-4 w-4" /></>}
        </button>
        {forecast.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert" data-testid="status-ai-owner-history-error">
            <p>{errorMessage(forecast.error)}</p>
            <button
              type="button"
              className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"
              onClick={() => { setConsent(false); forecast.reset(); void history.refetch(); }}
            >
              Refresh and review the archive again
            </button>
          </div>
        )}
        {forecast.data && !forecast.isPending && <OwnerHistoryResult result={forecast.data} />}
      </div>
    </section>
  );
}

export function AiForecastDemo({ ownerDataMode = false, today }: { ownerDataMode?: boolean; today?: string }) {
  const demo = useGenerateAiDemoForecast();
  const runDemo = () => {
    demo.reset();
    demo.mutate({ data: { demoOnly: true } });
  };

  return (
    <div className="space-y-4">
      {ownerDataMode && today && <OwnerHistoryForecast today={today} />}
      <section className="overflow-hidden rounded-2xl border-2 border-dashed border-primary/35 bg-card shadow-sm" data-testid="section-ai-forecast-demo">
      <div className="grid gap-5 bg-gradient-to-br from-primary/[0.07] via-card to-accent/30 p-4 md:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground"><FlaskConical className="h-3.5 w-3.5" /> Experimental AI lab</span>
            <span className="text-[11px] font-semibold text-muted-foreground">Separate from operational planning</span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Try a synthetic forecast.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">On your click, the demo generates a separate sample dataset covering 28 days and returns an illustrative seven-day dish, waste, and ordering scenario. It does not receive your workspace data, and it never changes the rule-based forecast above, pantry stock, orders, or approvals.</p>
          <div className="mt-3 grid gap-x-5 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> One request, only when you choose</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-jade" /> Result is temporary; nothing is saved</span>
          </div>
        </div>
        <button
          type="button"
          data-testid="button-run-ai-forecast-demo"
          onClick={runDemo}
          disabled={demo.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {demo.isPending ? <><RotateCw className="h-4 w-4 animate-spin" /> Generating sample…</> : <><Sparkles className="h-4 w-4" /> {demo.data ? 'Generate another sample' : 'Generate sample forecast'} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-foreground" data-testid="warning-ai-demo">
          <span className="font-bold text-destructive">Before you run it:</span> {requiredWarning}
        </div>

        {demo.isPending && (
          <div className="mt-5 space-y-3" role="status" aria-live="polite" data-testid="status-ai-demo-loading">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded-xl bg-muted/70" />
            <div className="grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-xl bg-muted/70" /><div className="h-28 animate-pulse rounded-xl bg-muted/70" /></div>
            <span className="sr-only">Generating one synthetic demonstration. Normal planning is unchanged.</span>
          </div>
        )}

        {demo.isError && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="status-ai-demo-error">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div><p className="font-bold">The demo could not run.</p><p className="mt-0.5 text-xs text-muted-foreground">Your normal forecast and planning are untouched. You can try the sample again when ready.</p></div>
            </div>
            <button type="button" data-testid="button-retry-ai-forecast-demo" onClick={runDemo} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">Try again</button>
          </div>
        )}

        {demo.data && !demo.isPending && <ForecastResult result={demo.data} />}
      </div>
      </section>
    </div>
  );
}
