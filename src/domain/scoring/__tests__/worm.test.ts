import { dots, ev, firstInningsOf, play } from '../../__fixtures__/scoring';
import { currentInnings } from '../engine';
import { wormExtent, wormSeries } from '../worm';

describe('wormSeries', () => {
  it('starts at the origin before any ball', () => {
    expect(wormSeries([])).toEqual([{ legalBalls: 0, runs: 0 }]);
  });

  it('tracks legal balls and extras that add runs at the same x', () => {
    const inn = currentInnings(
      play([ev.openers('a1', 'a2'), ev.bowler('b1'), ev.extra('wide'), ev.runs(4)]),
    );
    expect(wormSeries(inn.deliveries)).toEqual([
      { legalBalls: 0, runs: 0 },
      { legalBalls: 0, runs: 1 },
      { legalBalls: 1, runs: 5 },
    ]);
  });

  it('ends a 12-run two-over innings at 12 from 12 balls', () => {
    const inn = play(firstInningsOf(Array.from({ length: 12 }, () => 1))).innings[0];
    expect(inn).toBeDefined();
    const last = wormSeries(inn?.deliveries ?? []).at(-1);
    expect(last).toEqual({ legalBalls: 12, runs: 12 });
  });
});

describe('wormExtent', () => {
  it('uses the taller, longer innings for shared axes', () => {
    expect(
      wormExtent([
        [
          { legalBalls: 0, runs: 0 },
          { legalBalls: 6, runs: 20 },
        ],
        [
          { legalBalls: 0, runs: 0 },
          { legalBalls: 12, runs: 8 },
        ],
      ]),
    ).toEqual({ maxBalls: 12, maxRuns: 20 });
  });

  it('never returns a zero axis', () => {
    expect(wormExtent([[{ legalBalls: 0, runs: 0 }]])).toEqual({ maxBalls: 1, maxRuns: 1 });
  });
});

describe('wormSeries on dots', () => {
  it('still advances x when the score does not move', () => {
    const inn = currentInnings(play([ev.openers('a1', 'a2'), ev.bowler('b1'), ...dots(3)]));
    expect(wormSeries(inn.deliveries)).toEqual([
      { legalBalls: 0, runs: 0 },
      { legalBalls: 1, runs: 0 },
      { legalBalls: 2, runs: 0 },
      { legalBalls: 3, runs: 0 },
    ]);
  });
});
