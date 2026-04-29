import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

import { registerLinearCommands } from './commands.js';
import { registerLinearTools } from './tools/index.js';

export default function linearExtension(pi: ExtensionAPI): void {
  registerLinearTools(pi);
  registerLinearCommands(pi);
}
