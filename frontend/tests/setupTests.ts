import '@testing-library/jest-dom/vitest';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Global test setup: provide a minimal localStorage shim and any globals tests need.
(globalThis as any).localStorage = (globalThis as any).localStorage || {
  _store: new Map<string, string>(),
  getItem(key: string) { return this._store.has(key) ? this._store.get(key) : null; },
  setItem(key: string, value: string) { this._store.set(key, String(value)); },
  removeItem(key: string) { this._store.delete(key); },
  clear() { this._store.clear(); }
};

// minimal navigator shim
(globalThis as any).navigator = (globalThis as any).navigator || { onLine: true };
// Test setup: provide minimal IndexedDB stub and globals for happy-dom environment
// This file is executed before other tests to avoid modules auto-initializing IndexedDB.

// Minimal fake IndexedDB open implementation used by offlineContentStorage.init()
(globalThis as any).indexedDB = {
  open: (name: string, version?: number) => {
    const req: any = {};
    // emulate async open lifecycle
    setTimeout(() => {
      // emulate onupgradeneeded first
      if (typeof req.onupgradeneeded === 'function') {
        try {
          const fakeDb = {
            objectStoreNames: {
              contains: () => false,
            },
            createObjectStore: () => ({}),
          };
          req.onupgradeneeded({ target: { result: fakeDb } });
        } catch (e) {
          // ignore
        }
      }

      // then onsuccess
      if (typeof req.onsuccess === 'function') {
        req.result = {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => ({}),
        };
        req.onsuccess({ target: req });
      }
    }, 0);

    return req;
  },
};

// Ensure alert exists
(globalThis as any).alert = (msg?: any) => {
  // no-op in tests
};

// provide a default useAuth mock so that components like Header can render without errors
import { vi } from 'vitest';
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'user' } }),
}));
