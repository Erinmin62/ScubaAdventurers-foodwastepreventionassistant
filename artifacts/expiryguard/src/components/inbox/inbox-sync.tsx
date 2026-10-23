import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetInboxQueryKey, getUpdateInboxMutationKey, getUpdateInboxThresholdsMutationKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { useInbox } from '@/lib/inbox';
import { attentionSummary, findNewAttentionNotices, type AttentionNotice } from '@/lib/inbox-toast';

/** Any successful app mutation (inventory, decisions, reorders, automation...) refreshes the inbox immediately. */
export function InboxSync() {
  const qc = useQueryClient();
  const { data } = useInbox();
  const { toast } = useToast();
  const previousItems = useRef<AttentionNotice[] | null>(null);

  useEffect(() => {
    const skip = new Set<string>([getUpdateInboxMutationKey()[0], getUpdateInboxThresholdsMutationKey()[0]]);
    return qc.getMutationCache().subscribe((e) => {
      if (e.type !== 'updated' || e.action.type !== 'success') return;
      const k = e.mutation.options.mutationKey?.[0];
      if (typeof k === 'string' && skip.has(k)) return;
      qc.invalidateQueries({ queryKey: getGetInboxQueryKey() });
    });
  }, [qc]);

  useEffect(() => {
    if (!data) return;
    const previous = previousItems.current;
    previousItems.current = data.items;
    // Establish a baseline on first load; don't replay old alerts at sign-in.
    if (!previous) return;

    const fresh = findNewAttentionNotices(previous, data.items);
    if (!fresh.length) return;

    const single = fresh.length === 1 ? fresh[0] : null;
    const critical = fresh.some((item) => item.severity === 'critical');
    toast({
      title: single?.title ?? 'New items need attention',
      description: attentionSummary(fresh),
      action: (
        <ToastAction altText="Review new notifications" asChild>
          <Link
            href={single?.path ?? '/notifications'}
            className="inline-flex min-h-8 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Review
          </Link>
        </ToastAction>
      ),
      variant: critical ? 'destructive' : 'default',
      duration: 7000,
    });
  }, [data, toast]);

  return null;
}
