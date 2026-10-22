import { useRef, useState } from 'react';
import { AlertTriangle, Download, FileUp } from 'lucide-react';
import type { GuardState, HistoricalRecordInput } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { addDays, downloadCsv, errorMessage, isNum, parseCsv, useHistoricalRecords } from '@/lib/guard';
import { Button } from '@/components/ui/button';

const columns = ['kind', 'date', 'menuId', 'itemName', 'quantity', 'unit', 'prepared', 'sold', 'leftover'];
const template = (today: string, menuId: string, ingredientName: string, ingredientUnit: string) => [
  columns.join(','),
  `sales,${addDays(today, -1)},${menuId},,24,portions,,,`,
  `preparation,${addDays(today, -1)},${menuId},,,portions,30,27,3`,
  `stock,${addDays(today, -1)},,${ingredientName},2,${ingredientUnit},,,`,
].join('\n') + '\n';

function strictDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function amount(value: string, whole = false) {
  if (!isNum(value)) return null;
  const n = Number(value);
  if (n > 1_000_000 || (whole && !Number.isInteger(n))) return null;
  return n;
}

function validateRow(row: Record<string, string>, today: string, state: GuardState): { input?: HistoricalRecordInput; error?: string } {
  if (!strictDate(row.date ?? '')) return { error: 'date must be a real YYYY-MM-DD calendar date.' };
  if (row.date > today) return { error: 'date cannot be in the future.' };

  if (row.kind === 'sales' || row.kind === 'preparation') {
    const menuId = row.menuId?.trim();
    if (!menuId) return { error: 'menuId is required for sales and preparation records.' };
    if (!state.menu.some(item => item.id === menuId)) return { error: `unknown menuId "${menuId}".` };
    if (row.unit !== 'portions') return { error: 'unit must be portions for sales and preparation records.' };
    if (row.kind === 'sales') {
      const quantity = amount(row.quantity ?? '', true);
      if (quantity === null) return { error: 'quantity must be a whole number of portions from 0 to 1,000,000.' };
      if (row.prepared || row.sold || row.leftover) return { error: 'sales rows must leave prepared, sold, and leftover blank.' };
      return { input: { kind: 'sales', date: row.date, menuId, quantity, unit: 'portions' } };
    }
    const prepared = amount(row.prepared ?? '', true);
    const sold = amount(row.sold ?? '', true);
    const leftover = amount(row.leftover ?? '', true);
    if (prepared === null || sold === null || leftover === null) return { error: 'prepared, sold, and leftover must each be whole portions from 0 to 1,000,000.' };
    if (prepared !== sold + leftover) return { error: 'prepared must equal sold + leftover.' };
    if (row.quantity) return { error: 'preparation rows must leave quantity blank.' };
    return { input: { kind: 'preparation', date: row.date, menuId, unit: 'portions', prepared, sold, leftover } };
  }

  if (row.kind !== 'stock') return { error: 'kind must be sales, preparation, or stock.' };
  const itemName = row.itemName?.trim();
  if (!itemName || itemName.length > 160) return { error: 'itemName is required and must be 160 characters or fewer.' };
  const quantity = amount(row.quantity ?? '');
  if (quantity === null) return { error: 'quantity must be a number from 0 to 1,000,000.' };
  if (!['kg', 'L', 'pcs'].includes(row.unit ?? '')) return { error: 'unit must be kg, L, or pcs for stock records.' };
  const ingredient = state.ingredients.find(item => item.name.toLowerCase() === itemName.toLowerCase());
  if (ingredient && ingredient.unit !== row.unit) return { error: `unit must match ${ingredient.name} (${ingredient.unit}).` };
  if (row.menuId || row.prepared || row.sold || row.leftover) return { error: 'stock rows must leave menuId, prepared, sold, and leftover blank.' };
  return { input: { kind: 'stock', date: row.date, itemName, quantity, unit: row.unit as 'kg' | 'L' | 'pcs' } };
}

