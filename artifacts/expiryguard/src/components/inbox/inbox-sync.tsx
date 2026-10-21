import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetInboxQueryKey, getUpdateInboxMutationKey, getUpdateInboxThresholdsMutationKey } from '@workspace/api-client-react';

/** Any successful app mutation (inventory, decisions, reorders, automation...) refreshes the inbox immediately. */
export function InboxSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const skip = new Set<string>([getUpdateInboxMutationKey()[0], getUpdateInboxThresholdsMutationKey()[0]]);
    return qc.getMutationCache().subscribe((e) => {
      if (e.type !== 'updated' || e.action.type !== 'success') return;
      const k = e.mutation.options.mutationKey?.[0];
      if (typeof k === 'string' && skip.has(k)) return;
      qc.invalidateQueries({ queryKey: getGetInboxQueryKey() });
    });
  }, [qc]);
  return null;
}
