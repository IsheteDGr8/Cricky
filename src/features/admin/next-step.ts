import type { MatchSummary, WithId } from '@/data';
import type { ResolvedFixture } from '@/domain';
import type { TournamentView } from '../tournaments/tournament-view';

export type ControlSection = 'teams' | 'matches' | 'playoffs' | 'settings';

export interface NextStep {
  key: 'teams' | 'live' | 'first_match' | 'playoff' | 'record' | 'finish' | 'more' | 'done';
  title: string;
  detail: string;
  section: ControlSection;
  /** Set when the step is about one match or fixture. */
  matchId?: string;
  fixtureId?: string;
}

export function samePair(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

/** The playoff match already started for a fixture, if any. */
export function fixtureMatch(
  view: Pick<TournamentView, 'matches'>,
  fixture: ResolvedFixture,
): WithId<MatchSummary> | undefined {
  if (!fixture.home || !fixture.away) return undefined;
  return view.matches.find(
    (m) => m.stage === 'playoff' && samePair([m.teamA, m.teamB], [fixture.home, fixture.away]),
  );
}

/** Playoff winners that finished matches show but the bracket has not recorded yet. */
export function unrecordedWinners(view: Pick<TournamentView, 'matches' | 'bracket'>) {
  const found: { fixtureId: string; winner: string }[] = [];
  for (const fixture of view.bracket?.fixtures ?? []) {
    if (fixture.winner) continue;
    const match = fixtureMatch(view, fixture);
    if (match?.status === 'complete' && match.result?.kind === 'win') {
      found.push({ fixtureId: fixture.id, winner: match.result.winner });
    }
  }
  return found;
}

/** The one thing an admin should do next to move the tournament along. */
export function nextStep(view: TournamentView): NextStep {
  const t = view.tournament;
  if (t.status === 'complete' || t.status === 'archived') {
    const champion = view.bracket?.champion;
    return {
      key: 'done',
      title: 'Tournament complete',
      detail: champion
        ? `${view.teamName(champion)} are champions. Stats and results stay public.`
        : 'Stats and results stay public. Reopen it in Settings if you need to.',
      section: 'settings',
    };
  }

  if (view.teams.length < 2) {
    const missing = 2 - view.teams.length;
    return {
      key: 'teams',
      title: 'Add your teams',
      detail: `Add ${missing === 2 ? 'at least two teams' : 'one more team'}. Paste each squad, one player per line.`,
      section: 'teams',
    };
  }

  const live = view.matches.find((m) => m.status === 'live');
  if (live) {
    return {
      key: 'live',
      title: `${live.teamAName} v ${live.teamBName} is live`,
      detail: 'Keep scoring, or share the scorer code with whoever is on the clipboard.',
      section: 'matches',
      matchId: live.id,
    };
  }

  if (view.matches.length === 0) {
    return {
      key: 'first_match',
      title: 'Start the first match',
      detail: 'Pick two teams, record the toss, and you get a scorer code to hand out.',
      section: 'matches',
    };
  }

  if (unrecordedWinners(view).length > 0) {
    return {
      key: 'record',
      title: 'Move winners through the bracket',
      detail: 'A playoff match has finished. Record the winner so the next round fills in.',
      section: 'playoffs',
    };
  }

  const ready = view.bracket?.fixtures.find(
    (f) => f.home && f.away && !f.winner && !fixtureMatch(view, f),
  );
  if (ready && view.groups.every((g) => g.rows.every((r) => r.played > 0))) {
    return {
      key: 'playoff',
      title: `Start the ${ready.name}`,
      detail: `${view.teamName(ready.home as string)} v ${view.teamName(ready.away as string)}`,
      section: 'playoffs',
      fixtureId: ready.id,
    };
  }

  if (view.bracket?.champion) {
    return {
      key: 'finish',
      title: `Crown ${view.teamName(view.bracket.champion)}`,
      detail: 'The final is done. Mark the tournament complete to wrap it up.',
      section: 'settings',
    };
  }

  return {
    key: 'more',
    title: 'Start the next match',
    detail: `${view.matches.filter((m) => m.status === 'complete').length} played so far.`,
    section: 'matches',
  };
}
