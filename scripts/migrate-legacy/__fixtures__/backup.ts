/**
 * A tiny v1 database in the exact shape and commentary wording the v1 app wrote.
 * Two 3-player teams (so 2 wickets is all out), one over per side:
 *
 * Innings 1, Huskies bat, Bea bowls: 1, wide + 1, no-ball + 4, 2 byes,
 *   Asha caught by Cal, Dev bowled. All out 10/2 after 4 balls.
 * Innings 2, Eagles bat, Asha bowls: 6, Bo run out by Ben (non-striker), 4, 1. Eagles win.
 */

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

/** A Firebase-style push id created at `time`. */
export function pushId(time: number, suffix: string): string {
  let prefix = '';
  for (let t = time, i = 0; i < 8; i++, t = Math.floor(t / 64))
    prefix = PUSH_CHARS[t % 64] + prefix;
  return (prefix + suffix.padEnd(12, 'x')).slice(0, 20);
}

export const MATCH_TIME = 1_772_000_000_000;
const before = MATCH_TIME - 86_400_000;

export const ids = {
  huskies: pushId(before, 'huskies'),
  eagles: pushId(before, 'eagles'),
  asha: pushId(before, 'asha'),
  ben: pushId(before + 1, 'ben'),
  dev: pushId(before + 2, 'dev'),
  bea: pushId(before, 'bea'),
  bo: pushId(before + 1, 'bo'),
  cal: pushId(before + 2, 'cal'),
  match: pushId(MATCH_TIME, 'match'),
};

const ball = (label: string | number, text: string) => ({ type: 'ball', over: '0.1', label, text });
const out = (text: string) => `<span style="color:var(--danger); font-weight:bold;">${text}</span>`;

export function legacyBackup() {
  return {
    tournaments: {
      default: { name: 'Test Cup', oversDefault: 1, status: 'active', createdAt: before },
    },
    teams: {
      [ids.huskies]: {
        name: 'Huskies',
        group: 'A',
        captain: ids.asha,
        tournamentId: 'default',
        players: {
          [ids.asha]: { name: 'Asha' },
          [ids.ben]: { name: 'Ben' },
          [ids.dev]: { name: 'Dev' },
        },
      },
      [ids.eagles]: {
        name: 'Eagles',
        group: 'A',
        tournamentId: 'default',
        players: {
          [ids.bea]: { name: 'Bea' },
          [ids.bo]: { name: 'Bo' },
          [ids.cal]: { name: 'Cal' },
        },
      },
    },
    matches: {
      [ids.match]: {
        teamA: ids.huskies,
        teamB: ids.eagles,
        oversLimit: 1,
        status: 'completed',
        timestamp: MATCH_TIME,
        tournamentId: 'default',
        toss: { winner: ids.huskies, choice: 'bat' },
        currentInnings: 2,
        innings1: {
          teamId: ids.huskies,
          runs: 10,
          wickets: 2,
          overs: '0.4',
          outPlayers: [ids.asha, ids.dev],
          playerStats: {
            [ids.asha]: {
              batOrder: 1,
              runs: 5,
              balls: 4,
              fours: 1,
              sixes: 0,
              dismissal: 'c Cal b Bea',
            },
            [ids.ben]: { batOrder: 2, runs: 0, balls: 0, fours: 0, sixes: 0 },
            [ids.dev]: { batOrder: 3, runs: 0, balls: 1, fours: 0, sixes: 0, dismissal: 'b Bea' },
            [ids.bea]: { bowlOrder: 1, ballsBowled: 4, runsConceded: 8, wickets: 2, extras: 2 },
          },
          commentaryLog: [
            ball(1, 'Bea to Asha. 1 run.'),
            ball('WD+1', 'Bea to Ben. Wide! 1 extra run.'),
            ball('NB+4', 'Bea to Asha. No ball! 4 runs.'),
            ball('B2', 'Bea to Asha. Bye! 2 runs.'),
            ball('W (C)', `Bea to Asha. ${out('Caught by Cal!')} Asha out at 5. Dev in next.`),
            ball('W', `Bea to Dev. ${out('Bowled!')} Dev out at 0. All out.`),
            { type: 'eoi', text: 'Innings Ended. Huskies scored 10/2 (0.4).' },
          ],
        },
        innings2: {
          teamId: ids.eagles,
          runs: 11,
          wickets: 1,
          overs: '0.4',
          outPlayers: [ids.bo],
          playerStats: {
            [ids.bea]: { batOrder: 1, runs: 11, balls: 4, fours: 1, sixes: 1 },
            [ids.bo]: {
              batOrder: 2,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              dismissal: 'run out (Ben)',
            },
            [ids.cal]: { batOrder: 3, runs: 0, balls: 0, fours: 0, sixes: 0 },
            [ids.asha]: { bowlOrder: 1, ballsBowled: 4, runsConceded: 11, wickets: 0, extras: 0 },
          },
          commentaryLog: [
            ball(6, 'Asha to Bea. 6 runs.'),
            ball('W (RO)', `Asha to Bea. Throw by Ben, ${out('Bo RUN OUT at 0!')} Cal in next.`),
            ball(4, 'Asha to Bea. 4 runs.'),
            ball(1, 'Asha to Bea. 1 run.'),
            { type: 'eoi', text: 'Match Ended. Eagles won by 1 wickets' },
          ],
        },
        potm: { playerId: ids.bea, teamId: ids.eagles, name: 'Bea' },
        result: 'Eagles won by 1 wickets',
      },
    },
  };
}
