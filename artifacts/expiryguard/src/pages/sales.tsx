import { useMemo, useState } from 'react';
import { CsvImport, EmptyState, ErrorState, LoadingState, PageHeader, Panel, type ImportSpec } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addDays, errorMessage, fmt, isDate, isNum, niceDate, rm, useGuard, useGuardMutations } from '@/lib/guard';

export default function Sales() {
  const { data, isLoading, error, refetch } = useGuard();
  const { add } = useGuardMutations();
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});

  const activeMenu = useMemo(() => (data?.menu ?? []).filter((m) => m.archivedAt === null), [data?.menu]);
  const menuIds = useMemo(() => activeMenu.map((m) => m.id), [activeMenu]);
  const spec: ImportSpec = useMemo(() => ({
    kind: 'sales',
    columns: [
      { name: 'date', required: true, hint: 'YYYY-MM-DD' },
      { name: 'menuId', required: true, hint: `One of: ${menuIds.join(', ')}` },
      { name: 'portions', required: true, hint: 'Portions sold, whole number' },
    ],
    template: `date,menuId,portions\n${data ? addDays(data.today, -1) : '2025-01-01'},${menuIds[0] ?? 'menu-id'},24\n`,
    validate: (r) => !isDate(r.date) ? 'date must be YYYY-MM-DD' : !menuIds.includes(r.menuId) ? `unknown menuId "${r.menuId}"` : !isNum(r.portions) ? 'portions must be a number 0 or more' : null,
    transform: (r) => ({ date: r.date, menuId: r.menuId, portions: Number(r.portions) }),
  }), [menuIds, data]);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const entryDate = date || addDays(data.today, -1);
  const dates = Array.from(new Set(data.sales.map((s) => s.date.slice(0, 10)))).sort().reverse().slice(0, 14);
  const cell = (d: string, m: string) => data.sales.filter((s) => s.date.slice(0, 10) === d && s.menuId === m).reduce((a, s) => a + s.portions, 0);
  const historyItems = useMemo(() => {
    const ids = new Set(data.sales.map((s) => s.menuId));
    return [...ids].map((id) => {
      const item = data.menu.find((m) => m.id === id);
      const snapshot = [...data.sales].reverse().find((s) => s.menuId === id);
      return { id, name: snapshot?.menuName ?? item?.name ?? id };
    });
  }, [data.menu, data.sales]);
  const revenue = (d: string) => data.sales.filter((s) => s.date.slice(0, 10) === d).reduce((sum, sale) => {
    const item = data.menu.find((m) => m.id === sale.menuId);
    return sum + sale.portions * (sale.menuPrice ?? item?.price ?? 0);
  }, 0);
  const filled = Object.entries(vals).filter(([, v]) => v !== '');
  const invalid = filled.some(([, v]) => !isNum(v));

  const submit = () => {
    add.mutate({ data: { kind: 'sales', rows: filled.map(([menuId, v]) => ({ date: entryDate, menuId, portions: Number(v) })) } }, {
      onSuccess: () => { toast({ title: 'Sales recorded', description: `${filled.length} items for ${niceDate(entryDate)}` }); setVals({}); },
      onError: (e) => toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader kicker="Sales" title="Yesterday's till, tomorrow's plan.">Daily portions per menu item feed the 7-day forecast. Enter a day by hand or import a CSV.</PageHeader>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Daily entry" sub="Leave blank to skip an item">
          <div className="mb-3 max-w-xs"><Label>Sales date</Label><Input type="date" max={data.today.slice(0, 10)} value={entryDate} onChange={(e) => setDate(e.target.value)} data-testid="input-sales-date" /></div>
          {activeMenu.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active dishes are available. Add or restore a dish in Menu before recording new sales.</div> : <div className="grid sm:grid-cols-2 gap-2">
              {activeMenu.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:border-primary transition-colors">
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                <Input className="w-20 h-8 num" type="number" min={0} value={vals[m.id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [m.id]: e.target.value }))} data-testid={`input-portions-${m.id}`} />
              </label>
            ))}
          </div>}
          {invalid && <div className="text-xs text-destructive mt-2">Portions must be numbers 0 or more.</div>}
          <Button className="mt-3" disabled={!filled.length || invalid || add.isPending || !isDate(entryDate)} onClick={submit} data-testid="button-save-sales">{add.isPending ? 'Saving...' : `Record ${filled.length} items`}</Button>
        </Panel>
        <Panel title="Import sales CSV"><CsvImport spec={spec} /></Panel>
      </div>
      <Panel title="Sales history" sub="Portions per item, most recent 14 days with data">
        {dates.length === 0 ? <EmptyState title="No sales yet" body="Record a day to start forecasting." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm num">
              <thead><tr className="text-[11px] uppercase text-muted-foreground border-b"><th className="text-left py-2 pr-3 font-sans">Date</th>{historyItems.map((m) => <th key={m.id} className="text-right pr-3 font-sans">{m.name}</th>)}<th className="text-right font-sans">Revenue</th></tr></thead>
              <tbody>{dates.map((d) => (
                <tr key={d} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-sales-${d}`}>
                  <td className="py-2 pr-3 font-sans font-medium">{niceDate(d)}</td>
                  {historyItems.map((m) => <td key={m.id} className="text-right pr-3">{fmt(cell(d, m.id), 0)}</td>)}
                  <td className="text-right font-semibold">{rm(revenue(d))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
