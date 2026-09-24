import type { InningsState, MatchState, TeamId } from '@/domain';
import type { LegacyInnings, LegacyMatch } from './legacy';

export interface Comparison {
  /** Numbers that don't match v1. Empty means the migration reproduced the match exactly. */
  differences: string[];
  /** Expected differences, e.g. wicket margins (see below). */
  info: string[];
}

/**
 * Compares a replayed match with what the v1 app stored for it:
 * innings totals, every batting and bowling line, the result and Player of the Match.
 *
 * Wicket margins are informational only: early v1 computed them from a fixed 8-wicket
 * limit, while the new rules use squad size - 1, so the same result can read differently.
 */
export function compareWithLegacy(
  match: LegacyMatch,
  state: MatchState,
  teamNames: Readonly<Record<TeamId, string>>,
): Comparison {
  const differences: string[] = [];
  const info: string[] = [];
  const check = (what: string, legacy: unknown, replayed: unknown) => {
    if (legacy !== replayed)
      differences.push(`${what}: v1 ${String(legacy)}, replay ${String(replayed)}`);
  };

  ([1, 2] as const).forEach((number) => {
    const legacy =
      number === 1
        ? match.innings1
        : (match.innings2 ?? (match.currentInnings === 2 ? match.state : undefined));
    const inn = state.innings[number - 1];
    if (!legacy) return;
    if (!inn) {
      differences.push(`Innings ${number}: missing from the replay`);
      return;
    }
    compareInnings(`Innings ${number}`, legacy, inn, check);
  });

  if (match.status === 'completed') {
    check('Status', 'complete', state.status);
    if (match.result !== undefined) {
      const replayed = resultText(state, teamNames);
      const byWickets = / won by \d+ wickets$/;
      if (
        match.result !== replayed &&
        byWickets.test(match.result) &&
        byWickets.test(replayed) &&
        match.result.replace(/\d+ wickets$/, '') === replayed.replace(/\d+ wickets$/, '')
      ) {
        info.push(`v1 showed "${match.result}"; the new rules give "${replayed}"`);
      } else {
        check('Result', match.result, replayed);
      }
    }
    check('Player of the Match', match.potm?.playerId ?? null, state.playerOfMatch);
  }
  return { differences, info };
}

function compareInnings(
  label: string,
  legacy: LegacyInnings,
  inn: InningsState,
  check: (what: string, legacy: unknown, replayed: unknown) => void,
) {
  check(`${label} runs`, legacy.runs, inn.runs);
  check(`${label} wickets`, legacy.wickets, inn.wickets);
  check(`${label} balls`, ballsFromOvers(legacy.overs), inn.legalBalls);

  for (const [pid, s] of Object.entries(legacy.playerStats)) {
    if (s.batOrder !== undefined) {
      const line = inn.batters[pid];
      const who = `${label} batter ${pid}`;
      if (!line) {
        check(`${who} batted`, true, false);
        continue;
      }
      check(`${who} runs`, s.runs ?? 0, line.runs);
      check(`${who} balls`, s.balls ?? 0, line.balls);
      check(`${who} fours`, s.fours ?? 0, line.fours);
      check(`${who} sixes`, s.sixes ?? 0, line.sixes);
      check(`${who} out`, s.dismissal !== undefined, line.dismissal !== null);
    }
    if (s.bowlOrder !== undefined) {
      const line = inn.bowlers[pid];
      const who = `${label} bowler ${pid}`;
      if (!line) {
        check(`${who} bowled`, true, false);
        continue;
      }
      check(`${who} balls`, s.ballsBowled ?? 0, line.legalBalls);
      check(`${who} runs`, s.runsConceded ?? 0, line.runsConceded);
      check(`${who} wickets`, s.wickets ?? 0, line.wickets);
    }
  }
}

/** The v1 result line, e.g. "Pitch Predators won by 6 wickets". */
function resultText(state: MatchState, names: Readonly<Record<TeamId, string>>): string {
  const result = state.result;
  if (!result) return 'no result';
  if (result.kind === 'tie') return 'Match Tied';
  const margin =
    result.margin.by === 'runs' ? `${result.margin.runs} runs` : `${result.margin.wickets} wickets`;
  return `${names[result.winner] ?? result.winner} won by ${margin}`;
}

function ballsFromOvers(overs: string): number {
  const [whole = '0', part = '0'] = overs.split('.');
  return Number(whole) * 6 + Number(part);
}
