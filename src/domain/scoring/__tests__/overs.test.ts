import { ballsToOvers, oversToBalls, requiredRunRateFor, runRate } from '../overs';

describe('ballsToOvers', () => {
  it.each([
    [0, '0.0'],
    [5, '0.5'],
    [6, '1.0'],
    [20, '3.2'],
    [120, '20.0'],
  ])('%i balls -> %s', (balls, expected) => {
    expect(ballsToOvers(balls)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN])('rejects %p', (balls) => {
    expect(() => ballsToOvers(balls)).toThrow(RangeError);
  });
});

describe('oversToBalls', () => {
  it.each([
    ['0.0', 0],
    ['0.5', 5],
    ['3.2', 20],
    ['10', 60],
    [' 4.1 ', 25],
  ])('%s -> %i balls', (overs, expected) => {
    expect(oversToBalls(overs)).toBe(expected);
  });

  it.each(['3.6', '3.10', '-1', 'abc', '', '1.2.3'])('rejects %p', (overs) => {
    expect(() => oversToBalls(overs)).toThrow(RangeError);
  });

  it('round-trips with ballsToOvers', () => {
    for (let balls = 0; balls <= 300; balls++) {
      expect(oversToBalls(ballsToOvers(balls))).toBe(balls);
    }
  });
});

describe('runRate', () => {
  it('is 0 before a ball is bowled', () => {
    expect(runRate(0, 0)).toBe(0);
  });

  it('scales runs to a six-ball over', () => {
    expect(runRate(30, 20)).toBe(9);
    expect(runRate(7, 6)).toBe(7);
  });

  it('rejects negative input', () => {
    expect(() => runRate(-1, 6)).toThrow(RangeError);
  });
});

describe('requiredRunRateFor', () => {
  it('is 0 when the target is already reached', () => {
    expect(requiredRunRateFor(100, 100, 12)).toBe(0);
    expect(requiredRunRateFor(100, 104, 0)).toBe(0);
  });

  it('is Infinity when runs are needed and no balls remain', () => {
    expect(requiredRunRateFor(100, 90, 0)).toBe(Infinity);
  });

  it('scales remaining runs to overs', () => {
    expect(requiredRunRateFor(120, 90, 30)).toBe(6);
  });

  it('rejects invalid input', () => {
    expect(() => requiredRunRateFor(100, 90, -6)).toThrow(RangeError);
  });
});
