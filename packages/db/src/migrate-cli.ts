// `DATABASE_URL=... node packages/db/src/migrate-cli.ts`
import { migrate } from './migrate.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const applied = await migrate(url);
console.warn(applied.length ? `applied: ${applied.join(', ')}` : 'database already up to date');
