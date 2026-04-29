import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { createNotImplementedError } from '../errors.js';

export function createPlaceholderTool(name: string, label: string, description: string) {
  return defineTool({
    name,
    label,
    description,
    parameters: Type.Object({}),
    async execute() {
      throw createNotImplementedError(`tool ${name}`);
    },
  });
}
