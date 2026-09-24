import { dots, ev, firstInningsOf, over } from '@/domain/__fixtures__/scoring';
import { snapshot } from '../../__fixtures__/data';
import { buildMatchView } from '../match-view';

describe('buildMatchView', () => {
  it('replays a finished match with no live figures', () => {
    const view = buildMatchView(snapshot());
    expect(view.state.status).toBe('complete');
    expect(view.innings).toHaveLength(2);
    expect(view.live).toBeNull();
    expect(view.playerName('a1')).toBe('Asha');
    expect(view.teamName('B')).toBe('Eagles');
  });

  it('gives the run rate during the first innings', () => {
    const view = buildMatchView(snapshot([ev.openers('a1', 'a2'), ev.bowler('b1'), ev.runs(4)]));
    expect(view.innings).toHaveLength(1);
    expect(view.live).toMatchObject({ runRate: 24, chase: null });
  });

  it('gives the chase equation during the second innings', () => {
    const events = [
      ...firstInningsOf(Array.from({ length: 12 }, () => 1)),
      ev.openers('b1', 'b2'),
      ...over('a1', [ev.runs(6), ...dots(2)]),
    ];
    const chase = buildMatchView(snapshot(events)).live?.chase;
    expect(chase).toMatchObject({ target: 13, runsNeeded: 7, ballsLeft: 9 });
    expect(chase?.requiredRate).toBeCloseTo(4.667, 3);
  });

  it('hides innings nobody has batted in yet', () => {
    expect(buildMatchView(snapshot([])).innings).toEqual([]);
    expect(buildMatchView(snapshot([])).live).toBeNull();
  });
});
