import { startRealtime, type RealtimeClient } from '../../src/sync/realtime';

function fakeClient() {
  const handlers: { filter: { table: string; filter: string }; cb: () => void }[] = [];
  let removed = 0;
  const channel = {
    on(_type: string, filter: { table: string; filter: string }, cb: () => void) {
      handlers.push({ filter, cb });
      return channel;
    },
    subscribe() { return channel; },
  };
  const client: RealtimeClient = { channel: () => channel, removeChannel: async () => { removed++; return 'ok'; } };
  return { client, handlers, removed: () => removed };
}

test('listens to every synced table filtered by user', () => {
  const f = fakeClient();
  startRealtime('u-1', f.client, vi.fn());
  expect(f.handlers.map((h) => h.filter.table).sort()).toEqual(
    ['note_tags', 'notes', 'tags', 'task_lists', 'task_tags', 'tasks']);
  expect(f.handlers.every((h) => h.filter.filter === 'user_id=eq.u-1')).toBe(true);
});

test('one event from one table calls sync exactly once', () => {
  const f = fakeClient();
  const sync = vi.fn();
  startRealtime('u-1', f.client, sync);
  f.handlers[0].cb();
  expect(sync).toHaveBeenCalledTimes(1);
});

test('stop function removes the channel', () => {
  const f = fakeClient();
  const stop = startRealtime('u-1', f.client, vi.fn());
  stop();
  expect(f.removed()).toBe(1);
});
