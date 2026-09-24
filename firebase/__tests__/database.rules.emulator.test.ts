/// <reference types="node" />
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const NOW = { '.sv': 'timestamp' };
const CODE = 'ABCDEFGH23';
const OWNER = 'owner-uid';
const ADMIN = 'admin-uid';
const SCORER = 'scorer-uid';
const STRANGER = 'stranger-uid';

let env: RulesTestEnvironment;

const meta = (overrides: Record<string, unknown> = {}) => ({
  stage: 'group',
  tournamentId: 't1',
  teamA: 'A',
  teamB: 'B',
  teams: { A: { name: 'Huskies' }, B: { name: 'Eagles' } },
  players: {
    a1: { name: 'Asha', team: 'A', order: 0 },
    a2: { name: 'Ben', team: 'A', order: 1 },
    b1: { name: 'Cara', team: 'B', order: 0 },
    b2: { name: 'Dev', team: 'B', order: 1 },
  },
  oversPerInnings: 5,
  toss: { winner: 'A', decision: 'bat' },
  createdAt: 1,
  createdBy: ADMIN,
  locked: false,
  ...overrides,
});

const event = (uid: string, fields: Record<string, unknown>) => ({ ...fields, by: uid, at: NOW });

const seed = {
  roles: { [OWNER]: 'owner', [ADMIN]: 'admin' },
  tournaments: {
    t1: {
      name: 'UWB T10',
      status: 'active',
      oversDefault: 10,
      playoffFormat: 'crossover',
      thirdPlace: true,
      createdAt: 1,
      createdBy: ADMIN,
    },
  },
  matches: {
    m1: {
      meta: meta(),
      head: 1,
      events: { '0': { type: 'set_openers', striker: 'a1', nonStriker: 'a2', by: SCORER, at: 1 } },
    },
  },
  scorerCodes: { m1: { code: CODE } },
  scorers: { m1: { [SCORER]: { code: CODE, at: 1 } } },
};

const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();

