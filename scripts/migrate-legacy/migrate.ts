import {
  computeStandings,
  crossoverBracket,
  finalOnlyBracket,
  resolveBracket,
  scoreSummary,
  summarizeMatch,
  topFourBracket,
  type Bracket,
  type CompletedMatch,
  type TeamId,
} from '@/domain';
import { toMatchResultRecord, toStoredEvent } from '@/data/records';
import {
  EventRecordSchema,
  MatchMetaSchema,
  MatchResultRecordSchema,
  MatchSummarySchema,
  TeamSchema,
  TournamentSchema,
  type EventRecord,
  type MatchMeta,
  type MatchResultRecord,
  type MatchSummary,
  type PlayoffFormat,
  type Stage,
  type Team,
  type Tournament,
} from '@/data/schemas';
import type { z } from 'zod';
import { byCreation, convertMatch, type ConvertedMatch } from './convert';
import {
  LegacyBackupSchema,
  LegacyMatchSchema,
  LegacyTeamSchema,
  LegacyTournamentSchema,
  type LegacyMatch,
  type LegacyTeam,
  type LegacyTournament,
} from './legacy';
import { compareWithLegacy } from './verify';

/** The new database, ready for `firebase database:set`. Roles and scorer codes are not migrated. */
export interface MigratedDatabase {
  tournaments: Record<string, Tournament>;
  teams: Record<string, Team>;
  matches: Record<string, { meta: MatchMeta; head: number; events: Record<string, EventRecord> }>;
  matchSummaries: Record<string, MatchSummary>;
  matchResults: Record<string, MatchResultRecord>;
}

export interface MatchReport {
  id: string;
  title: string;
  /** exact: replay matches v1 in every number; different: migrated, see notes; skipped: not migrated. */
  outcome: 'exact' | 'different' | 'skipped';
  /** Differences from v1, or why the match was skipped. */
  notes: string[];
  /** Where v1's data broke a rule and had to be interpreted (see convertMatch). */
  adjustments: string[];
}

export interface MigrationReport {
  matches: MatchReport[];
  /** Problems with tournaments and teams. */
  notes: string[];
}

export interface MigrationOptions {
  /** Stored as `createdBy` and on every event's `by`. */
  migratedBy: string;
}

const LEGACY_PLAYOFFS = { p1: 'semi-1', p2: 'semi-2', p3: 'third-place', pf: 'final' } as const;
const PLAYOFF_STAGES: Record<string, keyof typeof LEGACY_PLAYOFFS | 'semi'> = {
  semi: 'semi',
  third: 'p3',
  final: 'pf',
};

