/**
 * Loads a migrated database into the local emulator, plus one demo live match, so the app has
 * real data to show during development. Start the emulators first (`npm run emulators`).
 *
 *   npm run emulators:seed -- backups/rtdb-2026-09-23-1147.migrated.json
 */
import { readFileSync } from 'node:fs';
import { replay, scoreSummary } from '@/domain';
import { toDomainEvent, toMatchSetup } from '@/data/records';
import type { MigratedDatabase } from './migrate-legacy/migrate';

const EMULATOR = 'http://127.0.0.1:9000';
/** The namespace the app uses against the emulator (see src/data/firebase.ts). */
const NAMESPACE = 'demo-cricky-default-rtdb';
const LIVE_ID = 'demo-live';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run emulators:seed -- <path to .migrated.json>');
  process.exit(2);
}
const data = JSON.parse(readFileSync(file, 'utf8')) as MigratedDatabase;

// A copy of the most recent completed match, stopped two thirds of the way through.
const [sourceId, source] = Object.entries(data.matches)
  .filter(([, m]) => m.meta.stage !== 'quick')
  .sort(([, a], [, b]) => b.meta.createdAt - a.meta.createdAt)[0] ?? [undefined, undefined];
if (sourceId && source) {
  const head = Math.floor(source.head * 0.66);
  const events = Object.fromEntries(
    Array.from({ length: head }, (_, i) => [String(i), source.events[String(i)]]),
  );
  const meta = { ...source.meta, stage: 'quick' as const, locked: false, createdAt: Date.now() };
  delete (meta as { tournamentId?: string }).tournamentId;
  delete (meta as { fixtureId?: string }).fixtureId;
  const state = replay(
    toMatchSetup(meta),
    Object.values(events).map((e) => toDomainEvent(e as NonNullable<typeof e>)),
  );
  const summary = scoreSummary(state);
  data.matches[LIVE_ID] = {
    meta,
    head,
    events: events as MigratedDatabase['matches'][string]['events'],
  };
  data.matchSummaries[LIVE_ID] = {
    stage: 'quick',
    teamA: meta.teamA,
    teamB: meta.teamB,
    teamAName: meta.teams[meta.teamA]?.name ?? meta.teamA,
    teamBName: meta.teams[meta.teamB]?.name ?? meta.teamB,
    status: summary.status,
    updatedAt: Date.now(),
    innings: summary.innings,
  };
}

async function upload() {
  const response = await fetch(`${EMULATOR}/.json?ns=${NAMESPACE}`, {
    method: 'PUT',
    // The emulator treats "Bearer owner" as an admin that bypasses the rules.
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  console.log(
    `Seeded ${Object.keys(data.matches).length} matches (including live demo "${LIVE_ID}"), ` +
      `${Object.keys(data.teams).length} teams, ${Object.keys(data.tournaments).length} tournaments.`,
  );
}

upload().catch((error: unknown) => {
  console.error(`Seeding failed: ${String(error)}`);
  process.exitCode = 1;
});
