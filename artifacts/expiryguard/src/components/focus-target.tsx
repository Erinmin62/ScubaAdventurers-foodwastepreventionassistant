import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useSearch } from 'wouter';
import { BellRing, X } from 'lucide-react';

/** Reads ?item=<id> from the URL (set by notification links). */
export function useFocusItem() {
  const search = useSearch();
  return new URLSearchParams(search).get('item');
}

/** Scrolls to and briefly highlights the element with DOM id `domId` once `ready`. Never clicks or opens anything. */
export function useScrollHighlight(domId: string | null, ready: boolean) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!domId || !ready || done.current === domId) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(domId);
      if (!el) return;
      done.current = domId;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('focus-flash');
      window.setTimeout(() => el.classList.remove('focus-flash'), 3200);
    }, 80);
    return () => window.clearTimeout(t);
  }, [domId, ready]);
}

export function FocusBanner({ found, label, clearHref, children }: { found: boolean; label: string; clearHref: string; children?: ReactNode }) {
  return (
    <section className="rise rounded-2xl border-2 border-primary/40 bg-primary/[0.05] p-4 space-y-3" data-testid="panel-focus-target">
      <div className="flex flex-wrap items-start gap-3">
        <BellRing className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-primary">Opened from a notification</div>
          <div className="text-sm font-semibold" data-testid="text-focus-label">
            {found ? label : 'This record is no longer available. It may have been decided, replaced or removed.'}
          </div>
          {found && <div className="text-xs text-muted-foreground">Nothing has been approved. Review the details and use the normal form below to decide.</div>}
        </div>
        <Link href={clearHref} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="link-clear-focus"><X className="w-3.5 h-3.5" />Clear</Link>
      </div>
      {children}
    </section>
  );
}
