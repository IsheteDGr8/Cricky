import { z } from 'zod';

/**
 * The v1 app's database, as far as the migration needs it. Lenient on purpose:
 * unknown fields are ignored, and anything the converter can't use is reported, not guessed.
 */

/** Firebase stores arrays with holes as objects; either way we want the values in order. */
const listOf = <T extends z.ZodType>(item: T) =>
  z.union([z.array(item.nullable()), z.record(z.string(), item.nullable())]).transform((value) =>
    (Array.isArray(value)
      ? value
      : Object.entries(value)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, v]) => v)
    ).filter((v): v is z.infer<T> => v !== null),
  );

export const LegacyPlayerSchema = z.object({ name: z.string() });

export const LegacyTeamSchema = z.object({
  name: z.string(),
  group: z.string().optional(),
  captain: z.string().optional(),
  tournamentId: z.string().optional(),
  players: z.record(z.string(), LegacyPlayerSchema).default({}),
});
export type LegacyTeam = z.infer<typeof LegacyTeamSchema>;

const BallEntrySchema = z.object({
  type: z.literal('ball'),
  label: z.union([z.string(), z.number()]).transform(String),
  text: z.string(),
});
const OtherEntrySchema = z.object({ type: z.string() });
export const CommentaryEntrySchema = z.union([BallEntrySchema, OtherEntrySchema]);
export type BallEntry = z.infer<typeof BallEntrySchema>;

/** Per-player numbers the v1 app kept for an innings; batters and bowlers share one map. */
export const LegacyPlayerStatsSchema = z.object({
  batOrder: z.number().optional(),
  runs: z.number().optional(),
  balls: z.number().optional(),
  fours: z.number().optional(),
  sixes: z.number().optional(),
  dismissal: z.string().optional(),
  bowlOrder: z.number().optional(),
  ballsBowled: z.number().optional(),
  runsConceded: z.number().optional(),
  wickets: z.number().optional(),
});
export type LegacyPlayerStats = z.infer<typeof LegacyPlayerStatsSchema>;

export const LegacyInningsSchema = z.object({
  teamId: z.string().optional(),
  battingTeam: z.string().optional(),
  runs: z.number().default(0),
  wickets: z.number().default(0),
  overs: z.string().default('0.0'),
  playerStats: z.record(z.string(), LegacyPlayerStatsSchema).default({}),
  /** Dismissed batters in the order they were out: more reliable than the commentary text. */
  outPlayers: listOf(z.string()).default([]),
  commentaryLog: listOf(CommentaryEntrySchema).default([]),
});
export type LegacyInnings = z.infer<typeof LegacyInningsSchema>;

export const LegacyMatchSchema = z.object({
  teamA: z.string(),
  teamB: z.string(),
  oversLimit: z.number(),
  status: z.string(),
  timestamp: z.number(),
  toss: z.object({ winner: z.string(), choice: z.enum(['bat', 'bowl']) }),
  tournamentId: z.string().optional(),
  stage: z.string().optional(),
  isQuickMatch: z.boolean().optional(),
  quickTeams: z.record(z.string(), LegacyTeamSchema).optional(),
  currentInnings: z.number().optional(),
  innings1: LegacyInningsSchema.optional(),
  innings2: LegacyInningsSchema.optional(),
  /** The innings in progress. */
  state: LegacyInningsSchema.optional(),
  potm: z.object({ playerId: z.string() }).optional(),
  result: z.string().optional(),
});
export type LegacyMatch = z.infer<typeof LegacyMatchSchema>;

const LegacyPlayoffSchema = z.object({ a: z.string(), b: z.string(), w: z.string().optional() });

export const LegacyTournamentSchema = z.object({
  name: z.string(),
  oversDefault: z.number(),
  status: z.string(),
  createdAt: z.number().optional(),
  playoffs: z
    .object({
      p1: LegacyPlayoffSchema.optional(),
      p2: LegacyPlayoffSchema.optional(),
      p3: LegacyPlayoffSchema.optional(),
      pf: LegacyPlayoffSchema.optional(),
    })
    .optional(),
});
export type LegacyTournament = z.infer<typeof LegacyTournamentSchema>;

/** Top level: each record is parsed on its own so one bad record doesn't hide the rest. */
export const LegacyBackupSchema = z.object({
  tournaments: z.record(z.string(), z.unknown()).default({}),
  teams: z.record(z.string(), z.unknown()).default({}),
  matches: z.record(z.string(), z.unknown()).default({}),
});

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

/** Creation time encoded in a Firebase push id, or null if the id isn't one. */
export function pushIdTime(id: string): number | null {
  if (id.length !== 20) return null;
  let time = 0;
  for (const char of id.slice(0, 8)) {
    const value = PUSH_CHARS.indexOf(char);
    if (value < 0) return null;
    time = time * 64 + value;
  }
  return time;
}
