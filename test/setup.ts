import { beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in store) result[key] = store[key];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (keys: string[]) => {
        for (const key of keys) delete store[key];
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  chromeMock.runtime.sendMessage.mockReset();
});
