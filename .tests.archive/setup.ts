import { TextDecoder, TextEncoder } from 'util';
import { afterEach } from 'bun:test';

const globalScope = globalThis as typeof globalThis & {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
};

if (!globalScope.TextEncoder) {
  globalScope.TextEncoder = TextEncoder;
}

if (!globalScope.TextDecoder) {
  globalScope.TextDecoder = TextDecoder;
}

if (!process.env.CODEMACHINE_SKIP_ENGINE) {
  process.env.CODEMACHINE_SKIP_ENGINE = '1';
}

if (!process.env.CODEMACHINE_SKIP_AUTH) {
  process.env.CODEMACHINE_SKIP_AUTH = '1';
}

afterEach(() => {
  // Bun automatically restores mocks after each test
  // But we can explicitly restore if needed
  const global = globalThis as unknown as { restoreAllMocks?: () => void };
  if (typeof global.restoreAllMocks === 'function') {
    global.restoreAllMocks();
  }
}, 1000); // Add 1 second timeout for global cleanup
