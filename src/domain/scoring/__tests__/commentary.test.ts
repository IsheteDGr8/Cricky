import { dots, ev, play } from '../../__fixtures__/scoring';
import {
  ballBadge,
  describeBall,
  describeDismissal,
  overLabel,
  overSummaries,
} from '../commentary';
import { currentInnings } from '../engine';
import type { BallRecord, MatchEvent } from '../types';

const start = [ev.openers('a1', 'a2'), ev.bowler('b1')];
const name = (p: string) => p.toUpperCase();

/** The record produced by bowling `event` as the first ball of the match. */
function ball(event: MatchEvent): BallRecord {
  const record = currentInnings(play([...start, event])).deliveries[0];
  if (!record) throw new Error('no delivery recorded');
  return record;
}

describe('overLabel', () => {
  it('uses over.ball notation', () => {
    const inn = currentInnings(play([...start, ...dots(6), ev.bowler('b2'), ev.dot()]));
    expect(inn.deliveries.map(overLabel)).toEqual([
      '0.1',
      '0.2',
      '0.3',
      '0.4',
      '0.5',
      '0.6',
      '1.1',
    ]);
  });
});

describe('ballBadge', () => {
  it.each<[MatchEvent, string]>([
    [ev.dot(), '0'],
    [ev.runs(4), '4'],
    [ev.extra('wide'), 'wd'],
    [ev.extra('wide', 2), '3wd'],
    [ev.extra('no_ball'), 'nb'],
    [ev.extra('no_ball', 4), 'nb+4'],
    [ev.extra('bye', 2), '2b'],
    [ev.extra('leg_bye', 1), '1lb'],
    [ev.out('bowled', 'a1'), 'W'],
    [ev.out('run_out', 'a1', { runs: 1 }), 'W+1'],
  ])('%j -> %s', (event, badge) => {
    expect(ballBadge(ball(event))).toBe(badge);
  });
});

describe('describeDismissal', () => {
  it.each<[Parameters<typeof describeDismissal>[0], string]>([
    [{ kind: 'bowled', bowler: 'b1' }, 'b B1'],
    [{ kind: 'lbw', bowler: 'b1' }, 'lbw b B1'],
    [{ kind: 'caught', bowler: 'b1', fielder: 'b2' }, 'c B2 b B1'],
    [{ kind: 'caught', bowler: 'b1', fielder: 'b1' }, 'c & b B1'],
    [{ kind: 'caught', bowler: 'b1' }, 'c ? b B1'],
    [{ kind: 'stumped', bowler: 'b1', fielder: 'b5' }, 'st B5 b B1'],
    [{ kind: 'stumped', bowler: 'b1' }, 'st b B1'],
    [{ kind: 'hit_wicket', bowler: 'b1' }, 'hit wicket b B1'],
    [{ kind: 'run_out', fielder: 'b3' }, 'run out (B3)'],
    [{ kind: 'run_out' }, 'run out'],
    [{ kind: 'retired_out' }, 'retired out'],
  ])('%j -> %s', (dismissal, text) => {
    expect(describeDismissal(dismissal, name)).toBe(text);
  });
});

describe('describeBall', () => {
  it.each<[MatchEvent, string]>([
    [ev.dot(), 'B1 to A1, no run'],
    [ev.runs(1), 'B1 to A1, 1 run'],
    [ev.runs(2), 'B1 to A1, 2 runs'],
    [ev.runs(4), 'B1 to A1, FOUR'],
    [ev.runs(6), 'B1 to A1, SIX'],
    [ev.extra('wide'), 'B1 to A1, wide'],
    [ev.extra('wide', 1), 'B1 to A1, wide, 1 extra run'],
    [ev.extra('no_ball'), 'B1 to A1, no ball'],
    [ev.extra('no_ball', 6), 'B1 to A1, no ball, SIX off the bat'],
    [ev.extra('bye', 1), 'B1 to A1, 1 bye'],
    [ev.extra('leg_bye', 2), 'B1 to A1, 2 leg byes'],
    [ev.out('caught', 'a1', { fielder: 'b2' }), 'B1 to A1, OUT! A1 c B2 b B1'],
    [
      ev.out('run_out', 'a2', { runs: 1, fielder: 'b4' }),
      'B1 to A1, OUT! A2 run out (B4) after 1 run',
    ],
    [
      ev.out('stumped', 'a1', { extra: 'wide', fielder: 'b5' }),
      'B1 to A1, OUT! A1 st B5 b B1 (wide)',
    ],
  ])('%j', (event, text) => {
    expect(describeBall(ball(event), name)).toBe(text);
  });
});

describe('overSummaries', () => {
  it('groups deliveries by over with running score', () => {
    const inn = currentInnings(
      play([
        ...start,
        ev.runs(4),
        ev.extra('wide'),
        ev.out('bowled', 'a1'),
        ev.batter('a3'),
        ...dots(4),
        ev.bowler('b2'),
        ev.runs(1),
      ]),
    );
    const summaries = overSummaries(inn);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      number: 1,
      bowler: 'b1',
      runs: 5,
      wickets: 1,
      complete: true,
      scoreAfter: { runs: 5, wickets: 1 },
    });
    expect(summaries[0]?.balls).toHaveLength(7);
    expect(summaries[1]).toMatchObject({ number: 2, bowler: 'b2', runs: 1, complete: false });
  });

  it('is empty before the first ball', () => {
    expect(overSummaries(currentInnings(play(start)))).toEqual([]);
  });
});
