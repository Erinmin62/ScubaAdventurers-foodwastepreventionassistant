import { useState } from 'react';
import './_group.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const menu = ['Chicken rice bowl', 'Mushroom pasta', 'Lemongrass iced tea', 'Pandan cake', 'Vegetable curry'];

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-sm">{children}</section>;
}

export function Current() {
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = Object.values(values).filter((value) => value !== '');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 font-sans text-foreground">
      <Panel>
        <div className="mb-4">
          <h2 className="text-lg font-bold">Daily entry</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Leave blank to skip an item</p>
        </div>
        <div className="mb-3 max-w-xs">
          <Label htmlFor="current-sales-date">Sales date</Label>
          <Input id="current-sales-date" type="date" defaultValue="2026-10-21" className="mt-1" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {menu.map((name) => (
            <label key={name} className="flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:border-primary transition-colors">
              <span className="flex-1 text-sm font-medium">{name}</span>
              <Input
                className="num h-8 w-20"
                type="number"
                min={0}
                value={values[name] ?? ''}
                onChange={(event) => setValues((previous) => ({ ...previous, [name]: event.target.value }))}
                aria-label={`Portions sold for ${name}`}
              />
            </label>
          ))}
        </div>
        <Button className="mt-3" disabled={!filled.length}>Record {filled.length || ''} items</Button>
      </Panel>
    </main>
  );
}
