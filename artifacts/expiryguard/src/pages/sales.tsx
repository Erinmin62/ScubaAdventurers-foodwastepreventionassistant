import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { CsvImport, EmptyState, ErrorState, LoadingState, PageHeader, Panel, type ImportSpec } from '@/components/bits';
import { HistoricalImport } from '@/components/historical-import';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { addDays, errorMessage, fmt, isDate, isNum, niceDate, rm, useGuard, useGuardMutations } from '@/lib/guard';
import { cn } from '@/lib/utils';

const isPortionCount = (value: string) => /^\d+$/.test(value) && Number(value) <= 1_000_000;

export default function Sales() {
  const { data, isLoading, error, refetch } = useGuard();
  const { add } = useGuardMutations();
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const activeMenu = useMemo(() => (data?.menu ?? []).filter((m) => m.archivedAt === null), [data?.menu]);
  const menuIds = useMemo(() => activeMenu.map((m) => m.id), [activeMenu]);
  const historyItems = useMemo(() => {
    const sales = data?.sales ?? [];
    const menu = data?.menu ?? [];
    const ids = new Set(sales.map((s) => s.menuId));
    return [...ids].map((id) => {
      const item = menu.find((m) => m.id === id);
      const snapshot = [...sales].reverse().find((s) => s.menuId === id);
      return { id, name: snapshot?.menuName ?? item?.name ?? id };
    });
  }, [data?.menu, data?.sales]);
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
  const revenue = (d: string) => data.sales.filter((s) => s.date.slice(0, 10) === d).reduce((sum, sale) => {
    const item = data.menu.find((m) => m.id === sale.menuId);
    return sum + sale.portions * (sale.menuPrice ?? item?.price ?? 0);
  }, 0);
  const filled = Object.entries(vals).filter(([, v]) => v !== '');
  const invalid = filled.some(([, v]) => !isPortionCount(v));
  const selectedMenuItem = activeMenu.find((item) => item.id === selectedMenuId);
  const canAddItem = Boolean(selectedMenuItem) && isPortionCount(quantity);

  const submit = () => {
    add.mutate({ data: { kind: 'sales', rows: filled.map(([menuId, v]) => ({ date: entryDate, menuId, portions: Number(v) })) } }, {
      onSuccess: () => {
        toast({ title: 'Sales recorded', description: `${filled.length} items for ${niceDate(entryDate)}` });
        setVals({});
        setSelectedMenuId('');
        setQuantity('1');
      },
      onError: (e) => toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' }),
    });
  };

  const addSelectedItem = () => {
    if (!selectedMenuItem || !isPortionCount(quantity)) return;
    setVals((previous) => ({ ...previous, [selectedMenuItem.id]: quantity }));
    setSelectedMenuId('');
    setQuantity('1');
  };

  return (
    <div className="space-y-5">
      <PageHeader kicker="Sales" title="Yesterday's till, tomorrow's plan.">Daily portions feed the live 7-day forecast. Use the separate historical archive below for past sales, preparation, leftovers, and stock records.</PageHeader>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Daily entry" sub="Search for each item sold and add its amount">
          <div className="mb-3 max-w-xs"><Label>Sales date</Label><Input type="date" max={data.today.slice(0, 10)} value={entryDate} onChange={(e) => setDate(e.target.value)} disabled={add.isPending} data-testid="input-sales-date" /></div>
          {activeMenu.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active menu items are available. Add or restore an item in Menu before recording sales.</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_132px_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label>Find a menu item</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        aria-label="Select a menu item"
                        className="w-full justify-between bg-background font-normal"
                        disabled={add.isPending}
                        data-testid="button-select-menu-item"
                      >
                        <span className={cn('truncate', !selectedMenuItem && 'text-muted-foreground')}>
                          {selectedMenuItem?.name ?? 'Search menu items...'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Type an item name..." aria-label="Search active menu items" data-testid="input-search-sales-menu" />
                        <CommandList>
                          <CommandEmpty>No active items match that search.</CommandEmpty>
                          <CommandGroup heading="Active items">
                            {activeMenu.map((item) => {
                              const alreadyAdded = vals[item.id] !== undefined && vals[item.id] !== '';
                              return (
                                <CommandItem
                                  key={item.id}
                                  value={item.name}
                                  disabled={alreadyAdded}
                                  onSelect={() => {
                                    setSelectedMenuId(item.id);
                                    setPickerOpen(false);
                                  }}
                                  data-testid={`option-sales-menu-${item.id}`}
                                >
                                  <Check className={cn('h-4 w-4', selectedMenuId === item.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                  {alreadyAdded && <span className="text-xs text-muted-foreground">Added</span>}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="input-sales-quantity">Amount (portions)</Label>
                  <Input
                    id="input-sales-quantity"
                    className="num"
                    type="number"
                    min={0}
                    max={1_000_000}
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={add.isPending}
                    aria-describedby="sales-quantity-hint"
                    data-testid="input-sales-quantity"
                  />
                </div>
                <Button type="button" onClick={addSelectedItem} disabled={!canAddItem || add.isPending} className="sm:mb-0.5" data-testid="button-add-sales-item">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add item
                </Button>
              </div>
              <p id="sales-quantity-hint" className="mt-1 text-xs text-muted-foreground">Enter a whole number from 0 to 1,000,000.</p>
              <div className="mt-4 border-t pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Items to record</h3>
                  <span className="text-xs text-muted-foreground" data-testid="text-sales-items-selected">{filled.length} selected</span>
                </div>
                {filled.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No items added yet. Search for a menu item above.</div>
                ) : (
                  <div className="space-y-2">
                    {filled.map(([menuId, value]) => {
                      const item = data.menu.find((menuItem) => menuItem.id === menuId);
                      return (
                        <div key={menuId} className="grid grid-cols-[minmax(0,1fr)_112px_40px] items-center gap-2 rounded-lg border px-3 py-2" data-testid={`row-daily-sales-item-${menuId}`}>
                          <span className="truncate text-sm font-medium">{item?.name ?? menuId}</span>
                          <Input
                            className="num h-9"
                            type="number"
                            min={0}
                            max={1_000_000}
                            step={1}
                            value={value}
                            onChange={(e) => setVals((previous) => ({ ...previous, [menuId]: e.target.value }))}
                            disabled={add.isPending}
                            aria-label={`Amount sold for ${item?.name ?? menuId}`}
                            data-testid={`input-portions-${menuId}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${item?.name ?? menuId}`}
                            disabled={add.isPending}
                            onClick={() => setVals((previous) => {
                              const next = { ...previous };
                              delete next[menuId];
                              return next;
                            })}
                            data-testid={`button-remove-sales-item-${menuId}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {invalid && <div className="mt-2 text-xs text-destructive" role="alert">Amounts must be whole numbers from 0 to 1,000,000.</div>}
                <Button className="mt-3" disabled={!filled.length || invalid || add.isPending || !isDate(entryDate)} onClick={submit} data-testid="button-save-sales">
                  {add.isPending ? 'Saving...' : `Record ${filled.length} items`}
                </Button>
              </div>
            </>
          )}
        </Panel>
        <Panel title="Record live sales CSV"><CsvImport spec={spec} /></Panel>
      </div>
      <Panel title="Import past sales and stock" sub="Review every row before saving to the separate archive">
        <HistoricalImport state={data} />
      </Panel>
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
