import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

import { createNotImplementedError } from './errors.js';

export const linearCommandNames = ['linear', 'linear-status', 'linear-tools'] as const;

export function registerLinearCommands(pi: ExtensionAPI): void {
  for (const name of linearCommandNames) {
    pi.registerCommand(name, {
      description: `Placeholder /${name} command for the Linear extension.`,
      handler: async () => {
        throw createNotImplementedError(`/${name}`);
      },
    });
  }
}