export function migrateBackup(
  raw: unknown,
  { migratedBy }: MigrationOptions,
): { database: MigratedDatabase; report: MigrationReport } {
  const backup = LegacyBackupSchema.parse(raw);
  const report: MigrationReport = { matches: [], notes: [] };
  const database: MigratedDatabase = {
    tournaments: {},
    teams: {},
    matches: {},
    matchSummaries: {},
    matchResults: {},
  };

  const teams = parseAll(backup.teams, LegacyTeamSchema, 'Team', report.notes);
  const tournaments = parseAll(
    backup.tournaments,
    LegacyTournamentSchema,
    'Tournament',
    report.notes,
  );
  const matches: [string, LegacyMatch][] = [];
  for (const [id, value] of Object.entries(backup.matches)) {
    const parsed = LegacyMatchSchema.safeParse(value);
    if (parsed.success) matches.push([id, parsed.data]);
    else report.matches.push(skipped(id, id, `Unreadable: ${formatIssues(parsed.error)}`));
  }
  matches.sort(([, a], [, b]) => a.timestamp - b.timestamp);

  for (const [id, team] of Object.entries(teams)) {
    put(database.teams, id, toTeam(team), TeamSchema, `Team ${id}`, report.notes);
  }

  // Group and quick matches first: the group standings decide which playoff fixture is which.
  const converted = new Map<string, ConvertedMatch>();
  const playoffMatches: [string, LegacyMatch][] = [];
  for (const [id, match] of matches) {
    if (match.stage && match.stage in PLAYOFF_STAGES) {
      playoffMatches.push([id, match]);
      continue;
    }
    const quick = match.isQuickMatch === true;
    migrateMatch(id, match, {
      stage: quick ? 'quick' : 'group',
      tournamentId: quick ? undefined : tournamentIdOf(match, tournaments),
    });
  }

  for (const [tid, tournament] of Object.entries(tournaments)) {
    const tournamentTeams = Object.entries(teams).filter(
      ([, t]) => (t.tournamentId ?? 'default') === tid,
    );
    const groups = [...new Set(tournamentTeams.map(([, t]) => t.group ?? 'A'))].sort();
    const format = playoffFormat(tournament, groups.length);
    const bracket = bracketFor(format, groups, !!tournament.playoffs?.p3);

    const groupResults: CompletedMatch[] = [];
    for (const [id, c] of converted) {
      if (
        c.meta.stage === 'group' &&
        c.meta.tournamentId === tid &&
        c.state.status === 'complete'
      ) {
        groupResults.push(summarizeMatch(id, c.state));
      }
    }
    const rankings = Object.fromEntries(
      groups.map((group) => {
        const ids = tournamentTeams.filter(([, t]) => (t.group ?? 'A') === group).map(([id]) => id);
        return [group, computeStandings(ids, groupResults).map((row) => row.team)];
      }),
    );

    const winners = bracket ? playoffWinners(bracket, rankings, tournament, report.notes) : {};
    const resolved = bracket ? resolveBracket(bracket, rankings, winners) : null;

    for (const [id, match] of playoffMatches) {
      if (tournamentIdOf(match, tournaments) !== tid) continue;
      const fixture = resolved?.fixtures.find((f) =>
        samePair([f.home, f.away], [match.teamA, match.teamB]),
      );
      if (!fixture) {
        report.matches.push(
          skipped(id, titleOf(match, teams), 'No playoff fixture has these two teams'),
        );
        continue;
      }
      migrateMatch(id, match, { stage: 'playoff', tournamentId: tid, fixtureId: fixture.id });
    }

    const record: Tournament = {
      name: tournament.name.trim(),
      status:
        tournament.status === 'completed' || tournament.status === 'complete'
          ? 'complete'
          : 'active',
      oversDefault: tournament.oversDefault,
      playoffFormat: format,
      thirdPlace: !!tournament.playoffs?.p3,
      createdAt: tournament.createdAt ?? matches[0]?.[1].timestamp ?? 0,
      createdBy: migratedBy,
      ...(Object.keys(winners).length ? { playoffWinners: winners } : {}),
    };
    put(database.tournaments, tid, record, TournamentSchema, `Tournament ${tid}`, report.notes);
  }

  report.matches.sort((a, b) => a.id.localeCompare(b.id));
  return { database, report };

  function migrateMatch(
    id: string,
    match: LegacyMatch,
    placement: { stage: Stage; tournamentId: string | undefined; fixtureId?: string },
  ) {
    const matchTeams = match.isQuickMatch ? (match.quickTeams ?? {}) : teams;
    const title = titleOf(match, matchTeams);
    let result: ConvertedMatch;
    try {
      result = convertMatch(match, {
        teams: matchTeams,
        stage: placement.stage,
        ...(placement.tournamentId ? { tournamentId: placement.tournamentId } : {}),
        ...(placement.fixtureId ? { fixtureId: placement.fixtureId } : {}),
        createdBy: migratedBy,
      });
    } catch (error) {
      report.matches.push(skipped(id, title, (error as Error).message));
      return;
    }
    converted.set(id, result);

    const names = Object.fromEntries(
      Object.entries(result.meta.teams).map(([tid, t]) => [tid, t.name]),
    );
    const { differences: notes, info } = compareWithLegacy(match, result.state, names);
    const events: Record<string, EventRecord> = {};
    result.events.forEach(({ event, playerName }, i) => {
      put(
        events,
        String(i),
        { ...toStoredEvent(event, playerName), by: migratedBy, at: match.timestamp },
        EventRecordSchema,
        `Event ${i}`,
        notes,
      );
    });
    const meta = MatchMetaSchema.safeParse(result.meta);
    if (!meta.success) notes.push(`Setup: ${formatIssues(meta.error)}`);
    database.matches[id] = { meta: result.meta, head: result.events.length, events };

    const summary = scoreSummary(result.state);
    put(
      database.matchSummaries,
      id,
      {
        stage: result.meta.stage,
        ...(result.meta.tournamentId ? { tournamentId: result.meta.tournamentId } : {}),
        teamA: result.meta.teamA,
        teamB: result.meta.teamB,
        status: summary.status,
        updatedAt: match.timestamp,
        innings: summary.innings,
        ...(summary.result ? { result: summary.result } : {}),
      },
      MatchSummarySchema,
      'Summary',
      notes,
    );
    if (result.state.status === 'complete') {
      put(
        database.matchResults,
        id,
        toMatchResultRecord(id, result.meta, result.state),
        MatchResultRecordSchema,
        'Result',
        notes,
      );
    }
    report.matches.push({
      id,
      title,
      outcome: notes.length ? 'different' : 'exact',
      notes,
      adjustments: [...result.adjustments, ...info],
    });
  }
}

