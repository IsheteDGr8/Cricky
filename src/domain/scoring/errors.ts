export type ScoringErrorCode =
  | 'invalid_setup'
  | 'match_complete'
  | 'match_not_complete'
  | 'openers_already_set'
  | 'openers_required'
  | 'bowler_required'
  | 'batter_required'
  | 'no_batter_required'
  | 'consecutive_overs'
  | 'unknown_player'
  | 'player_unavailable'
  | 'invalid_runs'
  | 'invalid_dismissal'
  | 'invalid_overs'
  | 'duplicate_player';

/** Thrown when an event can't be applied to the current match state. The state is left unchanged. */
export class ScoringError extends Error {
  readonly code: ScoringErrorCode;
  /** Position of the offending event when replaying an event list. */
  readonly eventIndex: number | undefined;

  constructor(code: ScoringErrorCode, message: string, eventIndex?: number) {
    super(eventIndex === undefined ? message : `Event ${eventIndex}: ${message}`);
    this.name = 'ScoringError';
    this.code = code;
    this.eventIndex = eventIndex;
  }
}
