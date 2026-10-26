/** Bundle the isolated preview for direct file:// opening; no dependency or build output directory. */
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('./', import.meta.url);
const read = name => readFileSync(new URL(name, here), 'utf8');
const model = read('model.mjs').replace(/^export /gm, '');
const app = read('app.mjs').replace(/^import .+;\n/, '');
const html = read('preview.template.html')
  .replace('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`)
  .replace('<script type="module" src="app.mjs"></script>', `<script>\n(() => {\n${model}\n${app}\n})();\n</script>`);
writeFileSync(new URL('index.html', here), html);
