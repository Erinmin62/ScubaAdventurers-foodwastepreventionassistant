export const businessTypes = [
  { value: 'cafe', label: 'Café' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'food_vendor', label: 'Food vendor' },
  { value: 'cloud_kitchen', label: 'Cloud kitchen' },
  { value: 'other', label: 'Other food business' },
] as const;

export type BusinessType = (typeof businessTypes)[number]['value'];

export function businessTypeLabel(type: string | undefined) {
  return businessTypes.find((option) => option.value === type)?.label ?? 'Food business';
}
