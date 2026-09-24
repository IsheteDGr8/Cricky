/**
 * Dry run of the v1 → v2 migration. Reads a database export, writes the converted database next
 * to it and prints what happened to every match. Nothing is sent to Firebase.
 *
 *   npm run migrate:dry-run -- backups/rtdb-2026-09-23-1147.json
 *
 * Exits with 1 if any match was skipped or differs from v1, so it can gate the real import.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { migrateBackup, type MatchReport } from './migrate';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run migrate:dry-run -- <path to database export .json>');
  process.exit(2);
}

const { database, report } = migrateBackup(JSON.parse(readFileSync(input, 'utf8')), {
  migratedBy: 'v1-migration',
});
const output = join(dirname(input), `${basename(input, '.json')}.migrated.json`);
writeFileSync(output, `${JSON.stringify(database, null, 2)}\n`);

const icon: Record<MatchReport['outcome'], string> = {
  exact: 'OK  ',
  different: 'DIFF',
  skipped: 'SKIP',
};
for (const match of report.matches) {
  console.log(`${icon[match.outcome]}  ${match.id}  ${match.title}`);
  for (const note of match.notes) console.log(`        ${note}`);
  for (const adjustment of match.adjustments) console.log(`        (adjusted) ${adjustment}`);
}
for (const note of report.notes) console.log(`NOTE  ${note}`);

const count = (outcome: MatchReport['outcome']) =>
  report.matches.filter((m) => m.outcome === outcome).length;
console.log(
  `\n${count('exact')} exact, ${count('different')} different, ${count('skipped')} skipped.` +
    ` ${Object.keys(database.tournaments).length} tournaments, ${Object.keys(database.teams).length} teams.` +
    `\nWrote ${output}`,
);
process.exitCode = count('exact') === report.matches.length && report.notes.length === 0 ? 0 : 1;
