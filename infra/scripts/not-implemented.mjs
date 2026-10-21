// Placeholder for a test layer whose implementing slice has not landed yet.
// It must fail so an unimplemented layer can never be reported as passing.
const [command = 'unknown', task = 'unknown'] = process.argv.slice(2);
console.error(`${command} is not implemented yet (owned by ${task}); refusing to report success.`);
process.exit(2);
