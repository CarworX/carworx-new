// Renders every motion deliverable into ../exports/motion. Run: node build-motion.mjs [name ...]
import { encode } from './render.mjs';
import { mkdirSync } from 'node:fs';

const OUT = '../exports/motion';
mkdirSync(OUT, { recursive: true });
export const JOBS = {
  'hero-16x9': [{ cut: 'hero', format: '16x9' }, { fps: 60, out: `${OUT}/carworx-hero-16x9.mp4` }],
  'hero-1x1': [{ cut: 'hero', format: '1x1' }, { fps: 60, out: `${OUT}/carworx-hero-1x1.mp4` }],
  'hero-9x16': [{ cut: 'hero', format: '9x16' }, { fps: 60, out: `${OUT}/carworx-hero-9x16.mp4` }],
  'loop-16x9': [{ cut: 'loop', format: '16x9' }, { fps: 60, out: `${OUT}/carworx-loop-16x9.mp4` }],
  'overlay-16x9': [{ cut: 'hero', format: '16x9', alpha: true }, { fps: 60, out: `${OUT}/carworx-hero-16x9-transparent.webm` }],
  'splash-9x16': [{ cut: 'splash', format: '9x16' }, { fps: 60, out: `${OUT}/carworx-splash-9x16.mp4` }],
  'splash-1x1': [{ cut: 'splash', format: '1x1' }, { fps: 60, out: `${OUT}/carworx-splash-1x1.mp4` }],
  'email-gif': [{ cut: 'loop', format: 'card', scale: 0.4, noGrain: true, stillLight: true }, { fps: 12, out: `${OUT}/carworx-email-480x252.gif` }],
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
for (const n of names) await encode(...JOBS[n]);
