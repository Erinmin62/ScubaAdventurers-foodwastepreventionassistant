import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { BarChart3, Bot, ChefHat, ClipboardCheck, History, LayoutDashboard, Leaf, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { niceDate, useGuard } from '@/lib/guard';
import { guardianSrc } from '@/components/bits';

const nav = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/inventory', label: 'Pantry', icon: Package },
  { href: '/sales', label: 'Sales', icon: BarChart3 },
  { href: '/forecast', label: 'Tomorrow', icon: ChefHat },
  { href: '/recommendations', label: 'Decisions', icon: ClipboardCheck },
  { href: '/reordering', label: 'Reordering', icon: Truck },
  { href: '/impact', label: 'Impact', icon: Leaf },
  { href: '/automation', label: 'Automations', icon: Bot },
  { href: '/activity', label: 'Ledger', icon: History },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { data } = useGuard();
  const pending = data?.summary.pendingCount ?? 0;
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="md:w-60 md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground flex md:flex-col z-20">
        <div className="hidden md:flex flex-col items-center px-5 pt-6 pb-4">
          <img src={guardianSrc} alt="Yuzu, the pantry guardian" className="bob w-28 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]" />
          <div className="font-display text-xl font-extrabold mt-2" style={{ fontFamily: 'var(--font-display)' }}>ExpiryGuard<span className="text-sidebar-primary">AI</span></div>
          <div className="text-[11px] text-sidebar-foreground/60 text-center">{data?.cafeName ?? 'Your kitchen'}</div>
        </div>
        <nav className="flex md:flex-col gap-1 px-2 md:px-3 py-2 overflow-x-auto w-full">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? loc === '/' : loc.startsWith(href);
            return (
              <Link key={href} href={href} data-testid={`link-${label.toLowerCase()}`}
                className={cn('group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent text-sidebar-foreground/80')}>
                <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>{label}</span>
                {href === '/recommendations' && pending > 0 && (
                  <span className={cn('ml-auto num text-[10px] rounded-full px-1.5', active ? 'bg-sidebar/30' : 'bg-sidebar-primary text-sidebar-primary-foreground')}>{pending}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block mt-auto m-3 rounded-xl border border-sidebar-border p-3 text-[11px] leading-snug text-sidebar-foreground/70">
          <div className="font-semibold text-sidebar-primary uppercase tracking-wider mb-1">Synthetic demo</div>
          Shared sample data. Figures are estimates. Nothing is ever ordered automatically.
        </div>
      </aside>
      <div className="flex-1 md:ml-60 min-w-0">
        <div className="sticky top-0 z-10 bg-amber/20 backdrop-blur border-b border-amber/30 px-4 md:px-8 py-1.5 text-xs flex flex-wrap gap-x-4 justify-between" data-testid="text-synthetic-banner">
          <span><b>Synthetic data demo</b> — all sales, stock and savings are generated estimates for illustration.</span>
          {data && <span className="num text-muted-foreground">Today {niceDate(data.today)} · Planning {niceDate(data.tomorrow)}</span>}
        </div>
        <main className="p-4 md:p-8 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
