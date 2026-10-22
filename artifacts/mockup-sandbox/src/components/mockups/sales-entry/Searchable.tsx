import { useMemo, useState } from 'react';
import './_group.css';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const menu = [
  'Chicken rice bowl', 'Mushroom pasta', 'Lemongrass iced tea', 'Pandan cake',
  'Vegetable curry', 'Iced chocolate', 'Tomato soup', 'Grilled fish plate',
  'Mango smoothie', 'Beef noodle soup', 'Tofu salad', 'Banana bread',
  'Coconut latte', 'Roasted vegetable wrap', 'Yogurt fruit cup', 'Pumpkin soup',
  'Cold brew coffee', 'Sweet potato fritters',
];

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-sm">{children}</section>;
}

export function Searchable() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const selectedName = menu.find((name) => name === selected);
  const entries = useMemo(() => Object.entries(values), [values]);
  const quantityIsValid = /^\d+$/.test(quantity) && Number(quantity) <= 1_000_000;
  const canAdd = Boolean(selectedName) && quantityIsValid;

  const addItem = () => {
    if (!selectedName || !quantityIsValid) return;
    setValues((previous) => ({ ...previous, [selectedName]: quantity }));
    setSaved(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 font-sans text-foreground">
      <Panel>
        <div className="mb-4">
          <h2 className="text-lg font-bold">Daily entry</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Search your active menu and add only the items sold today.</p>
        </div>
        <div className="mb-4 max-w-xs">
          <Label htmlFor="searchable-sales-date">Sales date</Label>
          <Input id="searchable-sales-date" type="date" defaultValue="2026-10-21" className="mt-1" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Find an item</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between bg-background font-normal"
                >
                  <span className={cn('truncate', !selectedName && 'text-muted-foreground')}>
                    {selectedName || 'Search menu items...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type a dish or drink..." aria-label="Search menu items" />
                  <CommandList>
                    <CommandEmpty>No active items match that search.</CommandEmpty>
                    <CommandGroup heading={`${menu.length} active menu items`}>
                      {menu.map((name) => (
                        <CommandItem
                          key={name}
                          value={name}
                          onSelect={() => {
                            setSelected(name);
                            setOpen(false);
                          }}
                        >
                          <Check className={cn('h-4 w-4', selected === name ? 'opacity-100' : 'opacity-0')} />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="searchable-quantity">Amount (portions)</Label>
            <Input
              id="searchable-quantity"
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="num"
            />
          </div>
          <Button type="button" onClick={addItem} disabled={!canAdd} className="sm:mb-0.5">
            <Plus className="mr-2 h-4 w-4" /> Add item
          </Button>
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items to record</h3>
            <span className="text-xs text-muted-foreground">{entries.length} selected</span>
          </div>
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No items added yet. Search for a dish or drink above.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(([name, value]) => (
                <div key={name} className="grid grid-cols-[minmax(0,1fr)_115px_40px] items-center gap-2 rounded-lg border px-3 py-2">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <Input
                    type="number"
                    min={0}
                    max={1_000_000}
                    step={1}
                    value={value}
                    onChange={(event) => setValues((previous) => ({ ...previous, [name]: event.target.value }))}
                    aria-label={`Amount sold for ${name}`}
                    className="num h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${name}`}
                    onClick={() => setValues((previous) => {
                      const next = { ...previous };
                      delete next[name];
                      return next;
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            className="mt-3"
            disabled={!entries.length || entries.some(([, value]) => !/^\d+$/.test(value) || Number(value) > 1_000_000)}
            onClick={() => setSaved(true)}
          >
            Record {entries.length} items
          </Button>
          {saved && <p className="mt-2 text-sm font-medium text-jade">Daily sales saved in this preview.</p>}
        </div>
      </Panel>
    </main>
  );
}
