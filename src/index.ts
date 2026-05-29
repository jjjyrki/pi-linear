import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

import { registerLinearCommands } from './commands.js';
import { installLinearProcessGuards } from './linear/processGuards.js';
import { registerLinearTools } from './tools/index.js';

export default function linearExtension(pi: ExtensionAPI): void {
  installLinearProcessGuards();
  registerLinearTools(pi);
  registerLinearCommands(pi);
}
