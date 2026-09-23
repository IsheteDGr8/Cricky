import type { TeamId } from '../scoring';

export type FixtureId = string;

/** Where a playoff team comes from. */
export type Slot =
  | { from: 'standings'; group: string; position: number }
  | { from: 'winner'; fixture: FixtureId }
  | { from: 'loser'; fixture: FixtureId };

export interface PlayoffFixture {
  id: FixtureId;
  name: string;
  home: Slot;
  away: Slot;
}

export interface Bracket {
  /** In playing order: a fixture may only refer to fixtures listed before it. */
  fixtures: PlayoffFixture[];
  finalId: FixtureId;
}

export interface BracketOptions {
  thirdPlace?: boolean;
}

const seed = (group: string, position: number): Slot => ({ from: 'standings', group, position });
const winnerOf = (fixture: FixtureId): Slot => ({ from: 'winner', fixture });
const loserOf = (fixture: FixtureId): Slot => ({ from: 'loser', fixture });

function semisAndFinal(
  semi1: [Slot, Slot],
  semi2: [Slot, Slot],
  { thirdPlace = true }: BracketOptions,
): Bracket {
  const fixtures: PlayoffFixture[] = [
    { id: 'semi-1', name: 'Semi-final 1', home: semi1[0], away: semi1[1] },
    { id: 'semi-2', name: 'Semi-final 2', home: semi2[0], away: semi2[1] },
  ];
  if (thirdPlace) {
    fixtures.push({
      id: 'third-place',
      name: '3rd place',
      home: loserOf('semi-1'),
      away: loserOf('semi-2'),
    });
  }
  fixtures.push({ id: 'final', name: 'Final', home: winnerOf('semi-1'), away: winnerOf('semi-2') });
  return { fixtures, finalId: 'final' };
}

/** Two groups: A1 v B2 and B1 v A2, then the final (and optional 3rd-place match). */
export function crossoverBracket(
  groupA = 'A',
  groupB = 'B',
  options: BracketOptions = {},
): Bracket {
  return semisAndFinal(
    [seed(groupA, 1), seed(groupB, 2)],
    [seed(groupB, 1), seed(groupA, 2)],
    options,
  );
}

/** One group: 1 v 4 and 2 v 3, then the final (and optional 3rd-place match). */
export function topFourBracket(group = 'A', options: BracketOptions = {}): Bracket {
  return semisAndFinal([seed(group, 1), seed(group, 4)], [seed(group, 2), seed(group, 3)], options);
}

/** One group: 1 v 2 in a final. */
export function finalOnlyBracket(group = 'A'): Bracket {
  return {
    fixtures: [{ id: 'final', name: 'Final', home: seed(group, 1), away: seed(group, 2) }],
    finalId: 'final',
  };
}

export interface ResolvedFixture {
  id: FixtureId;
  name: string;
  home: TeamId | null;
  away: TeamId | null;
  winner: TeamId | null;
}

export interface ResolvedBracket {
  fixtures: ResolvedFixture[];
  champion: TeamId | null;
}

/**
 * Fills in teams from the standings and earlier results.
 * @param rankings teams in finishing order per group, e.g. `{ A: ['t1', 't3'], B: [...] }`
 * @param winners winning team per fixture that has been played
 */
export function resolveBracket(
  bracket: Bracket,
  rankings: Readonly<Record<string, readonly TeamId[]>>,
  winners: Readonly<Record<FixtureId, TeamId>>,
): ResolvedBracket {
  const resolved = new Map<FixtureId, ResolvedFixture>();

  const teamFor = (slot: Slot): TeamId | null => {
    if (slot.from === 'standings') return rankings[slot.group]?.[slot.position - 1] ?? null;
    const source = resolved.get(slot.fixture);
    if (!source) throw new Error(`Fixture ${slot.fixture} must come before the fixture using it`);
    if (!source.winner) return null;
    if (slot.from === 'winner') return source.winner;
    return source.winner === source.home ? source.away : source.home;
  };

  for (const fixture of bracket.fixtures) {
    const home = teamFor(fixture.home);
    const away = teamFor(fixture.away);
    const winner = winners[fixture.id] ?? null;
    if (winner !== null && winner !== home && winner !== away) {
      throw new Error(`Winner of ${fixture.id} must be one of the teams playing it`);
    }
    resolved.set(fixture.id, { id: fixture.id, name: fixture.name, home, away, winner });
  }

  return {
    fixtures: [...resolved.values()],
    champion: resolved.get(bracket.finalId)?.winner ?? null,
  };
}
