import type { MatchResult } from '@/domain';
import { summary } from '../__fixtures__/data';
import { nrrText, oversText, rateText, resultText, scoreText, summaryResultText } from '../format';

const name = (team: string) => ({ A: 'Huskies', B: 'Eagles' })[team] ?? team;

describe('format', () => {
  it('formats scores, overs and rates', () => {
    expect(scoreText(123, 4)).toBe('123/4');
    expect(oversText(20)).toBe('(3.2 ov)');
    expect(rateText(7.456)).toBe('7.46');
    expect(rateText(Infinity)).toBe('–');
    expect(rateText(null)).toBe('–');
  });

  it('signs net run rate and never shows -0', () => {
    expect(nrrText(1.2344)).toBe('+1.234');
    expect(nrrText(-0.5)).toBe('-0.500');
    expect(nrrText(-0.0001)).toBe('0.000');
    expect(nrrText(0)).toBe('0.000');
  });

  it.each<[MatchResult, string]>([
    [{ kind: 'tie' }, 'Match tied'],
    [
      { kind: 'win', winner: 'A', loser: 'B', margin: { by: 'runs', runs: 1 } },
      'Huskies won by 1 run',
    ],
    [
      {
        kind: 'win',
        winner: 'B',
        loser: 'A',
        margin: { by: 'wickets', wickets: 6, ballsRemaining: 8 },
      },
      'Eagles won by 6 wickets (8 balls left)',
    ],
    [
      {
        kind: 'win',
        winner: 'B',
        loser: 'A',
        margin: { by: 'wickets', wickets: 1, ballsRemaining: 0 },
      },
      'Eagles won by 1 wicket',
    ],
  ])('describes %j', (result, text) => {
    expect(resultText(result, name)).toBe(text);
  });

  it('describes a summary result with the stored team names', () => {
    expect(summaryResultText(summary())).toBe('Huskies won by 12 runs');
    expect(
      summaryResultText(
        summary({ result: { kind: 'win', winner: 'B', by: 'wickets', margin: 3 } }),
      ),
    ).toBe('Eagles won by 3 wickets');
    expect(summaryResultText(summary({ result: undefined, status: 'live' }))).toBeNull();
  });
});
