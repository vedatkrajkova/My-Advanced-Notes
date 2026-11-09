import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// Node >= 25 ka localStorage të vetin (pa skedar është i paperdorshëm) që fsheh atë të jsdom.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
if (typeof window !== 'undefined') {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    let ok = false;
    try { ok = typeof globalThis[name]?.getItem === 'function'; } catch { ok = false; }
    if (!ok) Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true });
  }
}
