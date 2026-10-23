import type { GuardState } from '@workspace/api-client-react';

type ImpactInput = {
  summary: Pick<GuardState['summary'], 'estimatedSavings' | 'baselineWasteCost' | 'actualWasteCost' | 'baselineWasteKg' | 'actualWasteKg'>;
  recommendations: Pick<GuardState['recommendations'][number], 'type' | 'status' | 'savings'>[];
};

type WasteResult = Pick<GuardState['results'][number], 'date' | 'leftover' | 'menuCost'>;

type WasteWindow = {
  from: string;
  through: string;
  rows: number;
  recordedDays: number;
  leftoverPortions: number;
  leftoverCost: number | null;
  costRows: number;
};

export type WasteHistoryComparison = {
  earlier: WasteWindow;
  recent: WasteWindow;
  portionDelta: number | null;
  costDelta: number | null;
};

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function wasteWindow(results: WasteResult[], from: string, through: string): WasteWindow {
  const rows = results.filter(result => result.date >= from && result.date <= through);
  const knownCosts = rows.filter(result => Number.isFinite(result.menuCost));
  return {
    from,
    through,
    rows: rows.length,
    recordedDays: new Set(rows.map(result => result.date)).size,
    leftoverPortions: rows.reduce((sum, result) => sum + result.leftover, 0),
    // A partial sum would understate cost, so report cost only when every row
    // in the window has a saved per-portion cost snapshot.
    leftoverCost: rows.length > 0 && knownCosts.length === rows.length
      ? Math.round(knownCosts.reduce((sum, result) => sum + result.leftover * result.menuCost!, 0) * 100) / 100
      : null,
    costRows: knownCosts.length,
  };
}

/**
 * Compare two adjacent seven-calendar-day windows from owner-entered results.
 * Unrecorded days remain unknown, and cost is unavailable if any row lacks its
 * saved cost snapshot; this is an observed comparison, not a causal estimate.
 */
export function wasteHistoryComparison(results: WasteResult[], today: string): WasteHistoryComparison {
  const recentFrom = shiftDate(today, -6);
  const earlierFrom = shiftDate(today, -13);
  const earlier = wasteWindow(results, earlierFrom, shiftDate(today, -7));
  const recent = wasteWindow(results, recentFrom, today);
  const comparable = earlier.rows > 0 && recent.rows > 0;
  return {
    earlier,
    recent,
    portionDelta: comparable ? earlier.leftoverPortions - recent.leftoverPortions : null,
    costDelta: comparable && earlier.leftoverCost !== null && recent.leftoverCost !== null
      ? Math.round((earlier.leftoverCost - recent.leftoverCost) * 100) / 100
      : null,
  };
}

/** Separate estimates and recorded comparisons; never combine these into cash saved. */
export function impactNumbers(data: ImpactInput) {
  const s = data.summary;
  const pendingPurchases = data.recommendations.filter(r => r.status === 'pending' && r.type === 'purchase');
  return {
    pendingPotential: Math.round(pendingPurchases.reduce((total, r) => total + Math.max(0, r.savings), 0) * 100) / 100,
    pendingCount: pendingPurchases.filter(r => r.savings > 0).length,
    approvedProjection: s.estimatedSavings,
    wasteDelta: Math.round((s.baselineWasteCost - s.actualWasteCost) * 100) / 100,
    kgDelta: Math.round((s.baselineWasteKg - s.actualWasteKg) * 100) / 100,
    baselineCost: s.baselineWasteCost,
    recentCost: s.actualWasteCost,
    baselineKg: s.baselineWasteKg,
    recentKg: s.actualWasteKg,
  };
}
