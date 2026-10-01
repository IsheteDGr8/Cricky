/**
 * After `expo export --platform web`, copy association files and the privacy
 * page into dist/ so Firebase Hosting can serve them as real files (rewrites
 * would otherwise send everything to index.html).
 */
import { copyFileSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
if (!existsSync(join(dist, 'index.html'))) {
  throw new Error('dist/index.html is missing. Run expo export --platform web first.');
}

const wellKnown = join('public', '.well-known');
if (existsSync(wellKnown)) {
  cpSync(wellKnown, join(dist, '.well-known'), { recursive: true });
}

const privacy = join('public', 'privacy.html');
if (existsSync(privacy)) {
  copyFileSync(privacy, join(dist, 'privacy.html'));
}

console.log('Prepared dist/ for Hosting (well-known + privacy).');
