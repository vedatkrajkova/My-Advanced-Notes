import { keyBetween, keyForIndex } from '../../src/domain/sortKey';

test('keyBetween(null, null) returns a non-empty key', () => {
  expect(keyBetween(null, null).length).toBeGreaterThan(0);
});

test('keyBetween(a, b) sorts strictly between a and b', () => {
  const a = keyBetween(null, null);
  const b = keyBetween(a, null);
  const m = keyBetween(a, b);
  expect(a < m && m < b).toBe(true);
});

test('independent inserts between the same keys keep other keys in order', () => {
  const a = keyBetween(null, null);
  const b = keyBetween(a, null);
  const c = keyBetween(b, null);
  const x = keyBetween(a, b);
  const y = keyBetween(a, b);
  for (const k of [x, y]) expect(a < k && k < b && k < c).toBe(true);
});

test('keyForIndex places at start, middle and end', () => {
  const k1 = keyBetween(null, null);
  const k2 = keyBetween(k1, null);
  const keys = [k1, k2];
  expect(keyForIndex(keys, 0) < k1).toBe(true);
  const mid = keyForIndex(keys, 1);
  expect(k1 < mid && mid < k2).toBe(true);
  expect(keyForIndex(keys, 2) > k2).toBe(true);
  expect(keyForIndex([], 0).length).toBeGreaterThan(0);
});
