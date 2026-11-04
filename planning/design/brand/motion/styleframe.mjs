// Style-frame sheet: the mark at large, small and favicon sizes plus the lockups, for visual review.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { COLOR, markSVG, lockup, tipTangent } from './geometry.mjs';

const out = process.argv[2] || '.cache/styleframe.png';
mkdirSync('.cache', { recursive: true });

const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
const h = lockup('horizontal', { H: 70, mark: COLOR.white, word: COLOR.white });
const hl = lockup('horizontal', { H: 40 });
const st = lockup('stacked', { H: 46 });

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<rect width="1600" height="900" fill="${COLOR.paper}"/>
<rect width="800" height="560" fill="${COLOR.ink}"/>
${markSVG({ cx: 400, cy: 280, radius: 230, fill: COLOR.white })}
<g transform="translate(860,40)">${hl.svg}</g>
<g transform="translate(${860 + 30},180)">${st.svg}</g>
${[64, 32, 24, 16].map((s, i) => markSVG({ cx: 1200 + i * 90, cy: 230, radius: s / 2, fill: COLOR.ink, variant: s < 48 ? 'small' : 'full' })).join('')}
${[64, 32, 24, 16].map((s, i) => markSVG({ cx: 1200 + i * 90, cy: 330, radius: s / 2, fill: COLOR.ink, variant: 'full' })).join('')}
<rect y="560" width="1600" height="340" fill="${COLOR.graphite}"/>
<g transform="translate(80,${560 + (340 - h.h) / 2})">${h.svg}</g>
<text x="1580" y="890" text-anchor="end" font-size="14" fill="${COLOR.steel}" font-family="sans-serif">tip ${tipTangent().toFixed(1)} deg</text>
</svg>`;
writeFileSync(out, png(sheet, 1600));
console.log('wrote', out, 'lockup', h.w.toFixed(0), 'x', h.h.toFixed(0));