beforeAll(async () => {
  // Every denied write logs a FIREBASE WARNING; denials are what these tests expect.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  env = await initializeTestEnvironment({
    projectId: 'demo-cricky',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: readFileSync(join(__dirname, '..', 'database.rules.json'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set(seed);
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('default deny', () => {
  it('nobody can read or write the root', async () => {
    await assertFails(db().ref().get());
    await assertFails(db(ADMIN).ref().get());
    await assertFails(db(OWNER).ref('unknown').set(true));
  });
});

describe('public data', () => {
  it('viewers without an account can read tournaments, teams, matches, summaries and results', async () => {
    for (const path of ['tournaments', 'teams', 'matches', 'matchSummaries', 'matchResults']) {
      await assertSucceeds(db().ref(path).get());
    }
  });

  it('viewers cannot write anything', async () => {
    await assertFails(db().ref('tournaments/t2').set(seed.tournaments.t1));
    await assertFails(db().ref('matches/m1/head').set(2));
  });
});

describe('roles', () => {
  it('a user can read their own role only', async () => {
    await assertSucceeds(db(ADMIN).ref(`roles/${ADMIN}`).get());
    await assertFails(db(ADMIN).ref(`roles/${OWNER}`).get());
    await assertFails(db(ADMIN).ref('roles').get());
  });

  it('only the owner can grant or revoke admin', async () => {
    await assertSucceeds(db(OWNER).ref('roles').get());
    await assertSucceeds(db(OWNER).ref(`roles/${STRANGER}`).set('admin'));
    await assertSucceeds(db(OWNER).ref(`roles/${STRANGER}`).remove());
    await assertFails(db(ADMIN).ref(`roles/${STRANGER}`).set('admin'));
    await assertFails(db(STRANGER).ref(`roles/${STRANGER}`).set('admin'));
  });

  it('nobody can create another owner or change their own role', async () => {
    await assertFails(db(OWNER).ref(`roles/${STRANGER}`).set('owner'));
    await assertFails(db(OWNER).ref(`roles/${OWNER}`).set('admin'));
  });
});

describe('tournaments and teams', () => {
  const team = {
    name: 'Huskies',
    tournamentId: 't1',
    group: 'A',
    captainId: 'p1',
    players: { p1: { name: 'Asha', order: 0 } },
  };

  it('admins can create and edit them', async () => {
    await assertSucceeds(
      db(ADMIN)
        .ref('tournaments/t2')
        .set({ ...seed.tournaments.t1, name: 'Cup' }),
    );
    await assertSucceeds(db(ADMIN).ref('tournaments/t1/playoffWinners/final').set('A'));
    await assertSucceeds(db(ADMIN).ref('teams/A').set(team));
  });

  it('signed-in non-admins cannot', async () => {
    await assertFails(db(STRANGER).ref('tournaments/t2').set(seed.tournaments.t1));
    await assertFails(db(SCORER).ref('teams/A').set(team));
  });

  it('rejects invalid fields', async () => {
    const t = seed.tournaments.t1;
    await assertFails(
      db(ADMIN)
        .ref('tournaments/t2')
        .set({ ...t, oversDefault: 51 }),
    );
    await assertFails(
      db(ADMIN)
        .ref('tournaments/t2')
        .set({ ...t, status: 'deleted' }),
    );
    await assertFails(
      db(ADMIN)
        .ref('tournaments/t2')
        .set({ ...t, name: 'x'.repeat(61) }),
    );
    await assertFails(
      db(ADMIN)
        .ref('tournaments/t2')
        .set({ ...t, extra: true }),
    );
    await assertFails(
      db(ADMIN)
        .ref('teams/A')
        .set({ ...team, captainId: 'nobody' }),
    );
    await assertFails(
      db(ADMIN)
        .ref('teams/A')
        .set({ ...team, players: { p1: { name: '', order: 0 } } }),
    );
  });
});

describe('creating matches', () => {
  it('admins can create a match with head 0', async () => {
    await assertSucceeds(db(ADMIN).ref('matches/m2').set({ meta: meta(), head: 0 }));
  });

  it('scorers and strangers cannot create matches', async () => {
    await assertFails(db(SCORER).ref('matches/m2').set({ meta: meta(), head: 0 }));
    await assertFails(db(STRANGER).ref('matches/m2').set({ meta: meta(), head: 0 }));
  });

  it('validates the setup', async () => {
    const bad = [
      meta({ teamB: 'A' }),
      meta({ teamB: 'C' }),
      meta({ oversPerInnings: 0 }),
      meta({ toss: { winner: 'C', decision: 'bat' } }),
      meta({ players: { x: { name: 'X', team: 'C', order: 0 } } }),
      meta({ stage: 'friendly' }),
    ];
    for (const m of bad) await assertFails(db(ADMIN).ref('matches/m2').set({ meta: m, head: 0 }));
  });
});

describe('scorer codes', () => {
  it('are readable and writable by admins only', async () => {
    await assertSucceeds(db(ADMIN).ref('scorerCodes/m1').get());
    await assertSucceeds(db(ADMIN).ref('scorerCodes/m1').set({ code: 'ZZZZZZZZ22' }));
    await assertFails(db(SCORER).ref('scorerCodes/m1').get());
    await assertFails(db(STRANGER).ref('scorerCodes/m1').get());
    await assertFails(db().ref('scorerCodes/m1').get());
  });

  it('must be 10 characters from the unambiguous alphabet', async () => {
    await assertFails(db(ADMIN).ref('scorerCodes/m1').set({ code: 'ABCDEFGH2' }));
    await assertFails(db(ADMIN).ref('scorerCodes/m1').set({ code: 'ABCDEFGHI0' }));
  });

  it('a signed-in user becomes a scorer only with the right code', async () => {
    await assertFails(
      db(STRANGER).ref(`scorers/m1/${STRANGER}`).set({ code: 'WRONGCODE2', at: NOW }),
    );
    await assertSucceeds(db(STRANGER).ref(`scorers/m1/${STRANGER}`).set({ code: CODE, at: NOW }));
  });

  it('nobody can register someone else, and scorers cannot list other scorers', async () => {
    await assertFails(db(STRANGER).ref(`scorers/m1/${SCORER}`).set({ code: CODE, at: NOW }));
    await assertFails(db(SCORER).ref('scorers/m1').get());
    await assertSucceeds(db(SCORER).ref(`scorers/m1/${SCORER}`).get());
    await assertSucceeds(db(ADMIN).ref('scorers/m1').get());
  });

  it('signed-out users cannot redeem', async () => {
    await assertFails(db().ref('scorers/m1/anyone').set({ code: CODE, at: NOW }));
  });
});

describe('scoring events', () => {
  const append = (uid: string, seq: number, fields: Record<string, unknown>) =>
    db(uid)
      .ref('matches/m1')
      .update({ [`events/${seq}`]: event(uid, fields), head: seq + 1 });
  const undo = (uid: string, seq: number) =>
    db(uid)
      .ref('matches/m1')
      .update({ [`events/${seq}`]: null, head: seq });

  it('a scorer can append the next event', async () => {
    await assertSucceeds(append(SCORER, 1, { type: 'set_bowler', bowler: 'b1' }));
    await assertSucceeds(append(SCORER, 2, { type: 'delivery', runs: 4 }));
    await assertSucceeds(
      append(SCORER, 3, {
        type: 'delivery',
        runs: 0,
        extra: 'wide',
        wicket: { kind: 'stumped', playerOut: 'a1', fielder: 'b2' },
      }),
    );
  });

  it('a scorer can undo the last event only', async () => {
    await assertSucceeds(append(SCORER, 1, { type: 'set_bowler', bowler: 'b1' }));
    await assertFails(undo(SCORER, 0));
    await assertSucceeds(undo(SCORER, 1));
    await assertSucceeds(undo(SCORER, 0));
  });

  it('events cannot skip, overwrite or rewrite history', async () => {
    await assertFails(append(SCORER, 2, { type: 'set_bowler', bowler: 'b1' }));
    await assertFails(append(SCORER, 0, { type: 'set_bowler', bowler: 'b1' }));
    await assertFails(
      db(SCORER)
        .ref('matches/m1/events/0')
        .set(event(SCORER, { type: 'set_bowler', bowler: 'b2' })),
    );
    await assertFails(db(SCORER).ref('matches/m1/head').set(5));
  });

  it('head and events must change together', async () => {
    await assertFails(
      db(SCORER)
        .ref('matches/m1/events/1')
        .set(event(SCORER, { type: 'set_bowler', bowler: 'b1' })),
    );
    await assertFails(db(SCORER).ref('matches/m1/head').set(2));
    await assertFails(db(SCORER).ref('matches/m1/head').set(0));
  });

  it('records who scored and when', async () => {
    await assertFails(
      db(SCORER)
        .ref('matches/m1')
        .update({
          'events/1': { type: 'set_bowler', bowler: 'b1', by: STRANGER, at: NOW },
          head: 2,
        }),
    );
    await assertFails(
      db(SCORER)
        .ref('matches/m1')
        .update({ 'events/1': { type: 'set_bowler', bowler: 'b1', by: SCORER, at: 5 }, head: 2 }),
    );
  });

  it('validates event fields', async () => {
    const bad = [
      { type: 'delivery', runs: 8 },
      { type: 'delivery', runs: 1.5 },
      { type: 'delivery' },
      { type: 'delivery', runs: 1, extra: 'overthrow' },
      { type: 'delivery', runs: 0, wicket: { kind: 'handled_ball', playerOut: 'a1' } },
      { type: 'set_openers', striker: 'a1' },
      { type: 'retire', batter: 'a1', kind: 'timed_out' },
      { type: 'set_overs', overs: 60 },
      { type: 'add_player', team: 'A', player: 'a9' },
      { type: 'teleport' },
      { type: 'swap_strike', note: 'hi' },
    ];
    for (const fields of bad) await assertFails(append(SCORER, 1, fields));
  });

  it('non-scorers cannot score', async () => {
    await assertFails(append(STRANGER, 1, { type: 'set_bowler', bowler: 'b1' }));
    await assertFails(
      db()
        .ref('matches/m1')
        .update({ 'events/1': { type: 'set_bowler', bowler: 'b1', at: NOW }, head: 2 }),
    );
  });

  it('rotating or revoking the code removes access immediately', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.database().ref('scorerCodes/m1/code').set('NEWCODE234'),
    );
    await assertFails(append(SCORER, 1, { type: 'set_bowler', bowler: 'b1' }));
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref('scorerCodes/m1').remove());
    await assertFails(append(SCORER, 1, { type: 'set_bowler', bowler: 'b1' }));
  });

  it('a scorer can lock the match but not unlock it; locked matches reject scorers', async () => {
    await assertSucceeds(db(SCORER).ref('matches/m1/meta/locked').set(true));
    await assertFails(db(SCORER).ref('matches/m1/meta/locked').set(false));
    await assertFails(append(SCORER, 1, { type: 'set_bowler', bowler: 'b1' }));
    await assertSucceeds(db(ADMIN).ref('matches/m1/meta/locked').set(false));
  });

  it('scorers cannot change the match setup', async () => {
    await assertFails(db(SCORER).ref('matches/m1/meta/oversPerInnings').set(20));
  });

  it('admins can score and fix matches', async () => {
    await assertSucceeds(append(ADMIN, 1, { type: 'set_bowler', bowler: 'b1' }));
    await assertSucceeds(db(ADMIN).ref('matches/m1').remove());
  });
});

describe('summaries and results', () => {
  const summary = {
    stage: 'group',
    tournamentId: 't1',
    teamA: 'A',
    teamB: 'B',
    status: 'live',
    innings: [{ battingTeam: 'A', runs: 12, wickets: 1, legalBalls: 9 }],
    updatedAt: NOW,
  };

  it('scorers of that match can write the summary and result', async () => {
    await assertSucceeds(db(SCORER).ref('matchSummaries/m1').set(summary));
    await assertSucceeds(
      db(SCORER)
        .ref('matchSummaries/m1')
        .set({
          ...summary,
          status: 'complete',
          result: { kind: 'win', winner: 'A', by: 'runs', margin: 5 },
        }),
    );
    await assertSucceeds(
      db(SCORER)
        .ref('matchResults/m1')
        .set({
          stage: 'group',
          teamA: 'A',
          teamB: 'B',
          oversPerInnings: 5,
          result: { kind: 'tie' },
          innings: [{ runs: 1 }, { runs: 1 }],
        }),
    );
  });

  it('others cannot', async () => {
    await assertFails(db(STRANGER).ref('matchSummaries/m1').set(summary));
    await assertFails(db(SCORER).ref('matchSummaries/m2').set(summary));
  });

  it('validates the summary', async () => {
    await assertFails(
      db(SCORER)
        .ref('matchSummaries/m1')
        .set({ ...summary, status: 'abandoned' }),
    );
    await assertFails(
      db(SCORER)
        .ref('matchSummaries/m1')
        .set({ ...summary, updatedAt: 1 }),
    );
    await assertFails(
      db(SCORER)
        .ref('matchSummaries/m1')
        .set({ ...summary, innings: [{ battingTeam: 'A', runs: -1, wickets: 0, legalBalls: 0 }] }),
    );
  });
});