export function HistoricalImport({ state }: { state: GuardState }) {
  const { importRecords } = useHistoricalRecords();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [readyRows, setReadyRows] = useState<HistoricalRecordInput[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const menuId = state.menu[0]?.id ?? '';
  const ingredient = state.ingredients[0] ?? { name: 'Coffee beans', unit: 'kg' };
  const csvTemplate = template(state.today, menuId || 'menu-id', ingredient.name, ingredient.unit);

  const onFile = async (selected: File) => {
    setFile(selected.name);
    setRows([]);
    setReadyRows([]);
    if (selected.size > 2_000_000) {
      setErrors(['File is larger than 2 MB. Split it into smaller files of up to 2,000 rows each.']);
      return;
    }
    const parsed = parseCsv(await selected.text());
    const nextErrors: string[] = [];
    if (!parsed.length) nextErrors.push('No data rows found. The first line must be the column header.');
    const headers = parsed[0] ? Object.keys(parsed[0]) : [];
    for (const name of ['kind', 'date']) if (parsed.length && !headers.includes(name)) nextErrors.push(`Missing required column "${name}".`);
    for (const name of headers) if (!columns.includes(name)) nextErrors.push(`Unknown column "${name}". Remove it or use the template.`);
    if (parsed.length > 2000) nextErrors.push('Maximum 2,000 rows per import.');
    const inputs: HistoricalRecordInput[] = [];
    parsed.forEach((row, index) => {
      const result = validateRow(row, state.today, state);
      if (result.error) nextErrors.push(`Row ${index + 2}: ${result.error}`);
      else if (result.input) inputs.push(result.input);
    });
    setRows(parsed);
    setReadyRows(inputs);
    setErrors(nextErrors);
  };

  const submit = () => {
    importRecords.mutate({ data: { rows: readyRows } }, {
      onSuccess: (result) => {
        toast({ title: `Imported ${result.records.length} historical records`, description: `${file} · kept separate from live sales, stock, orders, and AI inputs.` });
        setRows([]);
        setReadyRows([]);
        setFile('');
        setErrors([]);
      },
      onError: error => toast({ title: 'Import failed', description: errorMessage(error), variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These dated sales, preparation, leftover, and stock records are saved as a separate history archive. Importing does not update today’s stock, live forecasts, or orders, and the archive is not sent to AI.
      </p>
      <div className="rounded-xl bg-muted/50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">CSV columns</div>
        <p className="text-xs text-muted-foreground">
          Use <code>sales</code> or <code>preparation</code> with an existing menuId and <code>unit=portions</code>. Use <code>stock</code> with an itemName, quantity, and unit of kg, L, or pcs. Dates must be YYYY-MM-DD and cannot be in the future.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadCsv('historical-records-template.csv', csvTemplate)} data-testid="button-template-historical">
          <Download className="mr-1 h-4 w-4" />Download template
        </Button>
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} data-testid="button-choose-historical">
          <FileUp className="mr-1 h-4 w-4" />Choose CSV
        </Button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => {
          const selected = event.target.files?.[0];
          if (selected) void onFile(selected);
          event.target.value = '';
        }} />
      </div>
      {file && <div className="text-sm"><span className="font-semibold">{file}</span> <span className="text-muted-foreground">— {rows.length} rows reviewed</span></div>}
      {errors.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-xl border border-destructive/30 bg-destructive/5 p-3" data-testid="text-historical-import-errors">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />{errors.length} issue{errors.length === 1 ? '' : 's'} — correct the file before importing
          </div>
          {errors.slice(0, 30).map((error, index) => <div key={index} className="text-xs">{error}</div>)}
        </div>
      )}
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-44 overflow-auto rounded-lg border text-xs">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted"><tr>{Object.keys(rows[0]!).map(name => <th key={name} className="p-1.5 text-left">{name}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 8).map((row, index) => <tr key={index} className="border-t">{Object.values(row).map((value, cell) => <td key={cell} className="p-1.5">{value}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground">{rows.length > 8 ? 'Showing first 8 rows. ' : ''}{readyRows.length} valid row{readyRows.length === 1 ? '' : 's'}.</div>
          <Button onClick={submit} disabled={errors.length > 0 || readyRows.length !== rows.length || importRecords.isPending} data-testid="button-import-historical">
            {importRecords.isPending ? 'Importing…' : `Import ${readyRows.length} historical rows`}
          </Button>
        </div>
      )}
    </div>
  );
}
