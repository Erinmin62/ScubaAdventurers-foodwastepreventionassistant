import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, BellRing, Clock, ExternalLink, Lock, MessageCircle, PauseCircle, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import {
  getGetNotificationsQueryKey, useGetNotifications, useSaveNotificationSettings, useScanNotifications,
  type NotificationRecord, type NotificationSettingsInput, type NotificationState, type SandboxNotificationState,
} from '@workspace/api-client-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, Stat } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { InboxCentre } from '@/components/inbox/inbox-centre';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/guard';

type Kind = 'expiry' | 'recommendations' | 'approvals' | 'failures' | 'completed';
const kinds: [Kind, string, string][] = [
  ['expiry', 'Expiry risk', 'Expiry today, within 3 days or within 7 days'],
  ['recommendations', 'New recommendations', 'Prevention drafts above your RM risk threshold'],
  ['approvals', 'Approvals needed', 'Reorder plans pending your decision'],
  ['failures', 'Failures', 'A recorded plan or step failed'],
  ['completed', 'Completed', 'Something you approved was recorded'],
];

const statusInfo: Record<string, [string, string]> = {
  demo: ['Demo, not sent', 'bg-amber/15 border-amber/40 text-[hsl(32_80%_32%)]'],
  queued: ['Queued', 'bg-secondary'],
  sending: ['Sending', 'bg-secondary'],
  accepted: ['Accepted by provider (not delivered)', 'bg-secondary'],
  delivered: ['Delivered', 'bg-jade/12 text-jade border-jade/30'],
  read: ['Read', 'bg-jade/12 text-jade border-jade/30'],
  failed: ['Failed', 'bg-destructive/12 text-destructive border-destructive/30'],
  unknown: ['Unknown', 'bg-muted text-muted-foreground'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground line-through'],
};
const prioCls: Record<string, string> = {
  critical: 'text-destructive', warning: 'text-[hsl(32_80%_32%)]', upcoming: 'text-primary', info: 'text-muted-foreground',
};
const ts = (s?: string | null) => (s ? s.replace('T', ' ').slice(0, 16) : '-');
const E164 = /^\+[1-9]\d{7,14}$/;

type Form = Omit<NotificationSettingsInput, 'reminderHours' | 'maxReminders' | 'dailyLimit' | 'riskThreshold'> & {
  reminderHours: string; maxReminders: string; dailyLimit: string; riskThreshold: string;
};
const toForm = (s: NotificationSettingsInput): Form => ({
  ...s, reminderHours: String(s.reminderHours), maxReminders: String(s.maxReminders), dailyLimit: String(s.dailyLimit), riskThreshold: String(s.riskThreshold),
});

function useSync() {
  const qc = useQueryClient();
  return (s?: NotificationState) => {
    if (s) qc.setQueryData(getGetNotificationsQueryKey(), s);
    qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  };
}

function Settings({ state }: { state: NotificationState }) {
  const { toast } = useToast();
  const sync = useSync();
  const save = useSaveNotificationSettings();
  const [f, setF] = useState<Form>(() => toForm(state.settings));
  const init = useRef(false);
  useEffect(() => { if (!init.current) { init.current = true; setF(toForm(state.settings)); } }, [state.settings]);

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const intIn = (s: string, lo: number, hi: number) => Number.isInteger(num(s)) && num(s) >= lo && num(s) <= hi;
  const phone = f.phone.trim();
  const errs = {
    phone: (f.enabled || phone !== '') && !E164.test(phone),
    optIn: f.enabled && !f.optIn,
    reminderHours: !intIn(f.reminderHours, 24, 168),
    maxReminders: !intIn(f.maxReminders, 0, 3),
    dailyLimit: !intIn(f.dailyLimit, 1, 20),
    riskThreshold: !(Number.isFinite(num(f.riskThreshold)) && num(f.riskThreshold) >= 0 && num(f.riskThreshold) <= 1e6),
  };
  const bad = Object.values(errs).some(Boolean);

  const submit = () => save.mutate({ data: {
    enabled: f.enabled, phone, optIn: f.optIn, expiry: f.expiry, recommendations: f.recommendations, approvals: f.approvals,
    failures: f.failures, completed: f.completed, reminderHours: num(f.reminderHours), maxReminders: num(f.maxReminders),
    dailyLimit: num(f.dailyLimit), riskThreshold: num(f.riskThreshold),
  } }, {
    onSuccess: (s) => { sync(s); setF(toForm(s.settings)); toast({ title: 'Notification settings saved', description: s.settings.enabled ? 'Demo previews on. These settings do not affect Twilio Sandbox alerts.' : 'Notifications off.' }); },
    onError: (e) => { sync(); toast({ title: 'Settings not saved', description: errorMessage(e), variant: 'destructive' }); },
  });

  const numFields: [keyof Form, string, string, number, number][] = [
    ['reminderHours', 'Remind after (hours)', '24 to 168', 24, 168],
    ['maxReminders', 'Max reminders', '0 to 3 per event', 0, 3],
    ['dailyLimit', 'Daily limit', '1 to 20 messages per day', 1, 20],
    ['riskThreshold', 'Expiry risk threshold (RM)', '0 to 1,000,000 RM', 0, 1e6],
  ];

  return (
    <Panel title="Demo preview settings" sub="Affects demo previews only, never the Twilio Sandbox recipient, opt-in or cap. Saved to the shared server for everyone.">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div><div className="font-semibold text-sm">Notifications</div><div className="text-xs text-muted-foreground">Generate demo previews of WhatsApp alerts</div></div>
          <div className="flex items-center gap-2">
            <span className={cn('text-[11px] font-semibold uppercase tracking-wider', f.enabled ? 'text-jade' : 'text-muted-foreground')}>{f.enabled ? 'On (demo)' : 'Off'}</span>
            <Switch checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} data-testid="switch-notifications" aria-label="Enable demo notifications" />
          </div>
        </div>

        <label className="block text-xs font-semibold space-y-1">Recipient number (E.164, for example +60 followed by digits)
          <Input value={f.phone} maxLength={20} inputMode="tel" placeholder="+60..." onChange={(e) => setF({ ...f, phone: e.target.value, optIn: false })}
            className={cn('num', errs.phone && 'border-destructive')} data-testid="input-phone" />
          <span className="block font-normal text-muted-foreground">Use a test number, not a real personal one. Changing it clears consent below.</span>
          {errs.phone && <span className="block text-destructive font-normal">{f.enabled && !phone ? 'A number is required to turn notifications on.' : 'Use E.164 format: + then country code and number, no spaces.'}</span>}
        </label>

        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" checked={f.optIn} onChange={(e) => setF({ ...f, optIn: e.target.checked })} className="mt-0.5" data-testid="checkbox-optin" />
          <span>The owner of this number explicitly agreed to receive ExpiryGuard alerts.{state.consentAt && <span className="num text-muted-foreground"> Last recorded {ts(state.consentAt)}.</span>}
            {errs.optIn && <span className="block text-destructive">Explicit opt-in is required to turn notifications on.</span>}</span>
        </label>

        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-2">What to notify about</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {kinds.map(([k, label, hint]) => (
              <label key={k} className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40">
                <Switch checked={f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} data-testid={`switch-${k}`} />
                <span><span className="block text-sm font-semibold">{label}</span><span className="block text-[11px] text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {numFields.map(([k, label, hint, min, max]) => (
            <label key={k} className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold space-y-1">{label}
              <Input type="number" min={min} max={max} step={k === 'riskThreshold' ? 'any' : 1} aria-invalid={!!errs[k as keyof typeof errs]} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className={cn('num', errs[k as keyof typeof errs] && 'border-destructive')} data-testid={`input-${k}`} />
              <span className="block normal-case tracking-normal font-normal">{hint}</span>
              {errs[k as keyof typeof errs] && <span className="block text-destructive normal-case tracking-normal">Enter {k === 'riskThreshold' ? 'a number' : 'a whole number'} from {min} to {max}.</span>}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={bad || save.isPending} onClick={submit} data-testid="button-save-notifications"><Save className="w-4 h-4 mr-1" />{save.isPending ? 'Saving...' : 'Save settings'}</Button>
          <Button variant="ghost" disabled={save.isPending} onClick={() => setF(toForm(state.settings))}>Reset</Button>
          {save.isError && <span className="text-xs text-destructive" data-testid="text-save-error">{errorMessage(save.error)}</span>}
        </div>
      </div>
    </Panel>
  );
}

