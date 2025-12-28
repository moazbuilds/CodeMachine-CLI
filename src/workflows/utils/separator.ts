import type { Separator } from '../templates/types.js';

export function separator(text: string): Separator {
  return {
    type: 'separator',
    text,
  };
}
