import { useQueryClient } from '@tanstack/react-query';
import {
  getGetInboxQueryKey, useGetInbox, useUpdateInbox, useUpdateInboxThresholds,
  type InboxNotification, type InboxState,
} from '@workspace/api-client-react';

export function useInbox() {
  return useGetInbox({ query: { queryKey: getGetInboxQueryKey(), refetchInterval: 15000, refetchIntervalInBackground: false } });
}

export function useInboxActions() {
  const qc = useQueryClient();
  const put = (s: InboxState) => qc.setQueryData(getGetInboxQueryKey(), s);
  const refresh = () => qc.invalidateQueries({ queryKey: getGetInboxQueryKey() });
  const update = useUpdateInbox({ mutation: { onSuccess: put, onError: refresh } });
  const thresholds = useUpdateInboxThresholds({ mutation: { onSuccess: put, onError: refresh } });
  return { update, thresholds };
}

export const isActive = (n: InboxNotification) => !n.resolvedAt && !n.dismissedAt;
export const isUnread = (n: InboxNotification) => !n.readAt && isActive(n);
export const isActiveCritical = (n: InboxNotification) => n.severity === 'critical' && isActive(n);
/** Server refuses dismissal of active critical items and active approvals. */
export const canDismiss = (n: InboxNotification) => !n.dismissedAt && !(!n.resolvedAt && (n.severity === 'critical' || n.kind === 'approvals'));

export function sortInbox(items: InboxNotification[]) {
  const rank = (n: InboxNotification) => (n.resolvedAt ? 3 : isActiveCritical(n) ? 0 : isUnread(n) ? 1 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
}

export const actionLabel: Record<string, string> = {
  expiry: 'View item', recommendations: 'Review action', approvals: 'Review action', failures: 'View details', completed: 'View details',
};
export const kindLabel: Record<string, string> = {
  expiry: 'Expiry', recommendations: 'Recommendation', approvals: 'Approval needed', failures: 'Failure', completed: 'Completed',
};
export const sevInfo: Record<string, { label: string; cls: string; bar: string }> = {
  critical: { label: 'Critical', cls: 'bg-destructive/12 text-destructive border-destructive/30', bar: 'bg-destructive' },
  warning: { label: 'Warning', cls: 'bg-amber/15 border-amber/40 text-[hsl(32_80%_32%)]', bar: 'bg-amber' },
  upcoming: { label: 'Upcoming', cls: 'bg-primary/10 border-primary/30 text-primary', bar: 'bg-primary' },
  info: { label: 'Info', cls: 'bg-secondary text-foreground', bar: 'bg-muted-foreground' },
  success: { label: 'Success', cls: 'bg-jade/12 text-jade border-jade/30', bar: 'bg-jade' },
};

export function when(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function summaryParts(c: InboxState['counts']) {
  const p: string[] = [];
  const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (c.critical) p.push(s(c.critical, 'critical expiry risk', 'critical expiry risks'));
  if (c.approaching) p.push(s(c.approaching, 'item approaching expiry', 'items approaching expiry'));
  if (c.pendingApproval) p.push(s(c.pendingApproval, 'action awaiting approval', 'actions awaiting approval'));
  if (c.failed) p.push(s(c.failed, 'failed step', 'failed steps'));
  return p;
}