function RecordRow({ r }: { r: NotificationRecord }) {
  const [label, cls] = statusInfo[r.status] ?? statusInfo.unknown;
  return (
    <div className={cn('rounded-xl border p-3 space-y-2', r.status === 'failed' && 'border-destructive/40 bg-destructive/[0.03]')} data-testid={`row-notification-${r.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', cls)}>{label}</span>
        <span className={cn('text-[10px] uppercase tracking-widest font-bold', prioCls[r.priority])}>{r.priority}</span>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{r.kind}</span>
        {r.reminderIndex > 0 && <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5 font-semibold">Reminder {r.reminderIndex}</span>}
        <span className="num text-[11px] text-muted-foreground ml-auto">{ts(r.createdAt)}</span>
      </div>
      <div className="font-semibold">{r.title}</div>
      <div className="rounded-lg bg-[hsl(var(--jade)/0.07)] border border-jade/20 px-3 py-2 text-sm whitespace-pre-line max-w-xl">{r.message}</div>
      <div className="num text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span>To {r.recipient}</span><span>Attempts {r.attempts}</span><span>Link expires {ts(r.expiresAt)}</span>
        {r.resolvedAt && <span>Resolved {ts(r.resolvedAt)}</span>}
        {r.deliveredAt && <span>Delivered {ts(r.deliveredAt)}</span>}
        {r.providerMessageId && <span>Provider id {r.providerMessageId}</span>}
      </div>
      {r.lastError && <div className="text-xs text-destructive font-semibold">Last error: {r.lastError}</div>}
      <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}${r.reviewUrl}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary" data-testid={`link-review-${r.id}`}>Open read-only review link<ExternalLink className="w-3 h-3" /></a>
    </div>
  );
}

const sbStatus: Record<string, [string, string]> = {
  'not-configured': ['Not configured', 'bg-muted text-muted-foreground'],
  checking: ['Checking', 'bg-secondary'],
  'waiting-for-opt-in': ['Waiting for opt-in', 'bg-amber/15 border-amber/40 text-[hsl(32_80%_32%)]'],
  ready: ['Ready', 'bg-jade/12 text-jade border-jade/30'],
  'window-closed': ['24h window closed', 'bg-amber/15 border-amber/40 text-[hsl(32_80%_32%)]'],
  paused: ['Paused', 'bg-muted text-muted-foreground'],
  error: ['Error', 'bg-destructive/12 text-destructive border-destructive/30'],
  'daily-limit': ['Daily cap reached', 'bg-amber/15 border-amber/40 text-[hsl(32_80%_32%)]'],
};

function SandboxPanel({ sb }: { sb?: SandboxNotificationState }) {
  const [label, cls] = sb ? (sbStatus[sb.status] ?? sbStatus.error) : ['Unavailable', 'bg-muted text-muted-foreground'];
  const msgs = sb ? [...sb.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  return (
    <section className="rise rounded-2xl border-2 border-primary/40 bg-primary/[0.04] p-5 space-y-4" data-testid="panel-sandbox">
      <div className="flex flex-wrap items-start gap-3">
        <MessageCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-primary">Real WhatsApp messages</div>
          <h2 className="text-lg font-bold">Twilio Sandbox alerts</h2>
          <p className="text-xs text-muted-foreground">Separate from the demo previews below. Recipient and credentials are set only in server Secrets and never shown or edited here.</p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', cls)} data-testid="status-sandbox">{label}</span>
      </div>
      {sb?.notice && <div className="text-sm rounded-lg border bg-card p-3" data-testid="text-sandbox-notice">{sb.notice}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div><div className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">Configured</div><div className="font-bold" data-testid="text-sandbox-configured">{sb?.configured ? 'Yes' : 'No'}</div></div>
        <div><div className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">Last check</div><div className="num font-bold">{ts(sb?.checkedAt)}</div></div>
        <div><div className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">Window expires</div><div className="num font-bold">{ts(sb?.windowExpiresAt)}</div></div>
        <div><div className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">Rolling 24h cap</div><div className="num font-bold" data-testid="text-sandbox-cap">{sb ? `${sb.usedToday} / ${sb.dailyLimit}` : '-'}</div></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ol className="space-y-2 text-sm">
          <li className="flex gap-2"><span className="num w-5 h-5 shrink-0 rounded-full border text-[10px] grid place-items-center font-semibold">1</span><span>Join <b>your</b> Twilio Sandbox by sending the join code shown in your Twilio console to the sandbox number (currently <span className="num">+1 415 523 8886</span>; use the number Twilio displays if different).</span></li>
          <li className="flex gap-2"><span className="num w-5 h-5 shrink-0 rounded-full border text-[10px] grid place-items-center font-semibold">2</span><span>From your own WhatsApp, send exactly <code className="num rounded bg-secondary px-1">START EXPIRYGUARDAI DEMO</code> to opt in.</span></li>
          <li className="flex gap-2"><PauseCircle className="w-5 h-5 shrink-0 text-muted-foreground" /><span>Send <code className="num rounded bg-secondary px-1">PAUSE EXPIRYGUARDAI DEMO</code> any time to pause.</span></li>
        </ol>
        <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
          <li>The server checks every minute while running; this page can be closed. Dev servers have no guaranteed uptime.</li>
          <li>Messages are only sent within 24 hours of your last message to the sandbox.</li>
          <li>Alerts use synthetic cafe data and never approve or order anything.</li>
          <li>Accepted by Twilio is not delivered.</li>
          <li>The demo preview settings below do not change the sandbox recipient, opt-in or cap.</li>
        </ul>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-2">Recent sandbox messages</div>
        {msgs.length ? <div className="space-y-2 max-h-[420px] overflow-auto">{msgs.map((m) => {
          const [l, c] = statusInfo[m.status] ?? statusInfo.unknown;
          return (
            <div key={m.id} className={cn('rounded-xl border bg-card p-3 space-y-1.5', m.status === 'failed' && 'border-destructive/40')} data-testid={`row-sandbox-${m.id}`}>
              <div className="flex flex-wrap items-center gap-2"><span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', c)}>{l}</span><span className="num text-[11px] text-muted-foreground ml-auto">{ts(m.createdAt)}</span></div>
              <div className="text-sm whitespace-pre-line">{m.message}</div>
              {m.providerMessageId && <div className="num text-[11px] text-muted-foreground">Provider id {m.providerMessageId}</div>}
              {m.lastError && <div className="text-xs text-destructive font-semibold">Last error: {m.lastError}</div>}
            </div>);
        })}</div> : <p className="text-sm text-muted-foreground">No real sandbox messages yet.</p>}
      </div>
    </section>
  );
}

export default function Notifications() {
  const { data, isLoading, error, refetch } = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), refetchInterval: 30000 } });
  const scan = useScanNotifications();
  const sync = useSync();
  const { toast } = useToast();
  if (isLoading) return <div className="space-y-6"><InboxCentre /><LoadingState /></div>;
  if (error || !data) return <div className="space-y-6"><InboxCentre /><ErrorState error={error} onRetry={() => refetch()} /></div>;

  const day = (time: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(time));
  const today = day(new Date().toISOString());
  const todayCount = data.records.filter((r) => day(r.createdAt) === today && r.status !== 'cancelled').length;
  const open = data.records.filter((r) => !r.resolvedAt).length;
  const records = [...data.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const doScan = () => scan.mutate(undefined, {
    onSuccess: (s) => { sync(s); toast({ title: 'Scan complete', description: `${s.records.length - data.records.length} new demo preview(s). Nothing approved. Demo previews only; Twilio Sandbox alerts run separately on the server.` }); },
    onError: (e) => { sync(); toast({ title: 'Scan failed', description: errorMessage(e), variant: 'destructive' }); },
  });

  return (
    <div className="space-y-6">
      <PageHeader kicker="Heads-up, not hands-off" title="Notifications" aside={
        <Button onClick={doScan} disabled={scan.isPending} data-testid="button-scan-notifications"><RefreshCw className={cn('w-4 h-4 mr-2', scan.isPending && 'animate-spin')} />{scan.isPending ? 'Scanning...' : 'Scan WhatsApp previews'}</Button>
      }>
        Your in-app inbox updates automatically from stock and workflow changes. Review what needs attention here; opening a notification never approves an action or places an order.
      </PageHeader>

      <InboxCentre />
      <div className="pt-2 border-t"><div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-4">Messaging settings</div></div>

      <section className="rise rounded-2xl border border-amber/40 bg-amber/10 p-4 flex gap-3" data-testid="text-demo-warning">
        <ShieldAlert className="w-5 h-5 shrink-0 text-[hsl(32_80%_32%)]" />
        <div className="text-sm space-y-1">
          <div className="font-bold">Shared, unauthenticated demo. Do not enter a real personal number.</div>
          <p className="text-xs text-muted-foreground">These settings are not owner-protected: anyone with this demo can view and change them. These settings control demo previews only, not the Twilio Sandbox above. Preview mode is <b>{data.mode}</b>: records marked demo were never sent. Production sending stays blocked until a connected WhatsApp integration, an approved message template, an HTTPS published URL and owner-only access are all in place. No credentials are entered here.</p>
        </div>
      </section>
      <SandboxPanel sb={data.sandbox} />
      {scan.isError && <div className="text-sm rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Last scan failed: {errorMessage(scan.error)}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Mode" value={data.mode === 'demo' ? 'Demo' : data.mode} tone="amber" note="Previews only, not sent" testId="text-mode" />
        <Stat label="Production sending" value={data.liveReady ? 'Ready' : 'Blocked'} tone="ink" note={`${data.blockers.length} blocker(s)`} />
        <Stat label="Created today" value={`${todayCount} / ${data.settings.dailyLimit}`} tone="primary" note="Daily budget" />
        <Stat label="Unresolved" value={String(open)} tone="jade" note={`Up to ${data.settings.maxReminders} reminder(s) each`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-5">
        <div className="space-y-5">
          <Settings state={data} />
          <Panel title="Why production sending is off" action={<Lock className="w-5 h-5 text-muted-foreground" />}>
            {data.blockers.length ? <ul className="space-y-2 text-sm">{data.blockers.map((b, i) => (
              <li key={i} className="flex gap-2"><span className="num w-5 h-5 shrink-0 rounded-full border text-[10px] grid place-items-center font-semibold">{i + 1}</span>{b}</li>
            ))}</ul> : <p className="text-sm text-muted-foreground">No blockers reported, but production sending has no enable control in this build. Twilio Sandbox alerts are separate.</p>}
          </Panel>
          <Panel title="How scanning works">
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3"><Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>The server scans automatically every minute while it is running. This page does not need to stay open; it just refreshes every 30 seconds.</span></li>
              <li className="flex gap-3"><BellRing className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>Each event alerts once, then reminds after your chosen hours up to the reminder cap. The daily limit is a hard budget.</span></li>
              <li className="flex gap-3"><RefreshCw className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>Scan now follows the same dedup and limits. It never approves an action.</span></li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">Server monitor: <span className="num">{data.monitor}</span></p>
          </Panel>
        </div>
        <Panel title="Demo preview history" sub="Newest first. Accepted by provider does not mean delivered.">
          {records.length ? <div className="space-y-3 max-h-[1100px] overflow-auto -mx-1 px-1">{records.map((r) => <RecordRow key={r.id} r={r} />)}</div>
            : <EmptyState title="No notifications yet" body="Turn on demo notifications with a test number and consent, then scan. Previews appear here." />}
          <div className="mt-3 text-xs text-muted-foreground">Act on anything from <Link href="/recommendations" className="text-primary font-semibold">Decisions</Link> or <Link href="/reordering" className="text-primary font-semibold">Reordering</Link>.</div>
        </Panel>
      </div>
    </div>
  );
}
