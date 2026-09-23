import { ScoringError } from './errors';
import { BALLS_PER_OVER } from './overs';
import { computeResult } from './result';
import {
  MAX_OVERS_PER_INNINGS,
  MAX_RUNS_PER_DELIVERY,
  countsAsBallFaced,
  forbidsRuns,
  isBowlerWicket,
  isDismissalAllowed,
  isLegalDelivery,
  penaltyRuns,
  runsChargedToBowler,
  runsCreditedToBatter,
  strikerOnly,
  wicketLimit,
} from './rules';
import type {
  BatterLine,
  BatterSlot,
  BowlerLine,
  DeliveryEvent,
  InningsEndReason,
  InningsState,
  MatchEvent,
  MatchSetup,
  MatchState,
  PlayerId,
  TeamId,
} from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createMatch(setup: MatchSetup): MatchState {
  validateSetup(setup);
  const { teamA, teamB, toss } = setup;
  const tossLoser = toss.winner === teamA ? teamB : teamA;
  const battingFirst = toss.decision === 'bat' ? toss.winner : tossLoser;
  const bowlingFirst = battingFirst === teamA ? teamB : teamA;

  return {
    teamA,
    teamB,
    squads: {
      [teamA]: [...(setup.squads[teamA] ?? [])],
      [teamB]: [...(setup.squads[teamB] ?? [])],
    },
    oversPerInnings: setup.oversPerInnings,
    innings: [newInnings(1, battingFirst, bowlingFirst)],
    status: 'in_progress',
    result: null,
    playerOfMatch: null,
  };
}

/** Returns a new state with `event` applied. Throws `ScoringError` if the event isn't valid now. */
export function applyEvent(state: MatchState, event: MatchEvent): MatchState {
  const draft = clone(state);
  applyInPlace(draft, event);
  return draft;
}

export type ApplyOutcome = { ok: true; state: MatchState } | { ok: false; error: ScoringError };

/** Like `applyEvent`, but returns the error instead of throwing. Useful for UI validation. */
export function tryApplyEvent(state: MatchState, event: MatchEvent): ApplyOutcome {
  try {
    return { ok: true, state: applyEvent(state, event) };
  } catch (error) {
    if (error instanceof ScoringError) return { ok: false, error };
    throw error;
  }
}

/** Rebuilds the match from its setup and full event list. Undo = replay without the last event. */
export function replay(setup: MatchSetup, events: readonly MatchEvent[]): MatchState {
  const state = createMatch(setup);
  events.forEach((event, index) => {
    try {
      applyInPlace(state, event);
    } catch (error) {
      if (error instanceof ScoringError) {
        throw new ScoringError(error.code, error.message, index);
      }
      throw error;
    }
  });
  return state;
}

