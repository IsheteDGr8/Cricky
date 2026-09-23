import { dots, ev, firstInningsOf, makeSetup, over, play } from '../../__fixtures__/scoring';
import { createMatch } from '../engine';
import { ballsRemaining, computeResult, target } from '../result';
import {
  availableBatters,
  availableBowlers,
  currentWicketLimit,
  economy,
  nextAction,
  requiredRunRate,
  strikeRate,
} from '../selectors';

const start = [ev.openers('a1', 'a2'), ev.bowler('b1')];

describe('availableBatters', () => {
  it('excludes batters at the crease and batters who are out, but not retired hurt', () => {
    const state = play([
      ...start,
      ev.out('bowled', 'a1'),
      ev.batter('a3'),
      ev.retire('a3', 'retired_hurt'),
    ]);
    expect(availableBatters(state)).toEqual(['a3', 'a4', 'a5']);
  });
});

describe('availableBowlers', () => {
  it('excludes whoever bowled the previous over', () => {
    expect(availableBowlers(play([...start, ...dots(6)]))).toEqual(['b2', 'b3', 'b4', 'b5']);
    expect(availableBowlers(play(start))).toHaveLength(5);
  });
});

describe('currentWicketLimit', () => {
  it('is the batting squad size minus one', () => {
    expect(currentWicketLimit(play([]))).toBe(4);
    expect(currentWicketLimit(play([ev.addPlayer('A', 'a6')]))).toBe(5);
  });
});

describe('requiredRunRate', () => {
  it('is null in the first innings', () => {
    expect(requiredRunRate(play(start))).toBeNull();
  });

  it('is runs needed per over for the chase', () => {
    const first = firstInningsOf([2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0]); // 12, target 13
    const state = play([...first, ev.openers('b1', 'b2'), ...over('a1', [ev.runs(1), ...dots(5)])]);
    expect(target(state)).toBe(13);
    expect(ballsRemaining(state)).toBe(6);
    expect(requiredRunRate(state)).toBe(12);
  });
});

describe('strikeRate and economy', () => {
  it('handle zero balls', () => {
    expect(strikeRate({ runs: 0, balls: 0 })).toBe(0);
    expect(economy({ runsConceded: 5, legalBalls: 0 })).toBe(0);
  });

  it('compute per 100 balls and per over', () => {
    expect(strikeRate({ runs: 30, balls: 20 })).toBe(150);
    expect(economy({ runsConceded: 9, legalBalls: 9 })).toBe(6);
  });
});

describe('nextAction', () => {
  it('walks the scorer through a match', () => {
    expect(nextAction(play([]))).toBe('set_openers');
    expect(nextAction(play([ev.openers('a1', 'a2')]))).toBe('set_bowler');
    expect(nextAction(play(start))).toBe('delivery');
    expect(nextAction(play([...start, ev.out('bowled', 'a1')]))).toBe('new_batter');
    expect(nextAction(play([...start, ...dots(6)]))).toBe('set_bowler');

    const complete = [ev.endInnings(), ev.endInnings()];
    expect(nextAction(play(complete))).toBe('set_player_of_match');
    expect(nextAction(play([...complete, ev.potm('a1')]))).toBe('none');
  });
});

describe('result helpers', () => {
  it('target and balls remaining are safe on an unstarted match', () => {
    const state = createMatch(makeSetup());
    expect(target(state)).toBeNull();
    expect(ballsRemaining(state)).toBe(12);
    expect(ballsRemaining({ ...state, innings: [] })).toBe(0);
  });

  it('computeResult needs two innings', () => {
    expect(() => computeResult(createMatch(makeSetup()))).toThrow('A result needs two innings');
  });
});
