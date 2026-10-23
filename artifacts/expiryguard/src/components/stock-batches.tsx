import { useState } from 'react';
import type { Ingredient, StockBatch } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetGuardStateQueryKey, getGetReordersQueryKey, useSaveIngredientBatch } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, fmt, isDate } from '@/lib/guard';

export function StockBatches({ ingredient, today, onClose }: { ingredient: Ingredient; today: string; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useSaveIngredientBatch({ mutation: { onSuccess: () => {
    qc.invalidateQueries({ queryKey: getGetGuardStateQueryKey() });
    qc.invalidateQueries({ queryKey: getGetReordersQueryKey() });
  } } });
  const blank = () => ({ id: undefined as string | undefined, quantity: '', expiry: today, receivedDate: today as string | null });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const edit = (batch: StockBatch) => {
    setForm({ id: batch.id, quantity: String(batch.quantity), expiry: batch.expiry, receivedDate: batch.receivedDate });
    setError('');
  };
  const valid = form.quantity.trim() !== '' && Number.isFinite(Number(form.quantity)) &&
    Number(form.quantity) >= 0 && Number(form.quantity) <= 1000000 &&
    (ingredient.unit !== 'pcs' || Number.isInteger(Number(form.quantity))) &&
    isDate(form.expiry) && (form.receivedDate === null || (isDate(form.receivedDate) && form.receivedDate <= today && form.receivedDate <= form.expiry));
  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Received batches · {ingredient.name}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">On hand: {fmt(ingredient.quantity, 2)} {ingredient.unit}. Expiry dates apply to individual batches. Set remaining quantity to zero for depleted or discarded stock.</p>
      <p className="text-sm">Planned delivery: {fmt(ingredient.deliveryQuantity)} {ingredient.unit} on {ingredient.deliveryDate}. Not received stock. Recording a receipt does not clear this plan; reconcile it separately in the ingredient editor.</p>
      <div className="space-y-2">
        {[...(ingredient.batches ?? [])].sort((a, b) => a.expiry.localeCompare(b.expiry)).map(b => <div key={b.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
          <div className="text-sm"><strong>{fmt(b.quantity, 2)} {ingredient.unit}</strong> · expires {b.expiry}
            <div className="text-xs text-muted-foreground">Received {b.receivedDate ?? 'unknown (legacy stock)'} · {b.quantity === 0 ? 'Depleted' : b.expiry < today ? 'Expired — isolate, never use' : b.expiry === today ? 'Expires today — excluded from tomorrow' : 'Safe until expiry'}</div>
          </div>
          <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => edit(b)}>Edit batch</Button>
        </div>)}
      </div>
      <div className="flex justify-between items-center"><h3 className="font-semibold">{form.id ? 'Correct remaining stock' : 'Record a received batch'}</h3><Button variant="ghost" disabled={save.isPending} onClick={() => { setForm(blank()); setError(''); }}>New receipt</Button></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="batch-quantity">{form.id ? 'Remaining quantity' : 'Received quantity'} ({ingredient.unit})</Label><Input id="batch-quantity" type="number" min={0} max={1000000} step={ingredient.unit === 'pcs' ? 1 : '0.01'} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
        <div><Label htmlFor="batch-expiry">Expiry date</Label><Input id="batch-expiry" type="date" value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} /></div>
        <div className="col-span-2"><Label htmlFor="batch-received">Actual receipt date</Label><Input id="batch-received" type="date" max={today} value={form.receivedDate ?? ''} onChange={e => setForm({ ...form, receivedDate: e.target.value })} />{form.receivedDate === null && <p className="text-xs text-muted-foreground">Unknown legacy receipt date. Leave unchanged unless known.</p>}</div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={!valid || save.isPending} onClick={() => {
        setError('');
        save.mutate({ id: ingredient.id, data: { ...form, quantity: Number(form.quantity) } }, {
          onSuccess: () => setForm(blank()),
          onError: e => setError(errorMessage(e)),
        });
      }}>{save.isPending ? 'Saving…' : form.id ? 'Save batch correction' : 'Confirm received stock'}</Button>
    </DialogContent>
  </Dialog>;
}
