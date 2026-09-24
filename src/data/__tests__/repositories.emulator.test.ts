/// <reference types="node" />
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInAnonymously,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, ref, set } from 'firebase/database';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyEvent, computeStandings, createMatch, replay, type MatchEvent } from '@/domain';
import { ev } from '@/domain/__fixtures__/scoring';
import { createAuthService, type Session } from '../auth';
import type { DataContext, Listener, Unsubscribe } from '../context';
import { DataError } from '../errors';
import { toMatchSetup } from '../records';
import { createAccessRepository } from '../repositories/access';
import { createMatchRepository, type Listed, type MatchSnapshot } from '../repositories/matches';
import { createTournamentRepository, type WithId } from '../repositories/tournaments';
import type { MatchResultRecord, MatchSummary, Role, Team, Tournament } from '../schemas';

const PROJECT = 'demo-cricky';
const config = {
  apiKey: 'demo-key',
  projectId: PROJECT,
  // Same namespace as the rules-unit-testing environment, which loads the rules under test.
  databaseURL: `https://${PROJECT}.firebaseio.com`,
};

let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [];

function client(name: string) {
  const app = initializeApp(config, `${name}-${Math.random()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const ctx: DataContext = { db, currentUid: () => auth.currentUser?.uid ?? null };
  const access = createAccessRepository(ctx, (n) => new Uint8Array(randomBytes(n)));
  return {
    auth,
    db,
    access,
    session: createAuthService(auth, access),
    tournaments: createTournamentRepository(ctx),
    matches: createMatchRepository(ctx),
  };
}

/** Resolves with the first value from a subscription that satisfies `accept`. */
function next<T>(
  subscribe: (listener: Listener<T>) => Unsubscribe,
  accept: (value: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false;
    let stop: Unsubscribe | undefined;
    const finish = () => {
      done = true;
      stop?.();
    };
    stop = subscribe({
      onData: (value) => {
        if (!done && accept(value)) {
          finish();
          resolve(value);
        }
      },
      onError: (error) => {
        if (!done) {
          finish();
          reject(error);
        }
      },
    });
    if (done) stop();
  });
}

async function expectDataError(promise: Promise<unknown>, code: DataError['code']) {
  await expect(promise).rejects.toMatchObject({ name: 'DataError', code });
}

beforeAll(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: readFileSync(join(__dirname, '../../../firebase/database.rules.json'), 'utf8'),
    },
  });
  await env.clearDatabase();
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, {
    method: 'DELETE',
  });
});

afterAll(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
  await env.cleanup();
});

describe('a full match through the repositories', () => {
  const admin = client('admin');
  const scorer = client('scorer');
  const viewer = client('viewer');
  let tournamentId: string;
  let matchId: string;
  let code: string;

  it('admin signs in and is recognised as an admin', async () => {
    const { user } = await createUserWithEmailAndPassword(
      admin.auth,
      'admin@test.dev',
      'password1',
    );
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.database().ref(`roles/${user.uid}`).set('admin'),
    );
    const session = await next<Session | null>(
      (l) => admin.session.watchSession(l.onData),
      (s) => s?.role === 'admin',
    );
    expect(session).toEqual({ uid: user.uid, isAnonymous: false, role: 'admin' });
  });

  it('admin creates a tournament, two teams and a match', async () => {
    tournamentId = await admin.tournaments.create({
      name: 'Test Cup',
      oversDefault: 1,
      playoffFormat: 'final_only',
      thirdPlace: false,
    });
    const huskies = await admin.tournaments.saveTeam({
      name: 'Huskies',
      tournamentId,
      group: 'A',
      players: { a1: { name: 'Asha', order: 0 }, a2: { name: 'Ben', order: 1 } },
    });
    const eagles = await admin.tournaments.saveTeam({
      name: 'Eagles',
      tournamentId,
      group: 'A',
      players: { b1: { name: 'Cara', order: 0 }, b2: { name: 'Dev', order: 1 } },
    });
    matchId = await admin.matches.create({
      stage: 'group',
      tournamentId,
      teams: [
        { id: huskies, name: 'Huskies' },
        { id: eagles, name: 'Eagles' },
      ],
      players: [
        { id: 'a1', name: 'Asha', team: huskies },
        { id: 'a2', name: 'Ben', team: huskies },
        { id: 'b1', name: 'Cara', team: eagles },
        { id: 'b2', name: 'Dev', team: eagles },
      ],
      oversPerInnings: 1,
      toss: { winner: huskies, decision: 'bat' },
    });
    code = await admin.access.issueScorerCode(matchId);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(await admin.access.getScorerCode(matchId)).toBe(code);
  });

  it('viewers see the tournament, teams and scheduled match without signing in', async () => {
    const tournaments = await next<WithId<Tournament>[]>((l) => viewer.tournaments.watchAll(l));
    expect(tournaments.map((t) => t.name)).toEqual(['Test Cup']);
    const teams = await next<WithId<Team>[]>((l) => viewer.tournaments.watchTeams(tournamentId, l));
    expect(teams.map((t) => t.name)).toEqual(['Eagles', 'Huskies']);
    const summaries = await next<Listed<MatchSummary>>((l) =>
      viewer.matches.watchSummaries({ tournamentId }, l),
    );
    expect(summaries.items).toMatchObject([{ id: matchId, status: 'scheduled' }]);
  });

  it('non-admins cannot create tournaments', async () => {
    await signInAnonymously(scorer.auth);
    await expectDataError(
      scorer.tournaments.create({
        name: 'X',
        oversDefault: 1,
        playoffFormat: 'none',
        thirdPlace: false,
      }),
      'permission_denied',
    );
  });

  it('a scorer needs the right code', async () => {
    await expectDataError(scorer.access.redeemScorerCode(matchId, 'short'), 'invalid_code');
    await expectDataError(scorer.access.redeemScorerCode(matchId, 'ZZZZZZZZZZ'), 'invalid_code');
    const typed = `${code.slice(0, 5).toLowerCase()}-${code.slice(5)}`;
    await scorer.access.redeemScorerCode(matchId, typed);
    expect(await scorer.access.hasRedeemed(matchId)).toBe(true);
  });

  it('the scorer scores the match ball by ball, with an undo, and the viewer follows live', async () => {
    const snapshot = await scorer.matches.get(matchId);
    const setup = toMatchSetup(snapshot.meta);
    let state = createMatch(setup);
    let head = snapshot.head;

    const score = async (event: MatchEvent) => {
      state = applyEvent(state, event);
      await scorer.matches.append(matchId, head, event);
      head += 1;
      await scorer.matches.publishSummary(matchId, snapshot.meta, state);
    };

    await score(ev.openers('a1', 'a2'));
    await score(ev.bowler('b1'));
    await score(ev.runs(2));

    // A mistake, undone.
    await scorer.matches.undo(matchId, head);
    head -= 1;
    state = replay(setup, [ev.openers('a1', 'a2'), ev.bowler('b1')]);

    // Another scorer's stale write is rejected.
    await expectDataError(
      scorer.matches.append(matchId, head - 1, ev.runs(1)),
      'permission_denied',
    );

    for (const event of [ev.runs(4), ev.runs(6), ev.out('bowled', 'a1')]) await score(event);
    expect(state.innings).toHaveLength(2);
    for (const event of [ev.openers('b1', 'b2'), ev.bowler('a1'), ev.runs(6), ev.runs(6)]) {
      await score(event);
    }
    expect(state.status).toBe('complete');
    await score(ev.potm('b1'));
    await scorer.matches.publishResult(matchId, snapshot.meta, state);

    const live = await next<MatchSnapshot>(
      (l) => viewer.matches.watch(matchId, l),
      (s) => s.head === head,
    );
    expect(replay(toMatchSetup(live.meta), live.events)).toEqual(state);
    expect(live.names).toMatchObject({ a1: 'Asha', b1: 'Cara' });
    expect(live.records.every((r) => r.by === scorer.auth.currentUser?.uid)).toBe(true);

    const summaries = await next<Listed<MatchSummary>>(
      (l) => viewer.matches.watchSummaries({ recent: 10 }, l),
      (s) => s.items[0]?.status === 'complete',
    );
    expect(summaries.items[0]).toMatchObject({
      status: 'complete',
      innings: [
        { runs: 10, wickets: 1 },
        { runs: 12, wickets: 0 },
      ],
      result: { kind: 'win', by: 'wickets', margin: 1 },
    });
  });

  it('results feed the standings', async () => {
    const results = await next<Listed<MatchResultRecord>>((l) =>
      viewer.matches.watchResults(tournamentId, l),
    );
    expect(results.invalid).toEqual([]);
    const [a, b] = [results.items[0]?.teamA as string, results.items[0]?.teamB as string];
    const table = computeStandings(
      [a, b],
      results.items.map((r) => ({ ...r, playerOfMatch: r.playerOfMatch ?? null })),
    );
    expect(table.map((row) => [row.team, row.points])).toEqual([
      [b, 2],
      [a, 0],
    ]);
  });

  it('locking stops scoring; rotating the code removes the scorer', async () => {
    await scorer.matches.setLocked(matchId, true);
    const snapshot = await scorer.matches.get(matchId);
    await expectDataError(
      scorer.matches.append(matchId, snapshot.head, ev.potm('a1')),
      'permission_denied',
    );
    await expectDataError(scorer.matches.setLocked(matchId, false), 'permission_denied');

    await admin.matches.setLocked(matchId, false);
    await admin.access.issueScorerCode(matchId);
    await expectDataError(
      scorer.matches.append(matchId, snapshot.head, ev.potm('a1')),
      'permission_denied',
    );
    await admin.access.revokeScorerCode(matchId);
    expect(await admin.access.getScorerCode(matchId)).toBeNull();
  });

  it('corrupt data is reported, not shown', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.database().ref(`matches/${matchId}/events/3`).set({ type: 'teleport' }),
    );
    await expectDataError(viewer.matches.get(matchId), 'invalid_data');
  });

  it('admin deletes the match and everything attached', async () => {
    await admin.matches.remove(matchId);
    await expectDataError(viewer.matches.get(matchId), 'not_found');
    const summaries = await next<Listed<MatchSummary>>((l) =>
      viewer.matches.watchSummaries({ tournamentId }, l),
    );
    expect(summaries.items).toEqual([]);
  });

  it('only the owner can make admins', async () => {
    const owner = client('owner');
    const { user } = await createUserWithEmailAndPassword(
      owner.auth,
      'owner@test.dev',
      'password1',
    );
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.database().ref(`roles/${user.uid}`).set('owner'),
    );
    const scorerUid = scorer.auth.currentUser?.uid as string;
    await expectDataError(admin.access.setAdmin(scorerUid, true), 'permission_denied');
    await owner.access.setAdmin(scorerUid, true);
    const role = await next<Role | null>((l) => scorer.access.watchRole(scorerUid, l));
    expect(role).toBe('admin');
    await owner.access.setAdmin(scorerUid, false);
  });

  it('signed-out writes fail before reaching the server', async () => {
    await expectDataError(
      viewer.tournaments.create({
        name: 'X',
        oversDefault: 1,
        playoffFormat: 'none',
        thirdPlace: false,
      }),
      'not_signed_in',
    );
    await expect(set(ref(viewer.db, 'tournaments/x'), { name: 'x' })).rejects.toThrow();
  });
});
