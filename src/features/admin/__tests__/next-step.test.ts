import type { MatchSummary, Team, Tournament, WithId } from '@/data';
import type { ResolvedBracket } from '@/domain';
import type { TournamentView } from '../../tournaments/tournament-view';
import { nextStep, unrecordedWinners } from '../next-step';

const tournament: WithId<Tournament> = {
  id: 't1',
  name: 'Fall Cup',
  status: 'active',
  oversDefault: 10,
  playoffFormat: 'final_only',
  thirdPlace: false,
  createdAt: 0,
  createdBy: 'me',
};

const team = (id: string): WithId<Team> => ({
  id,
  name: id.toUpperCase(),
  tournamentId: 't1',
  group: 'A',
  players: {},
});

const match = (
  id: string,
  status: MatchSummary['status'],
  extra: Partial<MatchSummary> = {},
): WithId<MatchSummary> => ({
  id,
  stage: 'group',
  tournamentId: 't1',
  teamA: 'a',
  teamB: 'b',
  teamAName: 'A',
  teamBName: 'B',
  status,
  updatedAt: 0,
  ...extra,
});

function view(partial: Partial<TournamentView>): TournamentView {
  return {
    tournament,
    teams: [team('a'), team('b')],
    groups: [{ group: 'A', rows: [] }],
    bracket: null,
    matches: [],
    batting: [],
    bowling: [],
    teamName: (id) => id.toUpperCase(),
    playerName: (id) => id,
    problems: [],
    ...partial,
  };
}

const final = (winner: string | null): ResolvedBracket => ({
  fixtures: [{ id: 'final', name: 'Final', home: 'a', away: 'b', winner }],
  champion: winner,
});

describe('nextStep', () => {
  it('asks for teams first', () => {
    expect(nextStep(view({ teams: [] }))).toMatchObject({ key: 'teams', section: 'teams' });
    expect(nextStep(view({ teams: [team('a')] })).detail).toContain('one more team');
  });

  it('points at the first match once there are two teams', () => {
    expect(nextStep(view({}))).toMatchObject({ key: 'first_match', section: 'matches' });
  });

  it('puts a live match ahead of everything else', () => {
    const step = nextStep(view({ matches: [match('m1', 'complete'), match('m2', 'live')] }));
    expect(step).toMatchObject({ key: 'live', matchId: 'm2' });
  });

  it('offers the next playoff fixture once every team has played', () => {
    const step = nextStep(
      view({
        matches: [match('m1', 'complete')],
        bracket: final(null),
        groups: [
          {
            group: 'A',
            rows: ['a', 'b'].map((t) => ({
              team: t,
              played: 1,
              won: 0,
              lost: 0,
              tied: 0,
              points: 0,
              runsFor: 0,
              ballsFaced: 0,
              runsAgainst: 0,
              ballsBowled: 0,
              netRunRate: 0,
            })),
          },
        ],
      }),
    );
    expect(step).toMatchObject({ key: 'playoff', fixtureId: 'final', title: 'Start the Final' });
  });

  it('asks to record a finished playoff before anything new', () => {
    const v = view({
      matches: [
        match('p1', 'complete', {
          stage: 'playoff',
          result: { kind: 'win', winner: 'b', by: 'runs', margin: 4 },
        }),
      ],
      bracket: final(null),
    });
    expect(unrecordedWinners(v)).toEqual([{ fixtureId: 'final', winner: 'b' }]);
    expect(nextStep(v).key).toBe('record');
  });

  it('suggests crowning the champion, then reports done', () => {
    const played = [match('p1', 'complete', { stage: 'playoff' })];
    expect(nextStep(view({ matches: played, bracket: final('a') }))).toMatchObject({
      key: 'finish',
      title: 'Crown A',
    });
    const done = nextStep(
      view({
        matches: played,
        bracket: final('a'),
        tournament: { ...tournament, status: 'complete' },
      }),
    );
    expect(done).toMatchObject({ key: 'done' });
    expect(done.detail).toContain('A are champions');
  });
});
