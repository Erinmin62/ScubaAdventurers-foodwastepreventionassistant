import { useEffect, useMemo, useState } from 'react';
import { FocusBanner, useFocusItem, useScrollHighlight } from '@/components/focus-target';
import { Pencil, Plus, Search, Upload } from 'lucide-react';
import type { Ingredient } from '@workspace/api-client-react';
import { CsvImport, EmptyState, ErrorState, LevelPill, LoadingState, PageHeader, Panel, type ImportSpec } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { addDays, daysBetween, errorMessage, fmt, isDate, isNum, niceDate, rm, useGuard, useGuardMutations } from '@/lib/guard';
import { cn } from '@/lib/utils';
import { StockBatches } from '@/components/stock-batches';
import { IngredientPhoto } from '@/components/ingredient-photo';

const spec: ImportSpec = {
  kind: 'inventory',
  columns: [
    { name: 'id', required: false, hint: 'Existing ingredient id to update; omit to match by name' },
    { name: 'name', required: true, hint: 'Ingredient name' },
    { name: 'quantity', required: true, hint: 'Number on hand, 0 or more' },
    { name: 'unit', required: true, hint: 'kg, L, pcs...' },
    { name: 'expiry', required: true, hint: 'YYYY-MM-DD' },
    { name: 'cost', required: true, hint: 'RM per unit' },
    { name: 'category', required: false, hint: 'Dairy, Produce, Bakery...' },
    { name: 'deliveryQuantity', required: false, hint: 'Incoming amount' },
    { name: 'deliveryDate', required: false, hint: 'YYYY-MM-DD' },
  ],
  template: 'id,name,quantity,unit,expiry,cost,category,deliveryQuantity,deliveryDate\n,Fresh milk,8,L,2025-01-10,6.40,Dairy,12,2025-01-09\n',
  validate: (r) => {
    if (!r.name) return 'name is required';
    if (!isNum(r.quantity)) return 'quantity must be a number 0 or more';
    if (!r.unit) return 'unit is required';
    if (!isDate(r.expiry)) return 'expiry must be YYYY-MM-DD';
    if (!isNum(r.cost)) return 'cost must be a number';
    if (r.deliveryQuantity && !isNum(r.deliveryQuantity)) return 'deliveryQuantity must be a number';
    if (r.deliveryDate && !isDate(r.deliveryDate)) return 'deliveryDate must be YYYY-MM-DD';
    return null;
  },
  transform: (r) => ({
    ...(r.id ? { id: r.id } : {}), name: r.name, quantity: Number(r.quantity), unit: r.unit, expiry: r.expiry, cost: Number(r.cost),
    ...(r.category ? { category: r.category } : {}),
    ...(r.deliveryQuantity ? { deliveryQuantity: Number(r.deliveryQuantity) } : {}),
    ...(r.deliveryDate ? { deliveryDate: r.deliveryDate } : {}),
  }),
};

type FormState = { id?: string; name: string; quantity: string; unit: string; expiry: string; cost: string; category: string; deliveryQuantity: string; deliveryDate: string };

