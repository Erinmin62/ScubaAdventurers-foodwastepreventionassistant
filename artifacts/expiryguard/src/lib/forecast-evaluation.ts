import type { GuardState } from '@workspace/api-client-react';

type Metric = {
  mae: number;
  wape: number | null;
  observations: number;
};

export type ForecastEvaluation = {
  testedFrom: string | null;
  testedThrough: string | null;
  heldOutDays: number;
  sales: { rules: Metric; priorWeek: Metric };
  waste: { rules: Metric; priorWeek: Metric };
};

type Observation = {
  date: string;
  menuId: string;
  actualSales: number;
  actualWaste: number;
  predictedSales: number;
  predictedWaste: number;
  priorWeekSales: number;
  priorWeekWaste: number;
};

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function weekdayFactor(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? 1.15 : 0.97;
}

function metric(predictions: { predicted: number; actual: number }[]): Metric {
  if (predictions.length === 0) return { mae: 0, wape: null, observations: 0 };
  const absoluteError = predictions.reduce((sum, row) => sum + Math.abs(row.predicted - row.actual), 0);
  const actualTotal = predictions.reduce((sum, row) => sum + Math.abs(row.actual), 0);
  return {
    mae: absoluteError / predictions.length,
    wape: actualTotal > 0 ? (absoluteError / actualTotal) * 100 : null,
    observations: predictions.length,
  };
}

/**
 * Replays the live seven-day sales rule over dates it did not train on.
 * The prior-week comparator uses only the matching weekday from the previous week.
 */
export function evaluateForecastHistory(
  state: Pick<GuardState, 'sales' | 'results' | 'menu'>,
): ForecastEvaluation {
  const activeMenu = state.menu.filter((item) => item.archivedAt === null);
  const salesByDay = new Map<string, Map<string, number>>();
  for (const row of state.sales) {
    const byMenu = salesByDay.get(row.date) ?? new Map<string, number>();
    byMenu.set(row.menuId, (byMenu.get(row.menuId) ?? 0) + row.portions);
    salesByDay.set(row.date, byMenu);
  }

  const resultsByDay = new Map<string, Map<string, number>>();
  for (const row of state.results) {
    const byMenu = resultsByDay.get(row.date) ?? new Map<string, number>();
    byMenu.set(row.menuId, (byMenu.get(row.menuId) ?? 0) + row.leftover);
    resultsByDay.set(row.date, byMenu);
  }

  const completeDates = [...resultsByDay.keys()].sort();
  const heldOutDates = completeDates.slice(-7);
  const observations: Observation[] = [];

  for (const date of heldOutDates) {
    const previousSevenDays = Array.from({ length: 7 }, (_, index) => shiftDate(date, index - 7));
    const priorWeekDate = previousSevenDays[0]!;
    for (const item of activeMenu) {
      const actualSales = salesByDay.get(date)?.get(item.id);
      const actualWaste = resultsByDay.get(date)?.get(item.id);
      const trainingSales = previousSevenDays.map((day) => salesByDay.get(day)?.get(item.id));
      const trainingWaste = previousSevenDays.map((day) => resultsByDay.get(day)?.get(item.id));

      // Missing days are unknown, not zero. Do not score incomplete windows.
      if (
        actualSales === undefined ||
        actualWaste === undefined ||
        trainingSales.some((value) => value === undefined) ||
        trainingWaste.some((value) => value === undefined)
      ) continue;

      const factor = weekdayFactor(date);
      observations.push({
        date,
        menuId: item.id,
        actualSales,
        actualWaste,
        predictedSales: Math.max(0, Math.round((trainingSales as number[]).reduce((sum, value) => sum + value, 0) / 7 * factor)),
        predictedWaste: Math.max(0, Math.round((trainingWaste as number[]).reduce((sum, value) => sum + value, 0) / 7 * factor)),
        priorWeekSales: salesByDay.get(priorWeekDate)?.get(item.id) ?? 0,
        priorWeekWaste: resultsByDay.get(priorWeekDate)?.get(item.id) ?? 0,
      });
    }
  }

  const evaluatedDates = [...new Set(observations.map((row) => row.date))].sort();
  const toMetric = (predicted: (row: Observation) => number, actual: (row: Observation) => number) =>
    metric(observations.map((row) => ({ predicted: predicted(row), actual: actual(row) })));

  return {
    testedFrom: evaluatedDates[0] ?? null,
    testedThrough: evaluatedDates.at(-1) ?? null,
    heldOutDays: evaluatedDates.length,
    sales: {
      rules: toMetric((row) => row.predictedSales, (row) => row.actualSales),
      priorWeek: toMetric((row) => row.priorWeekSales, (row) => row.actualSales),
    },
    waste: {
      rules: toMetric((row) => row.predictedWaste, (row) => row.actualWaste),
      priorWeek: toMetric((row) => row.priorWeekWaste, (row) => row.actualWaste),
    },
  };
}
