import {
  bracketForFormat,
  crossoverBracket,
  finalOnlyBracket,
  resolveBracket,
  topFourBracket,
  type Bracket,
} from '../bracket';

const rankings = { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] };

describe('crossoverBracket', () => {
  const bracket = crossoverBracket();

  it('pairs group winners with the other group runners-up', () => {
    const { fixtures, champion } = resolveBracket(bracket, rankings, {});
    expect(fixtures.map((f) => [f.id, f.home, f.away, f.winner])).toEqual([
      ['semi-1', 'a1', 'b2', null],
      ['semi-2', 'b1', 'a2', null],
      ['third-place', null, null, null],
      ['final', null, null, null],
    ]);
    expect(champion).toBeNull();
  });

  it('fills later rounds as results come in', () => {
    const { fixtures, champion } = resolveBracket(bracket, rankings, {
      'semi-1': 'b2',
      'semi-2': 'b1',
      'third-place': 'a1',
      final: 'b1',
    });
    expect(fixtures.find((f) => f.id === 'third-place')).toMatchObject({
      home: 'a1',
      away: 'a2',
      winner: 'a1',
    });
    expect(fixtures.find((f) => f.id === 'final')).toMatchObject({ home: 'b2', away: 'b1' });
    expect(champion).toBe('b1');
  });

  it('can skip the third-place match and use custom group names', () => {
    const custom = crossoverBracket('North', 'South', { thirdPlace: false });
    expect(custom.fixtures.map((f) => f.id)).toEqual(['semi-1', 'semi-2', 'final']);
    const { fixtures } = resolveBracket(custom, { North: ['n1', 'n2'], South: ['s1', 's2'] }, {});
    expect(fixtures[0]).toMatchObject({ home: 'n1', away: 's2' });
  });

  it('leaves a slot empty when a group has too few teams', () => {
    const { fixtures } = resolveBracket(bracket, { A: ['a1'], B: ['b1'] }, {});
    expect(fixtures[0]).toMatchObject({ home: 'a1', away: null });
  });
});

describe('topFourBracket', () => {
  it('plays 1 v 4 and 2 v 3', () => {
    const { fixtures } = resolveBracket(topFourBracket(), { A: ['t1', 't2', 't3', 't4'] }, {});
    expect(fixtures.slice(0, 2).map((f) => [f.home, f.away])).toEqual([
      ['t1', 't4'],
      ['t2', 't3'],
    ]);
  });
});

describe('finalOnlyBracket', () => {
  it('is a single final between the top two', () => {
    const { fixtures, champion } = resolveBracket(
      finalOnlyBracket(),
      { A: ['t1', 't2'] },
      { final: 't2' },
    );
    expect(fixtures).toEqual([
      { id: 'final', name: 'Final', home: 't1', away: 't2', winner: 't2' },
    ]);
    expect(champion).toBe('t2');
  });
});

describe('resolveBracket validation', () => {
  it('rejects a winner who is not playing the fixture', () => {
    expect(() => resolveBracket(finalOnlyBracket(), { A: ['t1', 't2'] }, { final: 't3' })).toThrow(
      'Winner of final must be one of the teams playing it',
    );
  });

  it('rejects a fixture that refers to a later fixture', () => {
    const bad: Bracket = {
      fixtures: [
        {
          id: 'final',
          name: 'Final',
          home: { from: 'winner', fixture: 'semi' },
          away: { from: 'winner', fixture: 'semi' },
        },
      ],
      finalId: 'final',
    };
    expect(() => resolveBracket(bad, {}, {})).toThrow('Fixture semi must come before');
  });
});

describe('bracketForFormat', () => {
  const ids = (b: Bracket | null) => b?.fixtures.map((f) => f.id);

  it('builds the bracket each format describes', () => {
    expect(bracketForFormat('none', ['A'])).toBeNull();
    expect(ids(bracketForFormat('final_only', ['A']))).toEqual(['final']);
    expect(ids(bracketForFormat('top_four', ['A'], { thirdPlace: false }))).toEqual([
      'semi-1',
      'semi-2',
      'final',
    ]);
  });

  it('crosses over the first two groups it is given', () => {
    const bracket = bracketForFormat('crossover', ['East', 'West']) as Bracket;
    expect(bracket.fixtures[0]?.home).toEqual({ from: 'standings', group: 'East', position: 1 });
    expect(bracket.fixtures[0]?.away).toEqual({ from: 'standings', group: 'West', position: 2 });
  });
});