function toTeam(team: LegacyTeam): Team {
  const players = byCreation(team);
  return {
    name: team.name.trim(),
    tournamentId: team.tournamentId ?? 'default',
    group: team.group ?? 'A',
    ...(team.captain && team.players[team.captain] ? { captainId: team.captain } : {}),
    players: Object.fromEntries(
      players.map(([pid, p], order) => [pid, { name: p.name.trim(), order }]),
    ),
  };
}

function tournamentIdOf(
  match: LegacyMatch,
  tournaments: Record<string, LegacyTournament>,
): string | undefined {
  if (match.tournamentId) return match.tournamentId;
  const ids = Object.keys(tournaments);
  return ids.length === 1 ? ids[0] : undefined;
}

function playoffFormat(tournament: LegacyTournament, groupCount: number): PlayoffFormat {
  const p = tournament.playoffs;
  if (!p || (!p.p1 && !p.p2 && !p.pf)) return 'none';
  if (!p.p1 && !p.p2) return 'final_only';
  return groupCount >= 2 ? 'crossover' : 'top_four';
}

function bracketFor(format: PlayoffFormat, groups: string[], thirdPlace: boolean): Bracket | null {
  const [first = 'A', second = 'B'] = groups;
  switch (format) {
    case 'crossover':
      return crossoverBracket(first, second, { thirdPlace });
    case 'top_four':
      return topFourBracket(first, { thirdPlace });
    case 'final_only':
      return finalOnlyBracket(first);
    case 'none':
      return null;
  }
}

/**
 * v1 stored each playoff as {a, b, w}. Semi-finals are matched to the new bracket by their
 * teams (v1's p1 may be the new semi-2); the rest follow from the semis.
 */
function playoffWinners(
  bracket: Bracket,
  rankings: Record<string, TeamId[]>,
  tournament: LegacyTournament,
  notes: string[],
): Record<string, TeamId> {
  const winners: Record<string, TeamId> = {};
  const legacy = tournament.playoffs ?? {};
  for (const fixture of bracket.fixtures) {
    const resolved = resolveBracket(bracket, rankings, winners).fixtures.find(
      (f) => f.id === fixture.id,
    );
    if (!resolved) continue;
    const played = Object.values(legacy).find(
      (p) => p && samePair([p.a, p.b], [resolved.home, resolved.away]),
    );
    if (!played) {
      const expected = Object.entries(LEGACY_PLAYOFFS).find(([, id]) => id === fixture.id)?.[0];
      if (expected && legacy[expected as keyof typeof legacy]) {
        notes.push(
          `${fixture.name}: v1's teams don't match the standings (${resolved.home} v ${resolved.away})`,
        );
      }
      continue;
    }
    if (played.w) winners[fixture.id] = played.w;
  }
  return winners;
}

function samePair(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
  return (
    a.length === 2 &&
    b.length === 2 &&
    ((a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]))
  );
}

function titleOf(match: LegacyMatch, teams: Record<string, LegacyTeam>): string {
  const name = (id: string) => teams[id]?.name.trim() ?? id;
  const date = new Date(match.timestamp).toISOString().slice(0, 10);
  return `${date} ${name(match.teamA)} v ${name(match.teamB)}${match.stage && match.stage !== 'group' ? ` (${match.stage})` : ''}`;
}

function skipped(id: string, title: string, reason: string): MatchReport {
  return { id, title, outcome: 'skipped', notes: [reason], adjustments: [] };
}

function parseAll<T>(
  records: Record<string, unknown>,
  schema: z.ZodType<T>,
  kind: string,
  notes: string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, value] of Object.entries(records)) {
    const parsed = schema.safeParse(value);
    if (parsed.success) out[id] = parsed.data;
    else notes.push(`${kind} ${id} skipped: ${formatIssues(parsed.error)}`);
  }
  return out;
}

/** Stores a record only if it passes the same schema the app reads with. */
function put<T>(
  target: Record<string, T>,
  key: string,
  value: T,
  schema: z.ZodType,
  what: string,
  notes: string[],
) {
  const parsed = schema.safeParse(value);
  if (parsed.success) target[key] = value;
  else notes.push(`${what} is invalid: ${formatIssues(parsed.error)}`);
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ');
}