export function currentInnings(state: MatchState): InningsState {
  const innings = state.innings[state.innings.length - 1];
  if (!innings) throw new Error('Match has no innings');
  return innings;
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

function applyInPlace(state: MatchState, event: MatchEvent): void {
  if (event.type === 'set_player_of_match') {
    setPlayerOfMatch(state, event.player);
    return;
  }
  if (state.status === 'complete') {
    throw new ScoringError('match_complete', 'The match is complete; undo the last event first.');
  }

  switch (event.type) {
    case 'set_openers':
      return setOpeners(state, event.striker, event.nonStriker);
    case 'set_bowler':
      return setBowler(state, event.bowler);
    case 'delivery':
      return recordDelivery(state, event);
    case 'new_batter':
      return newBatter(state, event.batter);
    case 'swap_strike':
      return swapStrike(state);
    case 'retire':
      return retire(state, event.batter, event.kind);
    case 'end_innings':
      return finishInnings(state, 'manual');
    case 'set_overs':
      return setOvers(state, event.overs);
    case 'add_player':
      return addPlayer(state, event.team, event.player);
  }
}

function setOpeners(state: MatchState, striker: PlayerId, nonStriker: PlayerId): void {
  const inn = currentInnings(state);
  if (inn.battingOrder.length > 0) {
    throw new ScoringError('openers_already_set', 'Openers have already been chosen.');
  }
  if (striker === nonStriker) {
    throw new ScoringError('player_unavailable', 'Striker and non-striker must be different.');
  }
  assertInSquad(state, inn.battingTeam, striker);
  assertInSquad(state, inn.battingTeam, nonStriker);

  addBatter(inn, striker);
  addBatter(inn, nonStriker);
  inn.striker = striker;
  inn.nonStriker = nonStriker;
  inn.partnerships.push({ batters: [striker, nonStriker], runs: 0, legalBalls: 0 });
}

function setBowler(state: MatchState, bowler: PlayerId): void {
  const inn = currentInnings(state);
  assertInSquad(state, inn.bowlingTeam, bowler);
  if (bowler === inn.bowler) return;
  if (bowler === inn.previousOverBowler) {
    throw new ScoringError('consecutive_overs', 'A bowler cannot bowl two overs in a row.');
  }
  if (inn.currentOver.deliveries > 0) inn.currentOver.bowlerChanged = true;
  inn.bowler = bowler;
  inn.currentOver.bowler = bowler;
}

function recordDelivery(state: MatchState, event: DeliveryEvent): void {
  const inn = currentInnings(state);
  const { runs, extra, wicket } = event;

  // --- validate everything before mutating ---
  if (inn.striker === null || inn.nonStriker === null) {
    throw new ScoringError(
      inn.awaitingBatter ? 'batter_required' : 'openers_required',
      inn.awaitingBatter ? 'Choose the next batter first.' : 'Choose the opening batters first.',
    );
  }
  if (inn.bowler === null) {
    throw new ScoringError('bowler_required', 'Choose a bowler first.');
  }
  if (!Number.isInteger(runs) || runs < 0 || runs > MAX_RUNS_PER_DELIVERY) {
    throw new ScoringError(
      'invalid_runs',
      `Runs must be a whole number from 0 to ${MAX_RUNS_PER_DELIVERY}.`,
    );
  }
  if ((extra === 'bye' || extra === 'leg_bye') && runs === 0) {
    throw new ScoringError('invalid_runs', 'Byes and leg-byes need at least one run.');
  }
  if (wicket) {
    if (!isDismissalAllowed(wicket.kind, extra)) {
      throw new ScoringError(
        'invalid_dismissal',
        `A batter can't be ${wicket.kind} on this delivery.`,
      );
    }
    if (strikerOnly(wicket.kind) && wicket.playerOut !== inn.striker) {
      throw new ScoringError('invalid_dismissal', `Only the striker can be ${wicket.kind}.`);
    }
    if (wicket.playerOut !== inn.striker && wicket.playerOut !== inn.nonStriker) {
      throw new ScoringError(
        'invalid_dismissal',
        'The dismissed player must be one of the batters.',
      );
    }
    if (forbidsRuns(wicket.kind) && runs > 0) {
      throw new ScoringError('invalid_dismissal', `No runs can be scored when ${wicket.kind}.`);
    }
    if (wicket.fielder !== undefined) assertInSquad(state, inn.bowlingTeam, wicket.fielder);
  }

  // --- apply ---
  const striker = inn.striker;
  const nonStriker = inn.nonStriker;
  const bowler = inn.bowler;
  const legal = isLegalDelivery(extra);
  const totalRuns = runs + penaltyRuns(extra);
  const charged = runsChargedToBowler(extra, runs);

  inn.runs += totalRuns;
  if (legal) inn.legalBalls += 1;

  switch (extra) {
    case 'wide':
      inn.extras.wides += totalRuns;
      break;
    case 'no_ball':
      inn.extras.noBalls += 1;
      break;
    case 'bye':
      inn.extras.byes += runs;
      break;
    case 'leg_bye':
      inn.extras.legByes += runs;
      break;
    case undefined:
      break;
  }

  const batterLine = requireBatter(inn, striker);
  if (countsAsBallFaced(extra)) batterLine.balls += 1;
  if (runsCreditedToBatter(extra)) {
    batterLine.runs += runs;
    if (runs === 4) batterLine.fours += 1;
    if (runs === 6) batterLine.sixes += 1;
  }

  const bowlerLine = ensureBowler(inn, bowler);
  if (legal) bowlerLine.legalBalls += 1;
  bowlerLine.runsConceded += charged;
  if (extra === 'wide') bowlerLine.wides += 1;
  if (extra === 'no_ball') bowlerLine.noBalls += 1;
  inn.currentOver.runsConceded += charged;
  inn.currentOver.deliveries += 1;

  const partnership = inn.partnerships[inn.partnerships.length - 1];
  if (partnership) {
    partnership.runs += totalRuns;
    if (legal) partnership.legalBalls += 1;
  }

  // Batters cross on an odd number of completed runs.
  if (runs % 2 === 1) swapEnds(inn);

  if (wicket) {
    const slot = slotOf(inn, wicket.playerOut);
    requireBatter(inn, wicket.playerOut).dismissal = {
      kind: wicket.kind,
      ...(isBowlerWicket(wicket.kind) ? { bowler } : {}),
      ...(wicket.fielder !== undefined ? { fielder: wicket.fielder } : {}),
    };
    if (isBowlerWicket(wicket.kind)) bowlerLine.wickets += 1;
    recordWicket(inn, wicket.playerOut, slot);
  }

  const legalBefore = legal ? inn.legalBalls - 1 : inn.legalBalls;
  inn.deliveries.push({
    over: Math.floor(legalBefore / BALLS_PER_OVER),
    ballInOver: (legalBefore % BALLS_PER_OVER) + (legal ? 1 : 0),
    legal,
    striker,
    nonStriker,
    bowler,
    runs,
    extra: extra ?? null,
    wicket: wicket ?? null,
    totalRuns,
    scoreAfter: { runs: inn.runs, wickets: inn.wickets },
  });

  if (legal && inn.legalBalls % BALLS_PER_OVER === 0) completeOver(inn, bowlerLine);
  checkInningsEnd(state);
}

function newBatter(state: MatchState, batter: PlayerId): void {
  const inn = currentInnings(state);
  if (inn.awaitingBatter === null) {
    throw new ScoringError('no_batter_required', 'Both batters are already at the crease.');
  }
  assertInSquad(state, inn.battingTeam, batter);
  if (batter === inn.striker || batter === inn.nonStriker) {
    throw new ScoringError('player_unavailable', 'That player is already batting.');
  }
  const existing = inn.batters[batter];
  if (existing?.dismissal) {
    throw new ScoringError('player_unavailable', 'That player is already out.');
  }

  if (existing) existing.retiredHurt = false;
  else addBatter(inn, batter);

  if (inn.awaitingBatter === 'striker') inn.striker = batter;
  else inn.nonStriker = batter;
  inn.awaitingBatter = null;

  // Both slots are filled at this point.
  inn.partnerships.push({
    batters: [inn.striker as PlayerId, inn.nonStriker as PlayerId],
    runs: 0,
    legalBalls: 0,
  });
}

function swapStrike(state: MatchState): void {
  const inn = currentInnings(state);
  if (inn.striker === null || inn.nonStriker === null) {
    throw new ScoringError('batter_required', 'Both batters must be at the crease to swap strike.');
  }
  swapEnds(inn);
}

function retire(state: MatchState, batter: PlayerId, kind: 'retired_hurt' | 'retired_out'): void {
  const inn = currentInnings(state);
  if (inn.awaitingBatter !== null) {
    throw new ScoringError('batter_required', 'Choose the next batter first.');
  }
  if (batter !== inn.striker && batter !== inn.nonStriker) {
    throw new ScoringError('player_unavailable', 'Only a batter at the crease can retire.');
  }
  const slot = slotOf(inn, batter);
  const line = requireBatter(inn, batter);

  if (kind === 'retired_hurt') {
    line.retiredHurt = true;
    vacate(inn, slot);
    return;
  }

  line.dismissal = { kind: 'retired_out' };
  recordWicket(inn, batter, slot);
  checkInningsEnd(state);
}

function setOvers(state: MatchState, overs: number): void {
  if (!Number.isInteger(overs) || overs < 1 || overs > MAX_OVERS_PER_INNINGS) {
    throw new ScoringError(
      'invalid_overs',
      `Overs must be a whole number from 1 to ${MAX_OVERS_PER_INNINGS}.`,
    );
  }
  const inn = currentInnings(state);
  const oversStarted = Math.ceil(inn.legalBalls / BALLS_PER_OVER);
  if (overs < oversStarted) {
    throw new ScoringError(
      'invalid_overs',
      `This innings is already in over ${oversStarted}; overs can't go below that.`,
    );
  }
  state.oversPerInnings = overs;
  checkInningsEnd(state);
}

function addPlayer(state: MatchState, team: TeamId, player: PlayerId): void {
  const squad = state.squads[team];
  if (!squad) throw new ScoringError('unknown_player', `Team ${team} is not in this match.`);
  if (Object.values(state.squads).some((s) => s.includes(player))) {
    throw new ScoringError('duplicate_player', 'That player is already in a squad.');
  }
  squad.push(player);
}

function setPlayerOfMatch(state: MatchState, player: PlayerId | null): void {
  if (state.status !== 'complete') {
    throw new ScoringError('match_not_complete', 'Player of the Match is chosen after the match.');
  }
  if (player !== null && !Object.values(state.squads).some((s) => s.includes(player))) {
    throw new ScoringError('unknown_player', 'That player is not in either squad.');
  }
  state.playerOfMatch = player;
}

// ---------------------------------------------------------------------------
// Innings lifecycle
// ---------------------------------------------------------------------------

function checkInningsEnd(state: MatchState): void {
  const inn = currentInnings(state);
  const first = state.innings[0];
  if (inn.number === 2 && first && inn.runs > first.runs) return finishInnings(state, 'target');
  if (inn.wickets >= wicketLimit(state.squads[inn.battingTeam]?.length ?? 0)) {
    return finishInnings(state, 'all_out');
  }
  if (inn.legalBalls >= state.oversPerInnings * BALLS_PER_OVER) {
    return finishInnings(state, 'overs');
  }
}

function finishInnings(state: MatchState, reason: InningsEndReason): void {
  const inn = currentInnings(state);
  inn.endReason = reason;
  inn.awaitingBatter = null;

  if (inn.number === 1) {
    state.innings.push(newInnings(2, inn.bowlingTeam, inn.battingTeam));
    return;
  }
  state.status = 'complete';
  state.result = computeResult(state);
}

function completeOver(inn: InningsState, bowlerLine: BowlerLine): void {
  if (!inn.currentOver.bowlerChanged && inn.currentOver.runsConceded === 0) {
    bowlerLine.maidens += 1;
  }
  inn.previousOverBowler = inn.bowler;
  inn.bowler = null;
  inn.currentOver = emptyOver();
  swapEnds(inn);
}

function recordWicket(inn: InningsState, player: PlayerId, slot: BatterSlot): void {
  inn.wickets += 1;
  inn.fallOfWickets.push({
    wicket: inn.wickets,
    player,
    runs: inn.runs,
    legalBalls: inn.legalBalls,
  });
  vacate(inn, slot);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newInnings(number: 1 | 2, battingTeam: TeamId, bowlingTeam: TeamId): InningsState {
  return {
    number,
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    striker: null,
    nonStriker: null,
    bowler: null,
    previousOverBowler: null,
    awaitingBatter: null,
    batters: {},
    battingOrder: [],
    bowlers: {},
    bowlingOrder: [],
    fallOfWickets: [],
    partnerships: [],
    deliveries: [],
    currentOver: emptyOver(),
    endReason: null,
  };
}

function emptyOver(): InningsState['currentOver'] {
  return { bowler: null, runsConceded: 0, deliveries: 0, bowlerChanged: false };
}

function addBatter(inn: InningsState, player: PlayerId): void {
  inn.batters[player] = {
    player,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissal: null,
    retiredHurt: false,
  };
  inn.battingOrder.push(player);
}

function requireBatter(inn: InningsState, player: PlayerId): BatterLine {
  const line = inn.batters[player];
  if (!line) throw new Error(`Invariant: batter ${player} has no scorecard line`);
  return line;
}

function ensureBowler(inn: InningsState, player: PlayerId): BowlerLine {
  const existing = inn.bowlers[player];
  if (existing) return existing;
  const line: BowlerLine = {
    player,
    legalBalls: 0,
    runsConceded: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
    maidens: 0,
  };
  inn.bowlers[player] = line;
  inn.bowlingOrder.push(player);
  return line;
}

function slotOf(inn: InningsState, player: PlayerId): BatterSlot {
  return inn.striker === player ? 'striker' : 'non_striker';
}

function vacate(inn: InningsState, slot: BatterSlot): void {
  if (slot === 'striker') inn.striker = null;
  else inn.nonStriker = null;
  inn.awaitingBatter = slot;
}

/** Batters change ends. An empty slot (waiting for the next batter) moves with them. */
function swapEnds(inn: InningsState): void {
  [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
  if (inn.awaitingBatter === 'striker') inn.awaitingBatter = 'non_striker';
  else if (inn.awaitingBatter === 'non_striker') inn.awaitingBatter = 'striker';
}

function assertInSquad(state: MatchState, team: TeamId, player: PlayerId): void {
  if (!state.squads[team]?.includes(player)) {
    throw new ScoringError('unknown_player', `Player ${player} is not in the squad for ${team}.`);
  }
}

function validateSetup(setup: MatchSetup): void {
  const { teamA, teamB, squads, oversPerInnings, toss } = setup;
  const fail = (message: string): never => {
    throw new ScoringError('invalid_setup', message);
  };

  if (!teamA || !teamB || teamA === teamB) fail('A match needs two different teams.');
  if (toss.winner !== teamA && toss.winner !== teamB)
    fail('The toss winner must be one of the teams.');
  if (toss.decision !== 'bat' && toss.decision !== 'bowl')
    fail('Toss decision must be bat or bowl.');
  if (
    !Number.isInteger(oversPerInnings) ||
    oversPerInnings < 1 ||
    oversPerInnings > MAX_OVERS_PER_INNINGS
  ) {
    fail(`Overs must be a whole number from 1 to ${MAX_OVERS_PER_INNINGS}.`);
  }

  const seen = new Set<PlayerId>();
  for (const team of [teamA, teamB]) {
    const squad = squads[team];
    if (!squad || squad.length < 2) fail('Each team needs at least 2 players.');
    for (const player of squad ?? []) {
      if (seen.has(player)) fail(`Player ${player} appears more than once.`);
      seen.add(player);
    }
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
