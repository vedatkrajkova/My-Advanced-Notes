import { subscribeToPush, notificationFromPayload, type PushDeps } from '../../src/push/subscribe';

function deps(over: Partial<PushDeps> = {}): PushDeps & { saved: unknown[] } {
  const saved: unknown[] = [];
  const sub = { toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'P', auth: 'A' } }) };
  return {
    saved,
    supported: true,
    vapidPublicKey: 'BKey',
    requestPermission: async () => 'granted',
    getRegistration: async () => ({
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => sub,
      },
    }),
    save: async (s) => { saved.push(s); },
    ...over,
  };
}

test('returns unsupported without PushManager', async () => {
  expect(await subscribeToPush(deps({ supported: false }))).toBe('unsupported');
});

test('returns denied when permission is refused and saves nothing', async () => {
  const d = deps({ requestPermission: async () => 'denied' });
  expect(await subscribeToPush(d)).toBe('denied');
  expect(d.saved).toEqual([]);
});

test('saves the subscription when granted', async () => {
  const d = deps();
  expect(await subscribeToPush(d)).toBe('granted');
  expect(d.saved).toEqual([{ endpoint: 'https://push/1', p256dh: 'P', auth: 'A' }]);
});

test('notificationFromPayload builds title, body and url', () => {
  expect(notificationFromPayload({ title: 'Dërgo raportin', taskId: 't1' })).toEqual({
    title: 'Dërgo raportin',
    options: { body: 'Kujtesë për detyrën', tag: 't1', data: { url: '/tasks' } },
  });
  expect(notificationFromPayload(null).title).toBe('Kujtesë');
});
