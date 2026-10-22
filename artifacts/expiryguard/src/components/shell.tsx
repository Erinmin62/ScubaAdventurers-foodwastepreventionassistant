import { type ReactNode } from 'react';
import { UserButton } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { BarChart3, BellRing, Bot, ChefHat, ClipboardCheck, History, LayoutDashboard, Leaf, Package, Store, Truck, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { niceDate, useGuard } from '@/lib/guard';
import { guardianSrc } from '@/components/bits';
import { NotificationBell } from '@/components/inbox/notification-bell';
import { SessionSummary } from '@/components/inbox/session-summary';
import { InboxSync } from '@/components/inbox/inbox-sync';
import { useInbox } from '@/lib/inbox';
import { businessTypeLabel } from '@/lib/business-profile';

const nav = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/impact', label: 'Impact', icon: Leaf },
  { href: '/inventory', label: 'Pantry', icon: Package },
  { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/sales', label: 'Sales', icon: BarChart3 },
  { href: '/forecast', label: 'Tomorrow', icon: ChefHat },
  { href: '/recommendations', label: 'Decisions', icon: ClipboardCheck },
  { href: '/reordering', label: 'Reordering', icon: Truck },
  { href: '/automation', label: 'Automations', icon: Bot },
  { href: '/notifications', label: 'Notifications', icon: BellRing },
  { href: '/activity', label: 'Ledger', icon: History },
  { href: '/business-profile', label: 'Business', icon: Store },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { data } = useGuard();
  const pending = data?.summary.pendingCount ?? 0;
  const { data: inbox } = useInbox();
  const unread = inbox?.unreadCount ?? 0;
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="md:w-60 md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground flex md:flex-col z-20">
        <div className="hidden md:flex flex-col items-center px-5 pt-6 pb-4">
          <img src={guardianSrc} alt="Yuzu, the pantry guardian" className="bob w-28 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]" />
          <div className="font-display text-xl font-extrabold mt-2" style={{ fontFamily: 'var(--font-display)' }}>ExpiryGuard<span className="text-sidebar-primary">AI</span></div>
          <div className="text-[11px] text-sidebar-foreground/80 text-center">{data?.businessProfile.name ?? 'Your food business'}</div>
          <div className="text-[10px] text-sidebar-foreground/55 text-center">{businessTypeLabel(data?.businessProfile.type)}</div>
        </div>
        <nav className="flex md:flex-col gap-1 px-2 md:px-3 py-2 overflow-x-auto w-full">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? loc === '/' : (loc === href || loc.startsWith(href + '/'));
            return (
              <Link key={href} href={href} data-testid={`link-${label.toLowerCase()}`}
                className={cn('group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent text-sidebar-foreground/80')}>
                <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>{label}</span>
                {href === '/recommendations' && pending > 0 && (
                  <span className={cn('ml-auto num text-[10px] rounded-full px-1.5', active ? 'bg-sidebar/30' : 'bg-sidebar-primary text-sidebar-primary-foreground')}>{pending}</span>
                )}
                {href === '/notifications' && inbox && unread > 0 && (
                  <span className={cn('ml-auto num text-[10px] rounded-full px-1.5', active ? 'bg-sidebar/30' : 'bg-destructive text-destructive-foreground')} aria-label={`${unread} unread`}>{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block mt-auto m-3 rounded-xl border border-sidebar-border p-3 text-[11px] leading-snug text-sidebar-foreground/70">
          <div className="font-semibold text-sidebar-primary uppercase tracking-wider mb-1">{data?.synthetic ? 'Synthetic demo' : 'Owner data workspace'}</div>
          {data?.synthetic
            ? 'Private workspace with sample data. Figures are estimates. Nothing is ever ordered automatically.'
            : 'Uses the menu, pantry and sales you enter. No sample sales history; nothing is ordered automatically.'}
        </div>
      </aside>
      <div className="flex-1 md:ml-60 min-w-0">
        <InboxSync />
        <div className={cn(
          'sticky top-0 z-10 backdrop-blur border-b px-4 md:px-8 py-1.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 justify-between',
          data?.synthetic ? 'bg-amber/20 border-amber/30' : 'bg-card/90 border-border',
        )} data-testid={data?.synthetic ? 'text-synthetic-banner' : 'text-owner-data-banner'}>
          <span>
            <b>{data?.synthetic ? 'Synthetic data demo' : 'Owner data workspace'}</b>
            {data && <> · {data.businessProfile.name} · {businessTypeLabel(data.businessProfile.type)}</>}
            {' '}— {data?.synthetic
              ? 'sales, stock and savings are generated estimates for illustration.'
              : 'sales and stock come from records you enter; forecasts use only recorded sales.'}
          </span>
          <span className="flex items-center gap-3">
            {data && <span className="num text-muted-foreground">Today {niceDate(data.today)} · Planning {niceDate(data.tomorrow)}</span>}
            <NotificationBell />
            <UserButton />
          </span>
        </div>
        <SessionSummary />
        <main className="p-4 md:p-8 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
