import { selectDue, isGone } from './logic';

const now = new Date('2026-11-09T10:00:00Z');
const t = (id: string, extra: Record<string, unknown>) => ({
  id, user_id: 'u', title: id, remind_at: '2026-11-09T09:59:00Z', done: false, deleted: false, reminded_at: null, ...extra,
});

test('selectDue picks only reached, open, live, not-yet-reminded tasks', () => {
  const rows = [
    t('due', {}),
    t('future', { remind_at: '2026-11-09T10:05:00Z' }),
    t('done', { done: true }),
    t('deleted', { deleted: true }),
    t('sent', { reminded_at: '2026-11-09T09:59:30Z' }),
    t('none', { remind_at: null }),
  ];
  expect(selectDue(rows, now).map((r) => r.id)).toEqual(['due']);
});

test('isGone is true for 404 and 410 only', () => {
  expect(isGone(404)).toBe(true);
  expect(isGone(410)).toBe(true);
  expect(isGone(500)).toBe(false);
  expect(isGone(201)).toBe(false);
});
