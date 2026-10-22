import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const photoById: Record<string, string> = {
  tomato: 'tomato',
  avocado: 'avocado',
  spinach: 'spinach',
  bread: 'bread',
  chicken: 'chicken',
  pasta: 'pasta',
  milk: 'milk',
  coffee: 'coffee',
  cream: 'cream',
};

const photoByName: [RegExp, string][] = [
  [/tomato/, 'tomato'],
  [/avocado/, 'avocado'],
  [/spinach/, 'spinach'],
  [/sourdough|bread/, 'bread'],
  [/chicken/, 'chicken'],
  [/pasta|penne/, 'pasta'],
  [/milk/, 'milk'],
  [/coffee|bean/, 'coffee'],
  [/cream/, 'cream'],
];

export function IngredientPhoto({
  id,
  name,
  className,
}: {
  id?: string;
  name: string;
  className?: string;
}) {
  const normalizedName = name.toLowerCase();
  const photo = photoById[id ?? ''] ?? photoByName.find(([pattern]) => pattern.test(normalizedName))?.[1];

  if (!photo) {
    return (
      <span
        role="img"
        aria-label={`No photo available for ${name}`}
        className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground', className)}
      >
        <Package className="h-1/3 w-1/3" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}ingredients/${photo}.jpg`}
      alt={name}
      className={cn('shrink-0 rounded-xl bg-muted object-cover', className)}
      loading="lazy"
      data-testid={`img-ingredient-${id ?? photo}`}
    />
  );
}
