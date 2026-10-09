import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { parse } from 'yaml';
import { allowedFile } from './admin/document.mjs';
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n');
const bundle = { config: parse(fs.readFileSync('_config.yml', 'utf8')), templates: {}, pages: {}, files: {}, media: [] };
for (const path of files) {
  if (allowedFile(path)) {
    const source = fs.readFileSync(path, 'utf8'), bytes = Buffer.from(source);
    bundle.files[path] = { source, sha: createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex') };
  } else if (/^_(includes|layouts)\/.+\.html$/.test(path)) bundle.templates[path] = fs.readFileSync(path, 'utf8');
  else if (/^(index.html|(about|contact|research|teaching|design|publications|gallery|computational-tools|fine-art)\/index.html)$/.test(path)) bundle.pages[path] = fs.readFileSync(path, 'utf8');
  if (/^assets\/.+\.(png|jpe?g|webp|gif|avif|mp4|webm|pdf)$/i.test(path)) bundle.media.push('/' + path);
}
fs.mkdirSync('assets/admin', { recursive: true });
fs.writeFileSync('assets/admin/context.json', JSON.stringify(bundle));
await build({ entryPoints: ['scripts/admin/app.mjs'], outfile: 'assets/admin/studio.js', bundle: true, minify: true, format: 'esm', target: 'es2022', legalComments: 'eof' });
console.log(`Built Content Studio: ${Object.keys(bundle.files).length} content files, ${bundle.media.length} assets.`);
