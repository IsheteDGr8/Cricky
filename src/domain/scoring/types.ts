export type TeamId = string;
export type PlayerId = string;

export type TossDecision = 'bat' | 'bowl';

export interface MatchSetup {
  teamA: TeamId;
  teamB: TeamId;
  /** Registered players per team. Each team's wicket limit is (squad size - 1). */
  squads: Readonly<Record<TeamId, readonly PlayerId[]>>;
  oversPerInnings: number;
  toss: { winner: TeamId; decision: TossDecision };
}

export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye';

/** Dismissals that happen on a delivery. `retired_out` is recorded with a `retire` event instead. */
export type DeliveryDismissalKind =
  'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket';

export type DismissalKind = DeliveryDismissalKind | 'retired_out';

export interface DeliveryWicket {
  kind: DeliveryDismissalKind;
  playerOut: PlayerId;
  fielder?: PlayerId;
}

/**
 * `runs` means:
 * - no extra:  runs off the bat
 * - wide:      runs taken in addition to the 1-run wide penalty
 * - no_ball:   runs off the bat, in addition to the 1-run no-ball penalty
 * - bye / leg_bye: runs taken
 */
export interface DeliveryEvent {
  type: 'delivery';
  runs: number;
  extra?: ExtraType;
  wicket?: DeliveryWicket;
}

export type MatchEvent =
  | { type: 'set_openers'; striker: PlayerId; nonStriker: PlayerId }
  | { type: 'set_bowler'; bowler: PlayerId }
  | DeliveryEvent
  | { type: 'new_batter'; batter: PlayerId }
  | { type: 'swap_strike' }
  | { type: 'retire'; batter: PlayerId; kind: 'retired_hurt' | 'retired_out' }
  | { type: 'end_innings' }
  | { type: 'set_overs'; overs: number }
  | { type: 'add_player'; team: TeamId; player: PlayerId }
  | { type: 'set_player_of_match'; player: PlayerId | null };

export type MatchEventType = MatchEvent['type'];

export interface Dismissal {
  kind: DismissalKind;
  bowler?: PlayerId;
  fielder?: PlayerId;
}

export interface BatterLine {
  player: PlayerId;
  runs: number;
  /** Legal balls + no-balls faced. Wides are not balls faced. */
  balls: number;
  fours: number;
  sixes: number;
  dismissal: Dismissal | null;
  retiredHurt: boolean;
}

export interface BowlerLine {
  player: PlayerId;
  legalBalls: number;
  /** Runs off the bat + wides + no-balls. Byes and leg-byes are not charged to the bowler. */
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
  maidens: number;
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface FallOfWicket {
  wicket: number;
  player: PlayerId;
  runs: number;
  legalBalls: number;
}

export interface Partnership {
  batters: [PlayerId, PlayerId];
  runs: number;
  legalBalls: number;
}

/** One delivery as it happened, for scorecards, commentary and over-by-over views. */
export interface BallRecord {
  /** Over index (0-based) this delivery belongs to. */
  over: number;
  /** Legal balls completed in the over after this delivery (a wide on the 3rd ball stays at 2). */
  ballInOver: number;
  legal: boolean;
  striker: PlayerId;
  nonStriker: PlayerId;
  bowler: PlayerId;
  runs: number;
  extra: ExtraType | null;
  wicket: DeliveryWicket | null;
  /** Total runs added to the team score by this delivery. */
  totalRuns: number;
  scoreAfter: { runs: number; wickets: number };
}

export type InningsEndReason = 'overs' | 'all_out' | 'target' | 'manual';

export type BatterSlot = 'striker' | 'non_striker';

export interface InningsState {
  number: 1 | 2;
  battingTeam: TeamId;
  bowlingTeam: TeamId;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: Extras;
  striker: PlayerId | null;
  nonStriker: PlayerId | null;
  bowler: PlayerId | null;
  /** Bowler of the most recently completed over; may not bowl the next one. */
  previousOverBowler: PlayerId | null;
  /** Set after a wicket or retirement until a `new_batter` event fills the slot. */
  awaitingBatter: BatterSlot | null;
  batters: Record<PlayerId, BatterLine>;
  battingOrder: PlayerId[];
  bowlers: Record<PlayerId, BowlerLine>;
  bowlingOrder: PlayerId[];
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];
  deliveries: BallRecord[];
  /** Book-keeping for maidens: bowler-charged runs in the current over, and whether the bowler changed mid-over. */
  currentOver: {
    bowler: PlayerId | null;
    runsConceded: number;
    deliveries: number;
    bowlerChanged: boolean;
  };
  endReason: InningsEndReason | null;
}

export type MatchResult =
  | {
      kind: 'win';
      winner: TeamId;
      loser: TeamId;
      margin:
        { by: 'runs'; runs: number } | { by: 'wickets'; wickets: number; ballsRemaining: number };
    }
  | { kind: 'tie' };

export type MatchStatus = 'in_progress' | 'complete';

export interface MatchState {
  teamA: TeamId;
  teamB: TeamId;
  squads: Record<TeamId, PlayerId[]>;
  oversPerInnings: number;
  innings: InningsState[];
  status: MatchStatus;
  result: MatchResult | null;
  playerOfMatch: PlayerId | null;
}
