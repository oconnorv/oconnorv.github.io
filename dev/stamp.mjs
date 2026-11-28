// Gives every script and stylesheet a version tag based on its contents (e.g. site.css?v=3f2a9c1b0d).
// GitHub Pages lets browsers reuse files for up to 10 minutes, so without this a visitor can get the
// new page with old game code. With it, a changed file gets a new address and is fetched right away.
//
//   node dev/stamp.mjs           # update the version tags in all pages (run before committing)
//   node dev/stamp.mjs --check   # exit 1 if any page has an out-of-date tag (dev/smoke.mjs runs this)
//
// The game's JavaScript modules import each other by plain names ('./game/game.js'); index.html
// carries an import map that points each of those names at its versioned address. After the map
// comes a "modulepreload" line for each module, so the browser fetches them all at once instead of
// finding them one by one as each file names the next.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const version = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 10);

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...jsFiles(rel));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out.sort();
}

const modules = jsFiles('js').filter((f) => f !== 'js/page.js'); // page.js is a plain script, not a module
const imports = Object.fromEntries(modules.map((f) => [`./${f}`, `./${f}?v=${version(f)}`]));
const mapJson = JSON.stringify({ imports }, null, 2).split('\n').join('\n  ');
const preloads = modules.map((f) => `<link rel="modulepreload" href="${f}?v=${version(f)}">`).join('\n  ');
const importMap = `<!-- importmap: written by dev/stamp.mjs -->\n  <script type="importmap">\n  ${mapJson}\n  </script>\n  ${preloads}\n  <!-- /importmap -->`;

const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort();
const changed = [];
for (const page of pages) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, 'utf8');
  let s = before.replace(
    /(["'])(\/?)(css\/site\.css|js\/main\.js|js\/page\.js)(\?v=[0-9a-f]*)?\1/g,
    (m, q, slash, f) => `${q}${slash}${f}?v=${version(f)}${q}`,
  );
  s = s.replace(/<!-- importmap[^>]*-->[\s\S]*?<!-- \/importmap -->/, importMap);
  if (s !== before) {
    changed.push(page);
    if (!check) fs.writeFileSync(file, s);
  }
}

if (check) {
  if (changed.length) {
    console.error(`Out-of-date version tags in: ${changed.join(', ')}. Run: node dev/stamp.mjs`);
    process.exit(1);
  }
  console.log('version tags are up to date');
} else console.log(changed.length ? `updated: ${changed.join(', ')}` : 'already up to date');
