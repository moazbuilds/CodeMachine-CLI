import { resolveFolder, resolveModule, resolveStep, separator } from '../utils/index.js';
import { controller } from '../../shared/workflows/controller-helper.js';

type TemplateGlobalProvider = typeof resolveStep | typeof resolveFolder | typeof resolveModule | typeof separator | typeof controller;

const templateGlobals = {
  resolveStep,
  resolveFolder,
  resolveModule,
  separator,
  controller,
} satisfies Record<string, TemplateGlobalProvider>;

export function ensureTemplateGlobals(): void {
  const target = globalThis as unknown as Record<string, TemplateGlobalProvider | undefined>;
  for (const [key, fn] of Object.entries(templateGlobals)) {
    if (typeof target[key] !== 'function') {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: fn,
      });
    }
  }
}
