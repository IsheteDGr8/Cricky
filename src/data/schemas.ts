import { z } from 'zod';

/**
 * Runtime shapes of every record, matching firebase/database.rules.json.
 * Everything read from the database is parsed with these before the app sees it.
 */

const id = z.string().min(1).max(40);
const name = z.string().min(1).max(40);
const order = z.number().int().min(0).max(99);
const overs = z.number().int().min(1).max(50);

export const RoleSchema = z.enum(['owner', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const StageSchema = z.enum(['group', 'playoff', 'quick']);
export type Stage = z.infer<typeof StageSchema>;

export const PlayoffFormatSchema = z.enum(['none', 'final_only', 'top_four', 'crossover']);
export type PlayoffFormat = z.infer<typeof PlayoffFormatSchema>;

export const TournamentSchema = z.object({
  name: z.string().min(1).max(60),
  status: z.enum(['upcoming', 'active', 'complete', 'archived']),
  oversDefault: overs,
  playoffFormat: PlayoffFormatSchema,
  thirdPlace: z.boolean(),
  createdAt: z.number(),
  createdBy: z.string(),
  playoffWinners: z.record(id, id).optional(),
});
export type Tournament = z.infer<typeof TournamentSchema>;

export const TeamSchema = z.object({
  name,
  tournamentId: id,
  group: z.string().min(1).max(10),
  captainId: id.optional(),
  players: z.record(id, z.object({ name, order })),
});
export type Team = z.infer<typeof TeamSchema>;

export const MatchMetaSchema = z.object({
  stage: StageSchema,
  tournamentId: id.optional(),
  fixtureId: id.optional(),
  teamA: id,
  teamB: id,
  teams: z.record(id, z.object({ name })),
  players: z.record(id, z.object({ name, team: id, order })),
  oversPerInnings: overs,
  toss: z.object({ winner: id, decision: z.enum(['bat', 'bowl']) }),
  createdAt: z.number(),
  createdBy: z.string(),
  locked: z.boolean(),
});
export type MatchMeta = z.infer<typeof MatchMetaSchema>;

const base = { by: z.string(), at: z.number() };

export const EventRecordSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('set_openers'), striker: id, nonStriker: id }),
  z.object({ ...base, type: z.literal('set_bowler'), bowler: id }),
  z.object({
    ...base,
    type: z.literal('delivery'),
    runs: z.number().int().min(0).max(7),
    extra: z.enum(['wide', 'no_ball', 'bye', 'leg_bye']).optional(),
    wicket: z
      .object({
        kind: z.enum(['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket']),
        playerOut: id,
        fielder: id.optional(),
      })
      .optional(),
  }),
  z.object({ ...base, type: z.literal('new_batter'), batter: id }),
  z.object({ ...base, type: z.literal('swap_strike') }),
  z.object({
    ...base,
    type: z.literal('retire'),
    batter: id,
    kind: z.enum(['retired_hurt', 'retired_out']),
  }),
  z.object({ ...base, type: z.literal('end_innings') }),
  z.object({ ...base, type: z.literal('set_overs'), overs }),
  z.object({ ...base, type: z.literal('add_player'), team: id, player: id, playerName: name }),
  z.object({ ...base, type: z.literal('set_player_of_match'), player: id.optional() }),
]);
export type EventRecord = z.infer<typeof EventRecordSchema>;

const inningsScore = z.object({
  battingTeam: id,
  runs: z.number().int().min(0),
  wickets: z.number().int().min(0),
  legalBalls: z.number().int().min(0),
});

export const MatchSummarySchema = z.object({
  stage: StageSchema,
  tournamentId: id.optional(),
  teamA: id,
  teamB: id,
  /** Copied from the match so lists don't need to load every match. */
  teamAName: name,
  teamBName: name,
  status: z.enum(['scheduled', 'live', 'complete']),
  updatedAt: z.number(),
  innings: z.array(inningsScore).max(2).optional(),
  result: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('tie') }),
      z.object({
        kind: z.literal('win'),
        winner: id,
        by: z.enum(['runs', 'wickets']),
        margin: z.number().int().min(0),
      }),
    ])
    .optional(),
});
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

const playerBatting = z.object({
  player: id,
  team: id,
  runs: z.number(),
  balls: z.number(),
  fours: z.number(),
  sixes: z.number(),
  out: z.boolean(),
});

const playerBowling = z.object({
  player: id,
  team: id,
  legalBalls: z.number(),
  runsConceded: z.number(),
  wickets: z.number(),
  maidens: z.number(),
});

const matchResult = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tie') }),
  z.object({
    kind: z.literal('win'),
    winner: id,
    loser: id,
    margin: z.discriminatedUnion('by', [
      z.object({ by: z.literal('runs'), runs: z.number() }),
      z.object({ by: z.literal('wickets'), wickets: z.number(), ballsRemaining: z.number() }),
    ]),
  }),
]);

export const MatchResultRecordSchema = z.object({
  stage: StageSchema,
  tournamentId: id.optional(),
  teamA: id,
  teamB: id,
  oversPerInnings: overs,
  result: matchResult,
  innings: z.tuple([
    inningsScore.extend({ bowlingTeam: id, allOut: z.boolean() }),
    inningsScore.extend({ bowlingTeam: id, allOut: z.boolean() }),
  ]),
  // Empty lists are not stored by the database, so they come back missing.
  batting: z.array(playerBatting).default([]),
  bowling: z.array(playerBowling).default([]),
  playerOfMatch: id.optional(),
});
export type MatchResultRecord = z.infer<typeof MatchResultRecordSchema>;

export const SCORER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SCORER_CODE_LENGTH = 10;
export const ScorerCodeSchema = z
  .string()
  .regex(new RegExp(`^[${SCORER_CODE_ALPHABET}]{${SCORER_CODE_LENGTH}}$`));
