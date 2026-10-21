import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CsvImport, EmptyState, ErrorState, LoadingState, PageHeader, Panel, Stat, type ImportSpec } from '@/components/bits';
import { ImpactBoard } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addDays, errorMessage, fmt, isDate, isNum, niceDate, rm, useGuard, useGuardMutations } from '@/lib/guard';

type Row = { prepared: string; sold: string; leftover: string };

export default function Impact() {
  const { data, isLoading, error, refetch } = useGuard();
  const { add } = useGuardMutations();
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [vals, setVals] = useState<Record<string, Row>>({});
  const menuIds = useMemo(() => (data?.menu ?? []).map((m) => m.id), [data]);
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
  const cmp = [
    { k: 'Waste cost (RM)', Baseline: s.baselineWasteCost, Recent: s.actualWasteCost },
    { k: 'Waste (kg)', Baseline: s.baselineWasteKg, Recent: s.actualWasteKg },
    { k: 'Purchasing (RM)', Baseline: s.baselinePurchaseCost, Recent: s.plannedPurchaseCost },
  ];
  const delta = s.baselineWasteCost - s.actualWasteCost;

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
        Synthetic baseline: seven days. Recent waste: the last seven calendar days including today; unrecorded results are not counted. This demo comparison does not prove savings. Projected purchasing savings reflect approved changes, not supplier orders.
      </PageHeader>
      <ImpactBoard data={data} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Recorded waste, baseline" value={rm(s.baselineWasteCost)} note={`${fmt(s.baselineWasteKg)} kg`} tone="amber" />
        <Stat label="Recorded waste, recent" value={rm(s.actualWasteCost)} note={`${fmt(s.actualWasteKg)} kg`} tone="primary" />
        <Stat label="Recorded change" value={`${Math.abs(delta) < 0.005 ? '' : delta > 0 ? '-' : '+'}${rm(Math.abs(delta))}`} note={Math.abs(delta) < 0.005 ? 'no change' : delta > 0 ? 'less waste than baseline' : 'more waste than baseline'} tone="jade" />
        <Stat label="Projected savings" value={rm(s.estimatedSavings)} note="estimate, not yet realised" tone="ink" />
      </div>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
        <Panel title="Baseline vs recent window" sub="Synthetic estimates, same-length windows">
          <div className="h-64"><ResponsiveContainer><BarChart data={cmp}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="k" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ borderRadius: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Baseline" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Recent" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Record actual results" sub="Leftover fills in automatically: prepared = sold + leftover">
          <div className="mb-3 max-w-xs"><Label>Service date</Label><Input type="date" max={data.today.slice(0, 10)} value={entryDate} onChange={(e) => setDate(e.target.value)} data-testid="input-results-date" /></div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_64px_64px_64px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><span>Dish</span><span>Prep</span><span>Sold</span><span>Left</span></div>
            {data.menu.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_64px_64px_64px] gap-2 items-center">
                <span className="text-sm truncate">{m.name}</span>
                {(['prepared', 'sold', 'leftover'] as const).map((k) => (
                  <Input key={k} className="h-8 num px-2" type="number" min={0} value={vals[m.id]?.[k] ?? ''} onChange={(e) => setV(m.id, k, e.target.value)} data-testid={`input-${k}-${m.id}`} />
                ))}
              </div>
            ))}
          </div>
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
                <tr key={i} className="border-b last:border-0"><td className="py-1.5">{niceDate(r.date)}</td><td className="font-sans">{data.menu.find((m) => m.id === r.menuId)?.name ?? r.menuId}</td><td className="text-right">{r.prepared}</td><td className="text-right">{r.sold}</td><td className="text-right">{r.leftover}</td><td className="text-right text-primary">{rm(r.leftover * cost(r.menuId))}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>
        <Panel title="Import results CSV"><CsvImport spec={spec} /></Panel>
      </div>
    </div>
  );
}
