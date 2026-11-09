import { generateKeyBetween } from 'fractional-indexing';

export function keyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

/** Çelës për të vendosur një element në pozicionin `index` mes vëllezërve të renditur. */
export function keyForIndex(siblingKeys: string[], index: number): string {
  const sorted = [...siblingKeys].sort();
  const i = Math.max(0, Math.min(index, sorted.length));
  return keyBetween(sorted[i - 1] ?? null, sorted[i] ?? null);
}
