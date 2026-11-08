/** Keeps the real-API stack running for manual checks: `node apps/ios/e2e/serve.ts`. */
import { startStack } from './stack.ts';
import { stackOptions } from './options.ts';

const stack = await startStack(stackOptions());
console.warn(`API ${stack.apiUrl} · app ${stack.webUrl} · database ${new URL(stack.databaseUrl).pathname.slice(1)} · Ctrl+C to stop`);
const stop = () => { void stack.stop().then(() => process.exit(0)); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
