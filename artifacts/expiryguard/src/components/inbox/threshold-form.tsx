import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { InboxThresholds } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/guard';
import { useInboxActions } from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function ThresholdForm({ value }: { value: InboxThresholds }) {
  const { thresholds } = useInboxActions();
  const { toast } = useToast();
  const [w, setW] = useState(String(value.warningDays));
  const [u, setU] = useState(String(value.upcomingDays));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) { setW(String(value.warningDays)); setU(String(value.upcomingDays)); } }, [value.warningDays, value.upcomingDays, dirty]);
  const wn = Number(w), un = Number(u);
  const wBad = w.trim() === '' || !Number.isInteger(wn) || wn < 1 || wn > 30;
  const uBad = u.trim() === '' || !Number.isInteger(un) || un < 1 || un > 90;
  const order = !wBad && !uBad && wn > un;
  const same = wn === value.warningDays && un === value.upcomingDays;
  const save = () => thresholds.mutate({ data: { warningDays: wn, upcomingDays: un } }, {
    onSuccess: () => { setDirty(false); toast({ title: 'Expiry thresholds saved', description: `Warning within ${wn} days, upcoming within ${un} days.` }); },
    onError: (e) => toast({ title: 'Thresholds not saved', description: errorMessage(e), variant: 'destructive' }),
  });
  return (
    <div className="rounded-xl border bg-background/60 p-3 space-y-3" data-testid="form-thresholds">
      <div className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="w-4 h-4 text-primary" />Expiry thresholds</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg bg-destructive/[0.06] border border-destructive/20 p-2"><div className="uppercase tracking-wider font-bold text-destructive text-[10px]">Critical</div><div>Expires today or already expired. Fixed.</div></div>
        <label className="space-y-1 font-semibold">Warning within (days)
          <Input type="number" min={1} max={30} value={w} aria-invalid={wBad || order} onChange={(e) => { setW(e.target.value); setDirty(true); }} className={cn('num', (wBad || order) && 'border-destructive')} data-testid="input-warning-days" />
          {wBad && <span className="block font-normal text-destructive">Whole number from 1 to 30.</span>}
        </label>
        <label className="space-y-1 font-semibold">Upcoming within (days)
          <Input type="number" min={1} max={90} value={u} aria-invalid={uBad || order} onChange={(e) => { setU(e.target.value); setDirty(true); }} className={cn('num', (uBad || order) && 'border-destructive')} data-testid="input-upcoming-days" />
          {uBad && <span className="block font-normal text-destructive">Whole number from 1 to 90.</span>}
        </label>
      </div>
      {order && <p className="text-xs text-destructive">Warning days must be less than or equal to upcoming days.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={wBad || uBad || order || same || thresholds.isPending} onClick={save} data-testid="button-save-thresholds">{thresholds.isPending ? 'Saving...' : 'Save thresholds'}</Button>
        <Button size="sm" variant="ghost" disabled={thresholds.isPending || (!dirty && same)} onClick={() => { setDirty(false); setW(String(value.warningDays)); setU(String(value.upcomingDays)); }}>Reset</Button>
        <Button size="sm" variant="ghost" disabled={thresholds.isPending || (wn === 3 && un === 7)} onClick={() => { setW('3'); setU('7'); setDirty(true); }} data-testid="button-default-thresholds">Use defaults (3 / 7)</Button>
        <span className="text-[11px] text-muted-foreground">Applies only to your private café workspace.</span>
      </div>
    </div>
  );
}
