import { MAX_INPUT_BYTES, InputError, run, safeFailure } from './commands.ts';

try {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_INPUT_BYTES) throw new InputError('Input too large.');
    chunks.push(buffer);
  }
  process.exitCode = await run(process.argv.slice(2), Buffer.concat(chunks).toString('utf8'), process.env, {
    out: value => process.stdout.write(`${value}\n`), error: value => process.stderr.write(`${value}\n`),
  });
} catch (error) {
  process.stderr.write(`${safeFailure(error)}\n`);
  process.exitCode = 2;
}
