import { type State, type Stored } from "./guard-model";

type Ingredient = State["ingredients"][number];
export function stockBatches(i: Ingredient) {
  return i.batches ?? [{ id: `legacy:${i.id}`, quantity: i.quantity, expiry: i.expiry, receivedDate: null }];
}
export function syncStock(i: Ingredient) {
  if (!i.batches) return;
  i.quantity = i.batches.reduce((n, b) => n + b.quantity, 0);
  i.expiry = i.batches.filter(b => b.quantity > 0).map(b => b.expiry).sort()[0] ?? i.expiry;
}
export function migrateBatches(s: Stored) {
  for (const i of s.ingredients) {
    i.batches ??= stockBatches(i);
    syncStock(i);
  }
}
export function safeStock(i: Ingredient, date: string) {
  return stockBatches(i).filter(b => b.expiry >= date).reduce((n, b) => n + b.quantity, 0);
}
