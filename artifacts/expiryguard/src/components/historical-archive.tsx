import { useState } from 'react';
import type { HistoricalBatch } from '@workspace/api-client-react';
import { EmptyState, Panel } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, niceDate, useHistoricalRecords } from '@/lib/guard';

export function HistoricalArchive() {
  const { records, removeBatch } = useHistoricalRecords();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<HistoricalBatch | null>(null);
  const selected = records.data?.batches.find(batch => batch.id === selectedId);
  const rows = records.data?.records.filter(record => record.batchId === selectedId) ?? [];

  const remove = () => {
    if (!confirm || removeBatch.isPending) return;
    removeBatch.mutate({ batchId: confirm.id, data: { confirmed: true } }, {
      onSuccess: () => {
        setConfirm(null);
        setSelectedId(null);
        toast({ title: 'Archive batch removed', description: 'Live sales, stock, results, and orders are unchanged.' });
      },
      onError: error => toast({ title: 'Batch not removed', description: errorMessage(error), variant: 'destructive' }),
    });
  };

  return <Panel title="Imported historical archive" sub="Review and remove imports here. Live sales, stock, results, orders, and forecasting inputs are unchanged.">
    {records.isLoading ? <div className="text-sm text-muted-foreground">Loading archived records…</div> :
      records.error ? <div className="text-sm text-destructive">Could not load archived records. <Button variant="outline" size="sm" onClick={() => records.refetch()}>Try again</Button></div> :
        !records.data?.batches.length ? <EmptyState title="No archived records yet" body="Import past sales, preparation, leftover, and stock history from the Sales page." /> :
          <div className="space-y-3">
            {records.data.batches.map(batch => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" data-testid={`archive-batch-${batch.id}`}>
              <div className="min-w-0 flex-1">
                <div className="break-all text-sm font-medium">{batch.fileName}</div>
                <div className="text-xs text-muted-foreground">Imported {new Date(batch.importedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} MYT · {batch.recordCount} rows</div>
                <div className="break-all text-xs text-muted-foreground">Batch: {batch.id}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedId(batch.id)} data-testid={`button-review-batch-${batch.id}`}>Review batch</Button>
            </div>)}
            {selected && <section className="space-y-3 rounded-xl border p-3" data-testid="archive-batch-review">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 break-all text-sm font-medium">{selected.fileName} · all {rows.length} rows</h3>
                <Button variant="destructive" size="sm" disabled={removeBatch.isPending} onClick={() => setConfirm(selected)} data-testid="button-remove-archive-batch">Remove this batch</Button>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Date</th><th>Type</th><th>Item</th><th className="text-right">Details</th></tr></thead>
                  <tbody>{rows.map(record => <tr key={record.id} className="border-b" data-testid={`row-archived-history-${record.id}`}>
                    <td className="whitespace-nowrap py-2">{niceDate(record.date)}</td>
                    <td className="capitalize">{record.kind}</td><td>{record.menuName ?? record.itemName ?? '—'}</td>
                    <td className="text-right">{record.kind === 'preparation' ? `Prepared ${record.prepared} · sold ${record.sold} · leftover ${record.leftover} ${record.unit}` : `${record.quantity} ${record.unit}`}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>}
          </div>}
    <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open && !removeBatch.isPending) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this archive batch permanently?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            Remove all {confirm?.recordCount} rows from “{confirm?.fileName}”? This cannot be undone; you will need the original file to import it again. Live sales, stock, results, and orders will not change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeBatch.isPending}>Keep batch</AlertDialogCancel>
          <Button variant="destructive" onClick={remove} disabled={removeBatch.isPending} data-testid="button-confirm-remove-batch">{removeBatch.isPending ? 'Removing…' : 'Permanently remove batch'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Panel>;
}
