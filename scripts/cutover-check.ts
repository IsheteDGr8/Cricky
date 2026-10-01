/**
 * Confirms the repo is still in the "v1 is live" state and prints the flip
 * commands. Does not talk to Firebase.
 */
import { readFileSync } from 'node:fs';

const live = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
  hosting: { public: string };
  database: { rules: string };
};
const cutover = JSON.parse(readFileSync('firebase.cutover.json', 'utf8')) as {
  hosting: { public: string };
  database: { rules: string };
};

const problems: string[] = [];
if (live.hosting.public !== 'legacy') {
  problems.push(`firebase.json hosting.public is ${live.hosting.public} (expected legacy)`);
}
if (live.database.rules !== 'firebase/legacy.rules.json') {
  problems.push(`firebase.json rules are ${live.database.rules}`);
}
if (cutover.hosting.public !== 'dist') {
  problems.push('firebase.cutover.json must host dist/');
}
if (cutover.database.rules !== 'firebase/database.rules.json') {
  problems.push('firebase.cutover.json must use the new rules');
}

if (problems.length > 0) {
  for (const line of problems) console.error(line);
  process.exit(1);
}

console.log(`Live config is still v1 (legacy/ + legacy.rules.json).
Cutover file is ready (dist/ + database.rules.json).

When the dry-run report looks good:

  npm run export:web
  npx firebase deploy --config firebase.cutover.json --only hosting,database --project cricky-cricket-analysis
  npx firebase database:set / backups/<name>.migrated.json --project cricky-cricket-analysis --confirm

See docs/CUTOVER.md. This script does not deploy anything.
`);
