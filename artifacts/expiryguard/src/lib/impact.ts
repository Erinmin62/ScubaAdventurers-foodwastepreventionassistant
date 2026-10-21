import type { GuardState } from '@workspace/api-client-react';

type ImpactInput = {
  summary: Pick<GuardState['summary'], 'estimatedSavings' | 'baselineWasteCost' | 'actualWasteCost' | 'baselineWasteKg' | 'actualWasteKg'>;
  recommendations: Pick<GuardState['recommendations'][number], 'type' | 'status' | 'savings'>[];
};

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
