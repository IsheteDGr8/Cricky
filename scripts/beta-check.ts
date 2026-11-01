/**
 * Confirms the beta deploy can only touch the beta site and beta database, and that dist/ was
 * built against the beta database. Does not talk to Firebase.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BETA_SITE = 'cricky-v2';
export const BETA_INSTANCE = 'cricky-v2-rtdb';
const LIVE_PROJECT = 'cricky-cricket-analysis';

interface BetaConfig {
  hosting?: { site?: string; public?: string };
  database?: { instance?: string; rules?: string }[] | { rules?: string };
}

export function betaConfigProblems(config: BetaConfig): string[] {
  const problems: string[] = [];
  if (config.hosting?.site !== BETA_SITE) {
    problems.push(`hosting.site must be "${BETA_SITE}" (never the live site "${LIVE_PROJECT}")`);
  }
  if (config.hosting?.public !== 'dist') problems.push('hosting.public must be dist');
  const dbs = Array.isArray(config.database) ? config.database : [];
  if (dbs.length !== 1 || dbs[0]?.instance !== BETA_INSTANCE) {
    problems.push(`database must list only the instance "${BETA_INSTANCE}"`);
  } else if (dbs[0].rules !== 'firebase/database.rules.json') {
    problems.push('beta database must use firebase/database.rules.json');
  }
  return problems;
}

/** Which database the exported web bundle talks to, judged from the inlined URLs. */
export function bundleDatabase(source: string): 'beta' | 'live' | 'unknown' {
  if (source.includes(`${BETA_INSTANCE}.firebaseio.com`)) return 'beta';
  if (source.includes(`${LIVE_PROJECT}-default-rtdb.firebaseio.com`)) return 'live';
  return 'unknown';
}

export function readBundle(dist = 'dist'): string {
  const dir = join(dist, '_expo', 'static', 'js', 'web');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

function main() {
  const config = JSON.parse(readFileSync('firebase.beta.json', 'utf8')) as BetaConfig;
  const problems = betaConfigProblems(config);
  let target = 'unknown';
  try {
    target = bundleDatabase(readBundle());
  } catch {
    problems.push('dist/ is missing. Run `npm run export:beta` first.');
  }
  if (target !== 'beta' && !problems.some((p) => p.startsWith('dist/'))) {
    problems.push(`dist/ points at the ${target} database. Run \`npm run export:beta\`.`);
  }
  if (problems.length > 0) {
    for (const line of problems) console.error(line);
    process.exit(1);
  }
  console.log(`dist/ is a beta build (database ${BETA_INSTANCE}). Deploy it with:

  npm run beta:deploy

That only touches https://${BETA_SITE}.web.app and the ${BETA_INSTANCE} database. See docs/BETA.md.`);
}

if (require.main === module) main();
