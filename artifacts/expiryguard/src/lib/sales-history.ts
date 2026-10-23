import type { GuardState } from '@workspace/api-client-react';

type SalesHistoryInput = Pick<GuardState, 'sales' | 'menu'>;

export type SalesPeriodSummary = {
  items: {
    id: string;
    name: string;
    portions: number;
    revenue: number;
  }[];
  portions: number;
  revenue: number;
};

export type SalesHistoryGroup = {
  date: string;
  items: {
    id: string;
    name: string;
    portions: number;
    revenue: number;
    searchNames: Set<string>;
  }[];
  portions: number;
  revenue: number;
};

export function buildSalesHistoryGroups(
  { sales, menu }: SalesHistoryInput,
  historyDate: string,
  historySearch: string,
): SalesHistoryGroup[] {
  const allDates = [...new Set(sales.map((sale) => sale.date.slice(0, 10)))].sort().reverse();
  const dates = historyDate ? allDates.filter((salesDate) => salesDate === historyDate) : allDates.slice(0, 14);
  const query = historySearch.trim().toLocaleLowerCase();

  return dates.flatMap((salesDate) => {
    const items = new Map<string, SalesHistoryGroup['items'][number]>();
    for (const sale of sales) {
      if (sale.date.slice(0, 10) !== salesDate) continue;
      const item = menu.find((menuItem) => menuItem.id === sale.menuId);
      const name = sale.menuName ?? item?.name ?? sale.menuId;

      const existing = items.get(sale.menuId) ?? {
        id: sale.menuId,
        name,
        portions: 0,
        revenue: 0,
        searchNames: new Set<string>(),
      };
      existing.searchNames.add(name);
      if (item?.name) existing.searchNames.add(item.name);
      existing.portions += sale.portions;
      existing.revenue += sale.portions * (sale.menuPrice ?? item?.price ?? 0);
      items.set(sale.menuId, existing);
    }

    const rows = [...items.values()]
      .filter((item) => !query || [...item.searchNames].some((name) => name.toLocaleLowerCase().includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (rows.length === 0) return [];
    return [{
      date: salesDate,
      items: rows,
      portions: rows.reduce((sum, item) => sum + item.portions, 0),
      revenue: rows.reduce((sum, item) => sum + item.revenue, 0),
    }];
  });
}

export function buildSalesPeriodSummary(
  { sales, menu }: SalesHistoryInput,
  fromDate: string,
  toDate: string,
): SalesPeriodSummary {
  const items = new Map<string, SalesPeriodSummary['items'][number]>();

  for (const sale of sales) {
    const saleDate = sale.date.slice(0, 10);
    if (saleDate < fromDate || saleDate > toDate) continue;

    const menuItem = menu.find((item) => item.id === sale.menuId);
    const item = items.get(sale.menuId) ?? {
      id: sale.menuId,
      name: sale.menuName ?? menuItem?.name ?? sale.menuId,
      portions: 0,
      revenue: 0,
    };
    item.portions += sale.portions;
    item.revenue += sale.portions * (sale.menuPrice ?? menuItem?.price ?? 0);
    items.set(sale.menuId, item);
  }

  const rows = [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    items: rows,
    portions: rows.reduce((sum, item) => sum + item.portions, 0),
    revenue: rows.reduce((sum, item) => sum + item.revenue, 0),
  };
}
