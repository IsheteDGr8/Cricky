import { listed, result, summary, teams, tournament } from '../../__fixtures__/data';
import { buildTournamentView } from '../tournament-view';
import type { MatchResultRecord, MatchSummary } from '@/data';

describe('buildTournamentView', () => {
  const view = (overrides: Partial<typeof tournament> = {}, results = [result]) =>
    buildTournamentView(
      { ...tournament, ...overrides },
      teams,
      listed<MatchResultRecord>(results),
      listed<MatchSummary>([summary()]),
    );

  it('builds standings per group from group-stage results', () => {
    const [group] = view().groups;
    expect(group?.group).toBe('A');
    expect(group?.rows.map((r) => [r.team, r.played, r.points])).toEqual([
      ['A', 1, 2],
      ['B', 1, 0],
    ]);
  });

  it('leaves playoff results out of the standings but counts them for leaders', () => {
    const v = view({}, [{ ...result, stage: 'playoff' }]);
    expect(v.groups[0]?.rows.every((r) => r.played === 0)).toBe(true);
    expect(v.batting[0]).toMatchObject({ player: 'a1', runs: 6 });
  });

  it('fills the bracket from the standings and recorded winners', () => {
    expect(view().bracket?.fixtures[0]).toMatchObject({ home: 'A', away: 'B', winner: null });
    expect(view({ playoffWinners: { final: 'A' } }).bracket?.champion).toBe('A');
    expect(view({ playoffFormat: 'none' }).bracket).toBeNull();
  });

  it('reports data it could not show instead of failing', () => {
    const v = buildTournamentView(
      { ...tournament, playoffWinners: { final: 'Z' } },
      teams,
      listed<MatchResultRecord>([], ['bad1']),
      listed<MatchSummary>([]),
    );
    expect(v.bracket).toBeNull();
    expect(v.problems).toEqual([
      '1 unreadable match results',
      expect.stringContaining('Playoffs: Winner of final'),
    ]);
  });

  it('looks up team and player names', () => {
    const v = view();
    expect(v.teamName('A')).toBe('Huskies');
    expect(v.playerName('b3')).toBe('Cal');
    expect(v.playerName('zz')).toBe('Unknown player');
  });
});
