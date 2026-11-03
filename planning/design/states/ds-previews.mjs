// Turns the approved states page into design-system preview cards (one root element plus one <script>),
// written to the brand mirror at design/brand/studio/components/<Comp>/preview.html.
// Run after `node ../concepts/states/build.mjs`:  node ds-previews.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const pick = (re, what) => { const m = re.exec(html); if (!m) throw new Error(`no ${what} in index.html`); return m[1]; };
// the card frame puts `dark` on the document in a dark viewer; the page's own `.dark` (dark grounds) must not match it
const style = pick(/<style>([\s\S]*?)<\/style>/, 'style').replace(/\.dark\b/g, '.cxs-dark');
const bodyClass = pick(/<body class="([^"]*)">/, 'body class');
const body = pick(/<body[^>]*>([\s\S]*?)<script>/, 'body');
const script = pick(/<script>([\s\S]*?)<\/script>/, 'script');

const CARDS = {
  NotFound: { route: '404&clean', marker: 'group="States" height=860 width=1280 subtitle="The 404: the dot-grid lens. Move over it to steer the loupe; click for a pulse."' },
  NotFoundPhone: { route: '404&clean', marker: 'group="States" height=844 width=390 subtitle="The same 404 at 390 × 844. On touch the loupe follows your finger."' },
  PageLoader: { route: 'between&clean', marker: 'group="States" height=720 width=1280 subtitle="Between pages: the dot-grid ripple. Each 72° index sends a wave; the blades fill black, then drain."' },
  Loaders: { route: 'use&clean', marker: 'group="States" height=1700 width=1280 subtitle="Where each loader goes: hold dial, skeleton and the ripple, by kind of wait."' },
};

for (const [comp, { route, marker }] of Object.entries(CARDS)) {
  // the page routes from its hash: a card frame has none, so give it this card's route first
  const boot = `if(location.hash.length<2)history.replaceState(null,'',location.pathname+location.search+'#${route}');document.body.classList.add(...${JSON.stringify(bodyClass.split(' '))});`;
  const out = `<!-- @dsCard ${marker} -->\n<div class="cx-states">\n<style>${style}</style>\n${body.trim()}\n<script>${boot}\n${script}</script>\n</div>\n`;
  if (out.length > 250_000) throw new Error(`${comp} preview is ${out.length} bytes, over the 256 KB card limit`);
  const dir = join(here, '..', 'brand', 'studio', 'components', comp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'preview.html'), out);
  console.log(`${comp}: ${(out.length / 1024).toFixed(1)} KB`);
}
