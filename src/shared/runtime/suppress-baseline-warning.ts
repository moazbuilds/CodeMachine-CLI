const BASELINE_WARNING_PREFIX =
  '[baseline-browser-mapping] The data in this module is over two months old.';

const globalWithFlag = globalThis as typeof globalThis & {
  __CODEMACHINE_BASELINE_BBM_WARN_FILTER__?: boolean;
};

if (!globalWithFlag.__CODEMACHINE_BASELINE_BBM_WARN_FILTER__) {
  globalWithFlag.__CODEMACHINE_BASELINE_BBM_WARN_FILTER__ = true;
  const originalWarn = console.warn.bind(console);

  console.warn = (...args: Parameters<typeof console.warn>): void => {
    if (typeof args[0] === 'string' && args[0].startsWith(BASELINE_WARNING_PREFIX)) {
      return;
    }
    originalWarn(...args);
  };
}
