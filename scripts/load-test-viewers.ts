/**
 * Opens many read-only listeners on one match against the local emulator.
 * Confirms each viewer only receives that match, not the whole database.
 *
 *   npm run emulators
 *   npm run emulators:seed -- backups/<file>.migrated.json
 *   npm run load-test -- --viewers 150 --match demo-live
 */
import { initializeApp } from 'firebase/app';
import { connectDatabaseEmulator, get, getDatabase, onValue, ref } from 'firebase/database';
import { EMULATOR_PROJECT_ID } from '../src/data/config';

const HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
const args = parseArgs(process.argv.slice(2));
const viewers = args.viewers ?? 150;
const matchId = args.match ?? 'demo-live';
const seconds = args.seconds ?? 8;

if (viewers < 1 || viewers > 400) {
  console.error('--viewers must be between 1 and 400');
  process.exit(2);
}

const app = initializeApp({
  projectId: EMULATOR_PROJECT_ID,
  databaseURL: `https://${EMULATOR_PROJECT_ID}-default-rtdb.firebaseio.com`,
});
const db = getDatabase(app);
connectDatabaseEmulator(db, HOST, 9000);

async function main(): Promise<void> {
  const snap = await get(ref(db, `matches/${matchId}`));
  if (!snap.exists()) {
    throw new Error(
      `Match ${matchId} is not in the emulator. Seed first: npm run emulators:seed -- backups/<file>.migrated.json`,
    );
  }
  const once = JSON.stringify(snap.val()).length;
  let updates = 0;
  const stops: (() => void)[] = [];
  for (let i = 0; i < viewers; i++) {
    stops.push(
      onValue(ref(db, `matches/${matchId}`), () => {
        updates += 1;
      }),
    );
  }
  await sleep(seconds * 1000);
  for (const stop of stops) stop();
  const bytesPerViewer = once;
  console.log(
    JSON.stringify(
      {
        viewers,
        matchId,
        seconds,
        firstPayloadBytes: bytesPerViewer,
        listenerCallbacks: updates,
        estimatedDownloadBytes: bytesPerViewer * viewers,
      },
      null,
      2,
    ),
  );
  if (bytesPerViewer > 200_000) {
    console.warn('First payload is large; lists should read matchSummaries, not the full match.');
  }
}

function parseArgs(argv: string[]): { viewers?: number; match?: string; seconds?: number } {
  const out: { viewers?: number; match?: string; seconds?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--viewers' && value) out.viewers = Number(value);
    if (key === '--match' && value) out.match = value;
    if (key === '--seconds' && value) out.seconds = Number(value);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
