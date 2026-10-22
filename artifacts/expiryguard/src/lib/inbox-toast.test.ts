import assert from 'node:assert/strict';
import test from 'node:test';
import { attentionSummary, findNewAttentionNotices, type AttentionNotice } from './inbox-toast.ts';

const notice = (overrides: Partial<AttentionNotice> = {}): AttentionNotice => ({
  id: 'expiry:milk',
  kind: 'expiry',
  severity: 'warning',
  title: 'Approaching expiry: Milk',
  path: '/inventory?item=milk',
  resolvedAt: null,
  dismissedAt: null,
  ...overrides,
});

test('detects a new active expiry notice', () => {
  assert.deepEqual(findNewAttentionNotices([], [notice()]), [notice()]);
});

test('does not repeat a notice on refresh or ordinary content edits', () => {
  assert.deepEqual(findNewAttentionNotices(
    [notice()],
    [notice({ title: 'Approaching expiry: Milk (updated quantity)' })],
  ), []);
});

test('detects an escalation and a reopened notice', () => {
  assert.deepEqual(findNewAttentionNotices(
    [notice(), notice({ id: 'expiry:cheese', resolvedAt: '2026-10-22T10:00:00Z' })],
    [
      notice({ severity: 'critical' }),
      notice({ id: 'expiry:cheese' }),
    ],
  ).map((item) => item.id), ['expiry:milk', 'expiry:cheese']);
});

test('ignores resolved, dismissed, and informational completion notices', () => {
  assert.deepEqual(findNewAttentionNotices([], [
    notice({ resolvedAt: '2026-10-22T10:00:00Z' }),
    notice({ id: 'expiry:dismissed', dismissedAt: '2026-10-22T10:00:00Z' }),
    notice({ id: 'completed:1', kind: 'completed' }),
  ]), []);
});

test('summarizes several new notices without sending one toast per alert', () => {
  assert.equal(attentionSummary([
    notice(),
    notice({ id: 'approval:1', kind: 'approvals' }),
  ]), '1 expiry alert · 1 action awaiting approval. Select Review for details.');
});
