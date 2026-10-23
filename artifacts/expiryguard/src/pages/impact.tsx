import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CsvImport, EmptyState, ErrorState, LoadingState, PageHeader, Panel, Stat, type ImportSpec } from '@/components/bits';
import { HistoricalArchive } from '@/components/historical-archive';
import { ImpactBoard } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addDays, errorMessage, fmt, isDate, isNum, niceDate, rm, useGuard, useGuardMutations } from '@/lib/guard';
import { wasteHistoryComparison } from '@/lib/impact';

type Row = { prepared: string; sold: string; leftover: string };

export default function Impact() {
  const { data, isLoading, error, refetch } = useGuard();
  const { add } = useGuardMutations();
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [vals, setVals] = useState<Record<string, Row>>({});
  const activeMenu = useMemo(() => (data?.menu ?? []).filter((m) => m.archivedAt === null), [data?.menu]);
  const menuIds = useMemo(() => activeMenu.map((m) => m.id), [activeMenu]);
  const spec: ImportSpec = useMemo(() => ({
    kind: 'results',
    columns: [
      { name: 'date', required: true, hint: 'YYYY-MM-DD' },
      { name: 'menuId', required: true, hint: `One of: ${menuIds.join(', ')}` },
      { name: 'prepared', required: true, hint: 'Portions prepared' },
      { name: 'sold', required: true, hint: 'Portions sold' },
      { name: 'leftover', required: true, hint: 'Must equal prepared minus sold' },
    ],
    template: `date,menuId,prepared,sold,leftover\n${data ? addDays(data.today, -1) : '2025-01-01'},${menuIds[0] ?? 'menu-id'},30,27,3\n`,
    validate: (r) => {
      if (!isDate(r.date)) return 'date must be YYYY-MM-DD';
      if (!menuIds.includes(r.menuId)) return `unknown menuId "${r.menuId}"`;
      if (![r.prepared, r.sold, r.leftover].every(isNum)) return 'prepared, sold, leftover must be numbers';
      if (Number(r.prepared) !== Number(r.sold) + Number(r.leftover)) return 'prepared must equal sold + leftover';
      return null;
    },
    transform: (r) => ({ date: r.date, menuId: r.menuId, prepared: Number(r.prepared), sold: Number(r.sold), leftover: Number(r.leftover) }),
  }), [menuIds, data]);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const s = data.summary;
  const entryDate = date || addDays(data.today, -1);
  const filled = Object.entries(vals).filter(([, v]) => v.prepared || v.sold || v.leftover);
  const rowErr = filled.map(([id, v]) => spec.validate({ date: entryDate, menuId: id, ...v })).find(Boolean);
  const cost = (id: string) => data.menu.find((m) => m.id === id)?.cost ?? 0;
  const recent = [...data.results].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const ownerWaste = data.synthetic ? null : wasteHistoryComparison(data.results, data.today);
  const ownerCanCompare = ownerWaste !== null && ownerWaste.portionDelta !== null;
  const cmp = data.synthetic
    ? [
        { k: 'Sample waste cost (RM)', Earlier: s.baselineWasteCost, Recent: s.actualWasteCost },
        { k: 'Sample waste (kg)', Earlier: s.baselineWasteKg, Recent: s.actualWasteKg },
      ]
    : ownerCanCompare && ownerWaste
      ? [
          { k: 'Recorded leftover portions', Earlier: ownerWaste.earlier.leftoverPortions, Recent: ownerWaste.recent.leftoverPortions },
          ...(ownerWaste.earlier.leftoverCost !== null && ownerWaste.recent.leftoverCost !== null
            ? [{ k: 'Estimated leftover value (RM)', Earlier: ownerWaste.earlier.leftoverCost, Recent: ownerWaste.recent.leftoverCost }]
            : []),
        ]
      : [];
  const ownerCostDelta = ownerWaste?.costDelta ?? null;
  const ownerPortionDelta = ownerWaste?.portionDelta ?? null;
  const ownerChange = ownerCostDelta !== null
    ? `${ownerCostDelta > 0 ? '−' : ownerCostDelta < 0 ? '+' : ''}${rm(Math.abs(ownerCostDelta))}`
    : ownerPortionDelta !== null
      ? `${ownerPortionDelta > 0 ? '−' : ownerPortionDelta < 0 ? '+' : ''}${fmt(Math.abs(ownerPortionDelta), 0)} portions`
      : '—';
  const ownerChangeNote = ownerCostDelta !== null
    ? ownerCostDelta > 0 ? 'lower recent leftover value estimate; not realised savings' : ownerCostDelta < 0 ? 'higher recent leftover value estimate; not realised savings' : 'no change in estimated leftover value'
    : ownerPortionDelta !== null
      ? ownerPortionDelta > 0 ? 'fewer recent leftover portions; saved costs are incomplete' : ownerPortionDelta < 0 ? 'more recent leftover portions; saved costs are incomplete' : 'no change in leftovers; saved costs are incomplete'
      : 'records are needed in both seven-day windows';

  const submit = () => {
    add.mutate({ data: { kind: 'results', rows: filled.map(([menuId, v]) => spec.transform({ date: entryDate, menuId, ...v })) } }, {
      onSuccess: () => { toast({ title: 'Results recorded', description: niceDate(entryDate) }); setVals({}); },
      onError: (e) => toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' }),
    });
  };
  const setV = (id: string, k: keyof Row, v: string) => setVals((o) => {
    const cur = { ...{ prepared: '', sold: '', leftover: '' }, ...o[id], [k]: v };
    if (k !== 'leftover' && cur.prepared !== '' && cur.sold !== '') cur.leftover = String(Math.max(0, Number(cur.prepared) - Number(cur.sold)));
    return { ...o, [id]: cur };
  });

  return (
    <div className="space-y-5">
      <PageHeader kicker="Impact" title="What waste prevention is worth">
        {data.synthetic
          ? <>Sample history only: the demo compares synthetic seven-day windows and does not prove business impact. Projected purchasing savings are estimates from approved plan changes, not supplier orders.</>
          : <>Pilot view: compares owner-recorded leftovers in two adjacent seven-calendar-day windows. Missing service dates are unknown, not zero. Leftover value uses the saved per-portion cost and is not verified disposal cost or realised savings.</>}
      </PageHeader>
      <ImpactBoard data={data} />
      {data.synthetic ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Stat label="Sample waste, earlier window" value={rm(s.baselineWasteCost)} note={`${fmt(s.baselineWasteKg)} kg · synthetic`} tone="amber" />
          <Stat label="Sample waste, recent window" value={rm(s.actualWasteCost)} note={`${fmt(s.actualWasteKg)} kg · synthetic`} tone="primary" />
          <Stat label="Projected purchasing change" value={rm(s.estimatedSavings)} note="estimate, not yet realised or ordered" tone="ink" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Earlier recorded leftovers" value={ownerWaste?.earlier.rows ? `${fmt(ownerWaste.earlier.leftoverPortions, 0)} portions` : '—'} note={`${ownerWaste?.earlier.recordedDays ?? 0}/7 days · ${ownerWaste?.earlier.rows ?? 0} rows · value ${ownerWaste?.earlier.leftoverCost === null || ownerWaste?.earlier.leftoverCost === undefined ? 'incomplete' : rm(ownerWaste.earlier.leftoverCost)}`} tone="amber" />
          <Stat label="Recent recorded leftovers" value={ownerWaste?.recent.rows ? `${fmt(ownerWaste.recent.leftoverPortions, 0)} portions` : '—'} note={`${ownerWaste?.recent.recordedDays ?? 0}/7 days · ${ownerWaste?.recent.rows ?? 0} rows · value ${ownerWaste?.recent.leftoverCost === null || ownerWaste?.recent.leftoverCost === undefined ? 'incomplete' : rm(ownerWaste.recent.leftoverCost)}`} tone="primary" />
          <Stat label="Observed window change" value={ownerChange} note={ownerChangeNote} tone={ownerCanCompare ? (ownerCostDelta ?? ownerPortionDelta ?? 0) > 0 ? 'jade' : (ownerCostDelta ?? ownerPortionDelta ?? 0) < 0 ? 'amber' : 'ink' : 'ink'} />
          <Stat label="Projected purchasing change" value={rm(s.estimatedSavings)} note="estimate, not yet realised or ordered" tone="ink" />
        </div>
      )}
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
        <Panel
          title={data.synthetic ? 'Sample windows · synthetic only' : 'Recorded leftovers over time'}
          sub={data.synthetic
            ? 'Synthetic sample totals; these are not pilot results.'
            : `Earlier ${niceDate(ownerWaste?.earlier.from ?? addDays(data.today, -13))}–${niceDate(ownerWaste?.earlier.through ?? addDays(data.today, -7))} vs recent ${niceDate(ownerWaste?.recent.from ?? addDays(data.today, -6))}–${niceDate(ownerWaste?.recent.through ?? data.today)}. Recorded days only; coverage may differ.`}
        >
          <div className="h-64"><ResponsiveContainer><BarChart data={cmp}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="k" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ borderRadius: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Earlier" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Recent" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
          {!data.synthetic && cmp.length === 0 && <p className="text-sm text-muted-foreground">No recorded entries in these windows to compare.</p>}
          {!data.synthetic && ownerWaste && (ownerWaste.earlier.leftoverCost === null || ownerWaste.recent.leftoverCost === null) && (
            <p className="text-xs text-muted-foreground">Cost is omitted from the chart because at least one record is missing a saved menu-cost snapshot. Portion totals remain available.</p>
          )}
        </Panel>
        <Panel title="Record actual results" sub="Leftover fills in automatically: prepared = sold + leftover">
          <div className="mb-3 max-w-xs"><Label>Service date</Label><Input type="date" max={data.today.slice(0, 10)} value={entryDate} onChange={(e) => setDate(e.target.value)} data-testid="input-results-date" /></div>
          {activeMenu.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active dishes are available. Add or restore a dish in Menu before recording new results.</div> : <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_64px_64px_64px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><span>Dish</span><span>Prep</span><span>Sold</span><span>Left</span></div>
            {activeMenu.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_64px_64px_64px] gap-2 items-center">
                <span className="text-sm truncate">{m.name}</span>
                {(['prepared', 'sold', 'leftover'] as const).map((k) => (
                  <Input key={k} className="h-8 num px-2" type="number" min={0} value={vals[m.id]?.[k] ?? ''} onChange={(e) => setV(m.id, k, e.target.value)} data-testid={`input-${k}-${m.id}`} />
                ))}
              </div>
            ))}
          </div>}
          {rowErr && <div className="text-xs text-destructive mt-2">{rowErr}</div>}
          <Button className="mt-3" disabled={!filled.length || !!rowErr || add.isPending} onClick={submit} data-testid="button-save-results">{add.isPending ? 'Saving...' : `Record ${filled.length} results`}</Button>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
        <Panel title="Recorded results" sub="Most recent 20 entries">
          {recent.length === 0 ? <EmptyState title="No results yet" body="Record what was prepared and sold to measure waste." /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm num">
              <thead><tr className="text-[11px] uppercase text-muted-foreground border-b font-sans"><th className="text-left py-2">Date</th><th className="text-left">Dish</th><th className="text-right">Prep</th><th className="text-right">Sold</th><th className="text-right">Left</th><th className="text-right">Waste</th></tr></thead>
               <tbody>{recent.map((r, i) => (
                 <tr key={i} className="border-b last:border-0" data-testid={`row-result-history-${i}`}><td className="py-1.5">{niceDate(r.date)}</td><td className="font-sans">{r.menuName ?? data.menu.find((m) => m.id === r.menuId)?.name ?? r.menuId}</td><td className="text-right">{r.prepared}</td><td className="text-right">{r.sold}</td><td className="text-right">{r.leftover}</td><td className="text-right text-primary">{rm(r.leftover * (r.menuCost ?? cost(r.menuId)))}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>
        <Panel title="Record live results CSV"><CsvImport spec={spec} /></Panel>
      </div>
      <HistoricalArchive />
    </div>
  );
}
