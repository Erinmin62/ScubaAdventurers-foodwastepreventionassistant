import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { getGetGuardStateQueryKey, getGetReordersQueryKey, useCreateMenuItem, useDeleteMenuItem, useDraftMenuRecipe, useImportMenuCsv, usePreviewMenuImport, useUpdateMenuItem, type MenuItem, type RecipeItem } from '@workspace/api-client-react';
import { Archive, Check, ChefHat, CirclePlus, FileUp, LoaderCircle, Pencil, Plus, RotateCcw, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, rm, useGuard } from '@/lib/guard';
import { cn } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(1, 'Give this dish a name.').max(120),
  description: z.string().max(500),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  cost: z.coerce.number().min(0, 'Cost cannot be negative.'),
  recipe: z.array(z.object({ ingredientId: z.string().min(1, 'Choose an ingredient.'), amount: z.coerce.number().positive('Use a quantity above zero.') })).min(1, 'Add at least one ingredient.'),
});
type Values = z.infer<typeof schema>;
type FormValues = z.input<typeof schema>;
const blank: Values = { name: '', description: '', price: 0, cost: 0, recipe: [{ ingredientId: '', amount: 1 }] };

export default function Menu() {
  const { data, isLoading, error, refetch } = useGuard();
  const { toast } = useToast();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getGetGuardStateQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetReordersQueryKey() });
  };
  const create = useCreateMenuItem({ mutation: { onSuccess: refresh } });
  const update = useUpdateMenuItem({ mutation: { onSuccess: refresh } });
  const remove = useDeleteMenuItem({ mutation: { onSuccess: refresh } });
  const draft = useDraftMenuRecipe();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [previewedCsv, setPreviewedCsv] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const form = useForm<FormValues, unknown, Values>({ resolver: zodResolver(schema), defaultValues: blank });
  const fields = useFieldArray({ control: form.control, name: 'recipe' });
  const previewImport = usePreviewMenuImport();
  const importMenu = useImportMenuCsv({
    mutation: {
      onSuccess: () => {
        refresh();
        const dishes = previewImport.data?.dishes ?? [];
        const updated = dishes.filter((dish) => dish.action === 'update').length;
        const added = dishes.filter((dish) => dish.action === 'add').length;
        toast({ title: 'Menu CSV applied', description: `${updated} dish${updated === 1 ? '' : 'es'} updated, ${added} added. Past sales and waste details are preserved.` });
        setImportOpen(false);
        setCsv('');
        setPreviewedCsv('');
        previewImport.reset();
      },
      onError: (e) => toast({ title: 'Could not import menu', description: errorMessage(e), variant: 'destructive' }),
    },
  });
  const active = useMemo(() => (data?.menu ?? []).filter((m) => m.archivedAt === null), [data?.menu]);
  const archived = useMemo(() => (data?.menu ?? []).filter((m) => m.archivedAt !== null), [data?.menu]);

  const beginCreate = () => {
    setEditing(null); setDraftNote('');
    form.reset({ ...blank, recipe: [{ ingredientId: data?.ingredients[0]?.id ?? '', amount: 1 }] });
    setOpen(true);
  };
  const beginEdit = (item: MenuItem) => {
    setEditing(item); setDraftNote('');
    form.reset({ name: item.name, description: item.description, price: item.price, cost: item.cost, recipe: item.recipe.map((row) => ({ ...row })) });
    setOpen(true);
  };
  const close = () => { setOpen(false); setEditing(null); };
  const resetImport = () => {
    setImportOpen(false);
    setCsv('');
    setPreviewedCsv('');
    previewImport.reset();
  };
  const previewCsv = () => {
    setPreviewedCsv('');
    previewImport.mutate({ data: { csv } }, {
      onSuccess: (_result) => setPreviewedCsv(csv),
    });
  };
  const chooseCsv = async (file?: File) => {
    if (!file) return;
    setCsv('');
    setPreviewedCsv('');
    previewImport.reset();
    if (file.size > 2_000_000) {
      toast({ title: 'CSV is too large', description: 'Choose a menu CSV that is 2 MB or smaller.', variant: 'destructive' });
      return;
    }
    try {
      setCsv(await file.text());
      setPreviewedCsv('');
      previewImport.reset();
    } catch {
      toast({ title: 'Could not read CSV', description: 'Try saving the file as UTF-8 CSV and select it again.', variant: 'destructive' });
    }
  };
  const downloadTemplate = () => {
    const template = 'dish_name,description,price,cost,ingredient_name,ingredient_unit,quantity_per_portion\n"Roasted tomato toast","Sourdough with roasted tomatoes",18,5,"Cherry tomatoes",kg,0.12';
    const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'expiryguard-menu-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const submit = (v: Values) => {
    const payload = { ...v, name: v.name.trim(), recipe: v.recipe as RecipeItem[] };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { toast({ title: 'Dish updated', description: 'The dish keeps its existing history.' }); close(); },
        onError: (e) => toast({ title: 'Could not save dish', description: errorMessage(e), variant: 'destructive' }),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: 'Dish added', description: 'It is ready for future sales and planning.' }); close(); },
        onError: (e) => toast({ title: 'Could not save dish', description: errorMessage(e), variant: 'destructive' }),
      });
    }
  };
  const runDraft = () => {
    const name = form.getValues('name').trim();
    const description = form.getValues('description').trim();
    if (name.length < 1 || description.length < 5) {
      setDraftNote('Add a dish name and at least a short description before asking for a draft.');
      return;
    }
    setDraftNote('');
    draft.mutate({ data: { name, description } }, {
      onSuccess: (response) => {
        if (!response.recipe.length) { setDraftNote('No recipe rows were returned. Add ingredients manually.'); return; }
        form.setValue('recipe', response.recipe.map((r) => ({ ingredientId: r.ingredientId, amount: r.amount })), { shouldDirty: true, shouldValidate: true });
        setDraftNote(`${response.explanation} ${response.notice}`.trim());
      },
      onError: (e) => setDraftNote(`Draft unavailable: ${errorMessage(e)} You can still build the recipe below.`),
    });
  };
  const archiveRestore = (item: MenuItem, activeNow: boolean) => {
    update.mutate({ id: item.id, data: { active: activeNow } }, {
      onSuccess: () => toast({ title: activeNow ? 'Dish restored' : 'Dish archived', description: activeNow ? 'It is available for new entries again.' : 'Past records are preserved; it will not be offered for new entries.' }),
      onError: (e) => toast({ title: 'Could not update dish', description: errorMessage(e), variant: 'destructive' }),
    });
  };
  const deleteDish = (item: MenuItem) => {
    if (!window.confirm(`Delete “${item.name}”? If it has history, the API will archive it and preserve those records.`)) return;
    remove.mutate({ id: item.id }, {
      onSuccess: (result) => {
        const remainsArchived = result.menu.some((m) => m.id === item.id && m.archivedAt !== null);
        toast({ title: remainsArchived ? 'Dish archived, history preserved' : 'Dish removed', description: remainsArchived ? 'The dish remains in historical records and is no longer available for new entries.' : 'This unused dish was permanently removed.' });
      },
      onError: (e) => toast({ title: 'Could not delete dish', description: errorMessage(e), variant: 'destructive' }),
    });
  };

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const list = showArchived ? archived : active;
  const pending = create.isPending || update.isPending || remove.isPending;
  const importReady = previewImport.data?.valid === true && previewedCsv === csv;
  const importUpdates = previewImport.data?.dishes.filter((dish) => dish.action === 'update').length ?? 0;
  const importAdds = previewImport.data?.dishes.filter((dish) => dish.action === 'add').length ?? 0;

  return <div className="space-y-5">
    <PageHeader kicker="Menu · owner-managed catalog" title="Your dishes, clearly accounted for.">
      Keep prices and per-portion ingredient quantities current. Active dishes inform new sales, demand forecasts and preparation plans; archived dishes remain available for history.
    </PageHeader>
    <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground"><UtensilsCrossed className="h-5 w-5" /></div>
        <div><div className="font-semibold" data-testid="text-menu-count">{active.length} active dish{active.length === 1 ? '' : 'es'}</div><div className="text-sm text-muted-foreground">{archived.length} archived · {data.ingredients.length} pantry ingredients available</div></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-menu"><FileUp className="mr-2 h-4 w-4" />Import menu CSV</Button>
        <Button onClick={beginCreate} data-testid="button-add-dish"><Plus className="mr-2 h-4 w-4" />Add a dish</Button>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex rounded-full bg-muted p-1">
        <button className={cn('rounded-full px-4 py-2 text-sm font-semibold', !showArchived ? 'bg-card shadow-sm' : 'text-muted-foreground')} onClick={() => setShowArchived(false)} data-testid="button-show-active">Active <span className="num ml-1">{active.length}</span></button>
        <button className={cn('rounded-full px-4 py-2 text-sm font-semibold', showArchived ? 'bg-card shadow-sm' : 'text-muted-foreground')} onClick={() => setShowArchived(true)} data-testid="button-show-archived">Archived <span className="num ml-1">{archived.length}</span></button>
      </div>
      <p className="text-xs text-muted-foreground">Recipes use your pantry’s stock units per portion.</p>
    </div>
    <Panel title={showArchived ? 'Archived dishes' : 'Active menu'} sub={showArchived ? 'Kept for historic labels and reporting; excluded from new entries and future planning.' : 'These dishes can be selected for new daily records and future demand planning.'}>
      {list.length === 0 ? <EmptyState title={showArchived ? 'No archived dishes' : 'Your menu is ready for its first dish'} body={showArchived ? 'Archived dishes will stay listed here for historical reference.' : 'Add a dish and its recipe to connect daily sales with pantry stock.'} /> :
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{list.map((item) => {
          const margin = item.price - item.cost;
          return <article key={item.id} className="lift rounded-2xl border bg-background/60 p-4" data-testid={`card-menu-${item.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-lg font-bold">{item.name}</h2>{item.archivedAt && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Archived</span>}</div>
                <p className="mt-1 min-h-10 text-sm leading-relaxed text-muted-foreground">{item.description || 'No description yet.'}</p></div>
              <div className="shrink-0 text-right"><div className="num text-base font-semibold">{rm(item.price)}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">price</div></div>
            </div>
            <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs">
              <div><span className="text-muted-foreground">Cost </span><span className="num font-semibold">{rm(item.cost)}</span></div>
              <div><span className="text-muted-foreground">Margin </span><span className="num font-semibold text-jade">{rm(margin)}</span></div>
              <div className="ml-auto text-muted-foreground">{item.recipe.length} ingredient{item.recipe.length === 1 ? '' : 's'}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!showArchived && <Button variant="outline" size="sm" onClick={() => beginEdit(item)} data-testid={`button-edit-${item.id}`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}
              <Button variant="outline" size="sm" onClick={() => archiveRestore(item, !!item.archivedAt)} disabled={update.isPending} data-testid={`button-${item.archivedAt ? 'restore' : 'archive'}-${item.id}`}>
                {item.archivedAt ? <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> : <Archive className="mr-1.5 h-3.5 w-3.5" />}{item.archivedAt ? 'Restore' : 'Archive'}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteDish(item)} disabled={remove.isPending} data-testid={`button-delete-${item.id}`}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
            </div>
          </article>;
        })}</div>}
    </Panel>

    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dish-form-title" className="rise max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-card p-5 shadow-xl md:p-7" data-testid="dialog-menu-editor">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div><div className="text-xs font-bold uppercase tracking-[.18em] text-primary">{editing ? 'Edit dish' : 'New dish'}</div><h2 id="dish-form-title" className="mt-1 text-2xl font-bold">{editing ? editing.name : 'Add to your menu'}</h2><p className="mt-1 text-sm text-muted-foreground">An owner-reviewed recipe draft; nothing is saved until you choose Save.</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close editor" onClick={close} data-testid="button-close-menu-editor"><X className="h-4 w-4" /></Button>
        </header>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Dish name</FormLabel><FormControl><Input {...field} placeholder="e.g. Citrus ricotta toast" data-testid="input-dish-name" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="A short menu description" data-testid="input-dish-description" /></FormControl><FormMessage /></FormItem>} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => <FormItem><FormLabel>Menu price · RM</FormLabel><FormControl><Input {...field} type="number" min="0" step="0.01" data-testid="input-dish-price" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="cost" render={({ field }) => <FormItem><FormLabel>Estimated cost · RM / portion</FormLabel><FormControl><Input {...field} type="number" min="0" step="0.01" data-testid="input-dish-cost" /></FormControl><FormMessage /></FormItem>} />
            </div>
            <div className="rounded-2xl border bg-background/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold">Recipe per portion</h3><p className="text-xs text-muted-foreground">Enter each ingredient in the same unit used in your pantry.</p></div>
                <Button type="button" variant="outline" size="sm" onClick={runDraft} disabled={draft.isPending} data-testid="button-draft-recipe">
                  {draft.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Draft recipe
                </Button>
              </div>
              {data.ingredients.length === 0 ? <div className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm">Add ingredients to your pantry before building a recipe.</div> : <div className="space-y-2">
                {fields.fields.map((f, index) => <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2 items-end" data-testid={`row-recipe-${index}`}>
                  <FormField control={form.control} name={`recipe.${index}.ingredientId`} render={({ field }) => <FormItem><FormLabel className="text-xs">Ingredient</FormLabel><FormControl><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...field} data-testid={`select-recipe-ingredient-${index}`}><option value="">Select ingredient</option>{data.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.unit}</option>)}</select></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name={`recipe.${index}.amount`} render={({ field }) => <FormItem><FormLabel className="text-xs">Amount</FormLabel><FormControl><Input {...field} type="number" min="0.001" step="any" data-testid={`input-recipe-amount-${index}`} /></FormControl><FormMessage /></FormItem>} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove recipe row" onClick={() => fields.remove(index)} disabled={fields.fields.length <= 1} data-testid={`button-remove-recipe-row-${index}`}><X className="h-4 w-4" /></Button>
                </div>)}
              </div>}
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => fields.append({ ingredientId: data.ingredients[0]?.id ?? '', amount: 1 })} data-testid="button-add-recipe-row"><CirclePlus className="mr-1.5 h-4 w-4" />Add ingredient</Button>
              {draftNote && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed" role="status" data-testid="text-recipe-draft-note"><ChefHat className="mr-1.5 inline h-3.5 w-3.5 text-primary" />{draftNote}</div>}
            </div>
            <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-xs leading-relaxed text-foreground" data-testid="notice-food-safety"><strong>Owner check required:</strong> Verify every quantity, allergen information, and food safety before using this recipe. AI drafts are suggestions only.</div>
            <footer className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={close} data-testid="button-cancel-dish">Cancel</Button>
              <Button type="submit" disabled={pending || data.ingredients.length === 0} data-testid="button-save-dish">{pending ? 'Saving…' : editing ? <><Check className="mr-2 h-4 w-4" />Save changes</> : <><Plus className="mr-2 h-4 w-4" />Save dish</>}</Button>
            </footer>
          </form>
        </Form>
      </section>
    </div>}

    {importOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !importMenu.isPending) resetImport(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="menu-import-title" className="rise max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-card p-5 shadow-xl md:p-7" data-testid="dialog-menu-import">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div><div className="text-xs font-bold uppercase tracking-[.18em] text-primary">Bulk menu setup</div><h2 id="menu-import-title" className="mt-1 text-2xl font-bold">Import dishes and recipes</h2><p className="mt-1 text-sm text-muted-foreground">Matching active dishes will be updated; new names will be added. Preview validates all rows against your pantry. Past sales and waste details stay unchanged, and nothing is saved until you confirm a fully valid file.</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close menu import" disabled={importMenu.isPending} onClick={resetImport}><X className="h-4 w-4" /></Button>
        </header>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/70 p-3 text-sm">
            <p>Use one row per recipe ingredient. Repeat the dish details on each row; ingredient names and units must match your pantry.</p>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-menu-template">Download CSV template</Button>
          </div>
          <label className="block space-y-2 text-sm font-medium">Choose a CSV file
            <Input type="file" accept=".csv,text/csv" disabled={importMenu.isPending} onChange={(event) => { void chooseCsv(event.target.files?.[0]); }} data-testid="input-menu-csv-file" />
          </label>
          <details className="rounded-xl border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Required columns and format</summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">dish_name, description, price, cost, ingredient_name, ingredient_unit, quantity_per_portion. Amounts are per portion in the pantry unit (for example, kg, L, or pcs). CSV files may be up to 2 MB and include at most 250 dishes.</p>
          </details>
          {csv && <div className="rounded-xl border bg-background/60 p-3 text-xs text-muted-foreground" data-testid="text-menu-csv-loaded">{csv.length.toLocaleString()} characters loaded. Select another file to replace it.</div>}
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={previewCsv} disabled={!csv || previewImport.isPending || importMenu.isPending} data-testid="button-preview-menu-csv">
              {previewImport.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Preview and validate
            </Button>
          </div>
          {previewImport.error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage(previewImport.error)}</div>}
          {previewImport.data && previewedCsv === csv && <>
            <div className={`rounded-xl border p-3 text-sm ${previewImport.data.valid ? 'border-jade/40 bg-jade/5' : 'border-destructive/40 bg-destructive/5'}`} role={previewImport.data.valid ? 'status' : 'alert'} data-testid="menu-csv-preview-result">
              <strong>{previewImport.data.valid ? 'Ready to apply' : 'Fix the CSV before importing'}</strong>
              <span className="ml-2">{importUpdates} update{importUpdates === 1 ? '' : 's'} and {importAdds} add{importAdds === 1 ? '' : 's'}.</span>
            </div>
            {previewImport.data.dishes.length > 0 && <div className="max-h-56 overflow-auto rounded-xl border" data-testid="menu-csv-preview-dishes">
              <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted text-xs"><tr><th className="p-2">Action</th><th className="p-2">Dish</th><th className="p-2">Description</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Cost</th><th className="p-2">Per-portion recipe</th></tr></thead>
                <tbody>{previewImport.data.dishes.map((dish, index) => <tr key={`${dish.name}-${index}`} className="border-t align-top"><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${dish.action === 'update' ? 'bg-primary/10 text-primary' : 'bg-jade/10 text-jade'}`} data-testid={`menu-csv-action-${index}`}>{dish.action === 'update' ? 'Update' : 'Add'}</span></td><td className="p-2 font-medium">{dish.name}</td><td className="p-2 text-xs">{dish.description || '—'}</td><td className="p-2 text-right num">{rm(dish.price)}</td><td className="p-2 text-right num">{rm(dish.cost)}</td><td className="p-2 text-xs leading-relaxed">{dish.ingredients.map((ingredient, ingredientIndex) => <div key={`${ingredient.name}-${ingredientIndex}`}><span className="num">{ingredient.quantityPerPortion.toLocaleString(undefined, { maximumFractionDigits: 6 })} {ingredient.unit}</span> {ingredient.name}</div>)}</td></tr>)}</tbody>
              </table>
            </div>}
            {previewImport.data.errors.length > 0 && <ul className="max-h-40 space-y-1 overflow-auto rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" data-testid="menu-csv-preview-errors">
              {previewImport.data.errors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
            </ul>}
          </>}
          <footer className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={resetImport} disabled={importMenu.isPending} data-testid="button-cancel-menu-import">Cancel</Button>
            <Button type="button" onClick={() => previewImport.data && importMenu.mutate({ data: { csv, expectedMenuRevision: previewImport.data.menuRevision } })} disabled={!importReady || importMenu.isPending} data-testid="button-confirm-menu-import">
              {importMenu.isPending ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Applying…</> : <><FileUp className="mr-2 h-4 w-4" />Apply {previewImport.data?.dishCount ?? 0} dishes</>}
            </Button>
          </footer>
        </div>
      </section>
    </div>}
  </div>;
}