export default function Inventory() {
  const { data, isLoading, error, refetch } = useGuard();
  const { add } = useGuardMutations();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [form, setForm] = useState<FormState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  const focus = useFocusItem();
  useEffect(() => { if (focus) { setQ(''); setCat('All'); } }, [focus]);
  useScrollHighlight(focus ? `ingredient-${focus}` : null, !!data);
  const cats = useMemo(() => ['All', ...Array.from(new Set((data?.ingredients ?? []).map((i) => i.category || 'Other')))], [data]);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const riskMap = new Map(data.risks.map((r) => [r.ingredientId, r]));
  const list = data.ingredients
    .filter((i) => (cat === 'All' || (i.category || 'Other') === cat) && i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
  const expired = data.ingredients.filter((i) => daysBetween(data.today, i.expiry) < 0);
  const batchIngredient = data.ingredients.find(i => i.id === batchId);
  const multiBatch = (data.ingredients.find(i => i.id === form?.id)?.batches?.length ?? 0) > 1;

  const open = (i?: Ingredient) => setForm(i ? { id: i.id, name: i.name, quantity: String(i.quantity), unit: i.unit, expiry: i.expiry.slice(0, 10), cost: String(i.cost), category: i.category, deliveryQuantity: String(i.deliveryQuantity || ''), deliveryDate: i.deliveryDate?.slice(0, 10) ?? '' }
    : { name: '', quantity: '', unit: 'kg', expiry: addDays(data.today, 3), cost: '', category: '', deliveryQuantity: '', deliveryDate: '' });

  const formErr = form ? spec.validate(form as unknown as Record<string, string>) : null;
  const save = () => {
    if (!form || formErr) return;
    add.mutate({ data: { kind: 'inventory', rows: [spec.transform(form as unknown as Record<string, string>)] } }, {
      onSuccess: () => { toast({ title: form.id ? 'Ingredient updated' : 'Ingredient added', description: form.name }); setForm(null); },
      onError: (e) => toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' }),
    });
  };
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <div>
      <PageHeader kicker="Pantry" title="Every label, read." aside={<>
        <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-open-import"><Upload className="w-4 h-4 mr-1" />Import CSV</Button>
        <Button onClick={() => open()} data-testid="button-add-ingredient"><Plus className="w-4 h-4 mr-1" />Add ingredient</Button>
      </>}>
        Stock sorted by expiry. Expired items are excluded from forecasts and recommendations{expired.length ? ` — ${expired.length} currently expired` : ''}.
      </PageHeader>

      {focus && (() => { const f = data.ingredients.find((i) => i.id === focus); const r = riskMap.get(focus); return (
        <div className="mb-4"><FocusBanner found={!!f} clearHref="/inventory" label={f ? `${f.name}: ${fmt(f.quantity)} ${f.unit}, expires ${niceDate(f.expiry)} (${daysBetween(data.today, f.expiry)} day(s))${r ? `, ${rm(r.value)} at risk` : ''}. Highlighted in the table below.` : ''} /></div>); })()}
      <Panel>
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search ingredients" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-search" /></div>
          <div className="flex gap-1 flex-wrap">{cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn('rounded-full px-3 py-1 text-xs font-semibold border transition-colors', cat === c ? 'bg-ink text-background border-ink' : 'hover:bg-muted')} data-testid={`button-cat-${c}`}>{c}</button>
          ))}</div>
        </div>
        {list.length === 0 ? <EmptyState title="Nothing matches" body="Try another search, or add an ingredient." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-3">Ingredient</th><th className="pr-3">On hand</th><th className="pr-3">Expiry</th><th className="pr-3">Risk</th><th className="pr-3 text-right">Unit cost</th><th className="pr-3">Delivery</th><th />
              </tr></thead>
              <tbody>
                {list.map((i) => {
                  const days = daysBetween(data.today, i.expiry);
                  const r = riskMap.get(i.id);
                  return (
                    <tr key={i.id} id={`ingredient-${i.id}`} className="scroll-mt-24 border-b last:border-0 hover:bg-muted/40 transition-colors" data-testid={`row-ingredient-${i.id}`}>
                      <td className="py-2.5 pr-3"><div className="flex min-w-40 items-center gap-3"><IngredientPhoto id={i.id} name={i.name} className="h-12 w-12 rounded-lg" /><div className="min-w-0"><div className="font-semibold">{i.name}</div><div className="text-[11px] text-muted-foreground">{i.category || 'Other'}</div><Button variant="link" size="sm" className="min-h-8 px-0" onClick={() => setBatchId(i.id)}>Batches / receive ({i.batches?.length ?? 1})</Button></div></div></td>
                      <td className="pr-3 num">{fmt(i.quantity)} {i.unit}</td>
                      <td className="pr-3"><div className="num text-xs">{niceDate(i.expiry)} (earliest)</div><div className={cn('text-[11px] font-semibold', days < 0 ? 'text-destructive' : days <= 1 ? 'text-primary' : 'text-muted-foreground')}>{days < 0 ? 'Expired batch excluded' : days === 0 ? 'Today' : `${days}d left`}</div></td>
                      <td className="pr-3">{days < 0 ? <LevelPill level="expired" /> : r ? <div className="flex items-center gap-2"><LevelPill level={r.level} /><span className="num text-xs">{rm(r.value)}</span></div> : <span className="text-xs text-muted-foreground">Clear</span>}</td>
                      <td className="pr-3 num text-right">{rm(i.cost)}</td>
                      <td className="pr-3 num text-xs">{i.deliveryQuantity > 0 ? `${fmt(i.deliveryQuantity)} ${i.unit} · ${niceDate(i.deliveryDate)}` : '—'}</td>
                      <td><Button size="icon" variant="ghost" onClick={() => open(i)} data-testid={`button-edit-${i.id}`}><Pencil className="w-4 h-4" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? 'Edit ingredient' : 'Add ingredient'}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={set('name')} data-testid="input-name" /></div>
              {multiBatch && <p className="col-span-2 text-sm">Multiple expiry batches: use Batches / receive to correct stock quantities and dates. These totals are read-only.</p>}
              <div><Label>Quantity</Label><Input disabled={multiBatch} type="number" min={0} step="0.1" value={form.quantity} onChange={set('quantity')} data-testid="input-quantity" /></div>
              <div><Label>Unit</Label><Input disabled={multiBatch} value={form.unit} onChange={set('unit')} data-testid="input-unit" /></div>
              <div><Label>Expiry</Label><Input disabled={multiBatch} type="date" value={form.expiry} onChange={set('expiry')} data-testid="input-expiry" /></div>
              <div><Label>Cost per unit (RM)</Label><Input type="number" min={0} step="0.01" value={form.cost} onChange={set('cost')} data-testid="input-cost" /></div>
              <div className="col-span-2"><Label>Category</Label><Input value={form.category} onChange={set('category')} data-testid="input-category" /></div>
              <div><Label>Delivery quantity</Label><Input type="number" min={0} value={form.deliveryQuantity} onChange={set('deliveryQuantity')} data-testid="input-delivery-qty" /></div>
              <div><Label>Delivery date</Label><Input type="date" value={form.deliveryDate} onChange={set('deliveryDate')} data-testid="input-delivery-date" /></div>
              {formErr && <div className="col-span-2 text-xs text-destructive">{formErr}</div>}
              <Button className="col-span-2" disabled={!!formErr || add.isPending} onClick={save} data-testid="button-save-ingredient">{add.isPending ? 'Saving...' : 'Save ingredient'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Import inventory CSV</DialogTitle></DialogHeader><p className="text-sm">Legacy stock-count format. For multiple receipts, use Batches / receive. Imports cannot replace the total quantity or earliest expiry of multi-batch stock.</p><CsvImport spec={spec} /></DialogContent>
      </Dialog>
      {batchIngredient && <StockBatches key={batchIngredient.id} ingredient={batchIngredient} today={data.today} onClose={() => setBatchId(null)} />}
    </div>
  );
}
