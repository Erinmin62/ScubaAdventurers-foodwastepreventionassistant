import { PageHeader } from '@/components/bits';
import { InboxCentre } from '@/components/inbox/inbox-centre';

export default function Notifications() {
  return (
    <div className="space-y-6">
      <PageHeader kicker="What needs your attention" title="Notifications">
        Your alerts update automatically from stock and workflow changes. Review expiry risks and pending actions here; opening a notification never approves an action or places an order.
      </PageHeader>
      <InboxCentre />
    </div>
  );
}
