import { applyEvent, replay, type MatchEvent, type MatchState } from '@/domain';
import { toMatchSetup, type MatchRepository } from '@/data';
import type { MatchView } from '../matches/match-view';

export interface Publishable {
  append: MatchRepository['append'];
  undo: MatchRepository['undo'];
  publishSummary: MatchRepository['publishSummary'];
  publishResult: MatchRepository['publishResult'];
  clearResult: MatchRepository['clearResult'];
  setLocked: MatchRepository['setLocked'];
}

/** What lists and standings need after an event (or an undo) has been applied. */
export async function publishDerived(
  matches: Publishable,
  view: Pick<MatchView, 'id' | 'meta'>,
  state: MatchState,
  previous?: MatchState,
): Promise<void> {
  await matches.publishSummary(view.id, view.meta, state);
  if (state.status === 'complete') {
    await matches.publishResult(view.id, view.meta, state);
    if (state.playerOfMatch) await matches.setLocked(view.id, true);
  } else if (previous?.status === 'complete') {
    await matches.clearResult(view.id);
  }
}

/**
 * Validates `event` against the current state, writes it, then updates the summary
 * (and the result / lock if the match just finished).
 */
export async function commitEvent(
  matches: Publishable,
  view: MatchView,
  event: MatchEvent,
  playerName?: string,
): Promise<MatchState> {
  const next = applyEvent(view.state, event);
  await matches.append(view.id, view.head, event, playerName);
  await publishDerived(matches, view, next, view.state);
  return next;
}

/** Removes the last event and republishes the derived records. */
export async function commitUndo(matches: Publishable, view: MatchView): Promise<MatchState> {
  const next = replay(toMatchSetup(view.meta), view.events.slice(0, -1));
  await matches.undo(view.id, view.head);
  await publishDerived(matches, view, next, view.state);
  return next;
}

/** Pulls a match id out of a pasted link (`/match/…`, `/score/…`) or a bare id. */
export function parseMatchRef(input: string): string | null {
  const trimmed = input.trim();
  const fromPath = /(?:match|score)\/([^/?#]+)/i.exec(trimmed);
  if (fromPath?.[1]) return decodeURIComponent(fromPath[1]);
  if (/^[A-Za-z0-9_-]{6,40}$/.test(trimmed)) return trimmed;
  return null;
}

/** The `code` in a scorer link (`/score/{id}?code=…`), or null if there is none. */
export function codeFromLink(input: string): string | null {
  const found = /[?&]code=([^&#\s]+)/.exec(input);
  return found?.[1] ? decodeURIComponent(found[1]) : null;
}

/** What the scorer typed into the code box: a bare code, or a scorer link for this match. */
export function parseCodeInput(
  input: string,
  matchId: string,
): { code: string } | { error: string } {
  const trimmed = input.trim();
  if (!/[/?=]/.test(trimmed)) return { code: trimmed };
  const linked = parseMatchRef(trimmed);
  if (linked && linked !== matchId) return { error: 'That link is for a different match.' };
  const code = codeFromLink(trimmed);
  if (!code) {
    return { error: 'That link has no code in it. Ask the admin for the scorer link or code.' };
  }
  return { code };
}
