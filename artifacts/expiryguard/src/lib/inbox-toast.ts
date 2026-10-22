export type AttentionNotice = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  path: string;
  resolvedAt: string | null;
  dismissedAt: string | null;
};

const attentionKinds = new Set(['expiry', 'recommendations', 'approvals', 'failures']);
const severityRank: Record<string, number> = {
  critical: 0,
  warning: 1,
  upcoming: 2,
  info: 3,
  success: 4,
};

/** Find only new, reopened, or severity-escalated alerts; ignore ordinary refreshes and edits. */
export function findNewAttentionNotices(
  previous: readonly AttentionNotice[],
  current: readonly AttentionNotice[],
): AttentionNotice[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  return current.filter((item) => {
    if (!attentionKinds.has(item.kind) || item.resolvedAt || item.dismissedAt) return false;
    const old = previousById.get(item.id);
    if (!old) return true;
    if (old.resolvedAt || old.dismissedAt) return true;
    return (severityRank[item.severity] ?? Number.MAX_SAFE_INTEGER)
      < (severityRank[old.severity] ?? Number.MAX_SAFE_INTEGER);
  });
}

export function attentionSummary(items: readonly AttentionNotice[]): string {
  if (items.length === 1) {
    switch (items[0]?.kind) {
      case 'expiry': return 'An ingredient needs an expiry review. Open Notifications for its date and safe next steps.';
      case 'recommendations': return 'A recommendation needs your review before any action is taken.';
      case 'approvals': return 'Owner approval is required before this proposed action can proceed.';
      case 'failures': return 'A workflow needs attention. Review the details before continuing.';
      default: return 'Open Notifications to review this alert.';
    }
  }

  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const parts: string[] = [];
  const add = (kind: string, one: string, many: string) => {
    const count = counts.get(kind) ?? 0;
    if (count) parts.push(`${count} ${count === 1 ? one : many}`);
  };
  add('expiry', 'expiry alert', 'expiry alerts');
  add('recommendations', 'recommendation', 'recommendations');
  add('approvals', 'action awaiting approval', 'actions awaiting approval');
  add('failures', 'workflow issue', 'workflow issues');
  return `${parts.join(' · ')}. Select Review for details.`;
}
