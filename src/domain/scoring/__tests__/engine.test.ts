import { A, B, dots, ev, firstInningsOf, makeSetup, over, play } from '../../__fixtures__/scoring';
import { applyEvent, createMatch, currentInnings, replay, tryApplyEvent } from '../engine';
import { ScoringError } from '../errors';
import type { MatchEvent, MatchState } from '../types';

const start = [ev.openers('a1', 'a2'), ev.bowler('b1')];

function expectError(events: MatchEvent[], code: ScoringError['code'], setup = makeSetup()) {
  try {
    replay(setup, events);
  } catch (error) {
    expect(error).toBeInstanceOf(ScoringError);
    expect((error as ScoringError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ScoringError ${code}`);
}

describe('createMatch', () => {
  it('puts the toss winner in to bat when they choose to bat', () => {
    const inn = currentInnings(createMatch(makeSetup()));
    expect(inn).toMatchObject({ number: 1, battingTeam: A, bowlingTeam: B });
  });

  it('puts the other side in when the toss winner chooses to bowl', () => {
    const inn = currentInnings(createMatch(makeSetup({ toss: { winner: A, decision: 'bowl' } })));
    expect(inn).toMatchObject({ battingTeam: B, bowlingTeam: A });
  });

  it('copies squads so later changes do not leak into the setup', () => {
    const setup = makeSetup();
    const state = play([ev.addPlayer(A, 'a9')], setup);
    expect(state.squads[A]).toContain('a9');
    expect(setup.squads[A]).not.toContain('a9');
  });

  it.each<[string, Parameters<typeof makeSetup>[0]]>([
    ['same team twice', { teamB: A }],
    ['empty team id', { teamA: '' }],
    ['toss winner not playing', { toss: { winner: 'C', decision: 'bat' } }],
    ['invalid toss decision', { toss: { winner: A, decision: 'field' as 'bat' } }],
    ['zero overs', { oversPerInnings: 0 }],
    ['too many overs', { oversPerInnings: 51 }],
    ['fractional overs', { oversPerInnings: 2.5 }],
    ['one-player squad', { squadSize: 1 }],
    ['player in both squads', { squads: { [A]: ['p1', 'p2'], [B]: ['p2', 'p3'] } }],
    ['missing squad', { squads: { [A]: ['a1', 'a2'] } }],
  ])('rejects an invalid setup: %s', (_label, overrides) => {
    expect(() => createMatch(makeSetup(overrides))).toThrow(ScoringError);
  });
});

describe('openers and bowler', () => {
  it('sets the openers and starts a partnership', () => {
    const inn = currentInnings(play([ev.openers('a1', 'a2')]));
    expect(inn.striker).toBe('a1');
    expect(inn.nonStriker).toBe('a2');
    expect(inn.battingOrder).toEqual(['a1', 'a2']);
    expect(inn.partnerships).toEqual([{ batters: ['a1', 'a2'], runs: 0, legalBalls: 0 }]);
  });

  it('rejects choosing openers twice, the same player twice, or players from the wrong team', () => {
    expectError([ev.openers('a1', 'a2'), ev.openers('a3', 'a4')], 'openers_already_set');
    expectError([ev.openers('a1', 'a1')], 'player_unavailable');
    expectError([ev.openers('a1', 'b1')], 'unknown_player');
  });

  it('only accepts bowlers from the fielding side', () => {
    expectError([ev.bowler('a3')], 'unknown_player');
  });

  it('ignores choosing the current bowler again', () => {
    const inn = currentInnings(play([...start, ev.bowler('b1')]));
    expect(inn.bowler).toBe('b1');
  });

  it('requires openers, a bowler and no pending batter before a delivery', () => {
    expectError([ev.bowler('b1'), ev.dot()], 'openers_required');
    expectError([ev.openers('a1', 'a2'), ev.dot()], 'bowler_required');
    expectError([...start, ev.out('bowled', 'a1'), ev.dot()], 'batter_required');
  });
});

describe('runs off the bat', () => {
  it('adds runs to the team, striker and bowler', () => {
    const inn = currentInnings(play([...start, ev.runs(2), ev.runs(4), ev.runs(6)]));
    expect(inn.runs).toBe(12);
    expect(inn.legalBalls).toBe(3);
    expect(inn.batters.a1).toMatchObject({ runs: 12, balls: 3, fours: 1, sixes: 1 });
    expect(inn.bowlers.b1).toMatchObject({ legalBalls: 3, runsConceded: 12 });
  });

  it('rotates the strike on odd runs only', () => {
    expect(currentInnings(play([...start, ev.runs(1)])).striker).toBe('a2');
    expect(currentInnings(play([...start, ev.runs(3)])).striker).toBe('a2');
    expect(currentInnings(play([...start, ev.runs(2)])).striker).toBe('a1');
  });

  it.each([-1, 8, 1.5, Number.NaN])('rejects %p runs', (runs) => {
    expectError([...start, ev.runs(runs)], 'invalid_runs');
  });
});

describe('extras', () => {
  it('wide: 1 run penalty, not a legal ball, not faced by the batter, charged to the bowler', () => {
    const inn = currentInnings(play([...start, ev.extra('wide')]));
    expect(inn.runs).toBe(1);
    expect(inn.legalBalls).toBe(0);
    expect(inn.extras.wides).toBe(1);
    expect(inn.batters.a1?.balls).toBe(0);
    expect(inn.bowlers.b1).toMatchObject({ legalBalls: 0, runsConceded: 1, wides: 1 });
  });

  it('wide with runs taken: all runs are wides and the batters cross on odd runs', () => {
    const inn = currentInnings(play([...start, ev.extra('wide', 1)]));
    expect(inn.runs).toBe(2);
    expect(inn.extras.wides).toBe(2);
    expect(inn.striker).toBe('a2');
  });

  it('no-ball: penalty plus runs off the bat, faced by the batter, not a legal ball', () => {
    const inn = currentInnings(play([...start, ev.extra('no_ball', 4)]));
    expect(inn.runs).toBe(5);
    expect(inn.legalBalls).toBe(0);
    expect(inn.extras.noBalls).toBe(1);
    expect(inn.batters.a1).toMatchObject({ runs: 4, balls: 1, fours: 1 });
    expect(inn.bowlers.b1).toMatchObject({ runsConceded: 5, noBalls: 1 });
  });

  it('byes and leg-byes: legal, faced, not credited to the batter or charged to the bowler', () => {
    const inn = currentInnings(play([...start, ev.extra('bye', 2), ev.extra('leg_bye', 1)]));
    expect(inn.runs).toBe(3);
    expect(inn.legalBalls).toBe(2);
    expect(inn.extras).toMatchObject({ byes: 2, legByes: 1 });
    expect(inn.batters.a1).toMatchObject({ runs: 0, balls: 2 });
    expect(inn.bowlers.b1?.runsConceded).toBe(0);
    expect(inn.striker).toBe('a2');
  });

  it('rejects byes with no runs', () => {
    expectError([...start, ev.extra('bye', 0)], 'invalid_runs');
    expectError([...start, ev.extra('leg_bye', 0)], 'invalid_runs');
  });
});

describe('overs', () => {
  it('ends the over after six legal balls: bowler cleared, batters change ends', () => {
    const inn = currentInnings(play([...start, ...dots(6)]));
    expect(inn.bowler).toBeNull();
    expect(inn.previousOverBowler).toBe('b1');
    expect(inn.striker).toBe('a2');
    expect(inn.nonStriker).toBe('a1');
  });

  it('does not count wides and no-balls toward the over', () => {
    const inn = currentInnings(play([...start, ev.extra('wide'), ev.extra('no_ball'), ...dots(5)]));
    expect(inn.legalBalls).toBe(5);
    expect(inn.bowler).toBe('b1');
  });

  it('stops a bowler bowling consecutive overs', () => {
    expectError([...start, ...dots(6), ev.bowler('b1')], 'consecutive_overs');
  });

  it('records when each delivery happened', () => {
    const inn = currentInnings(play([...start, ev.dot(), ev.extra('wide'), ev.dot()]));
    expect(inn.deliveries.map((d) => [d.over, d.ballInOver, d.legal])).toEqual([
      [0, 1, true],
      [0, 1, false],
      [0, 2, true],
    ]);
  });

  describe('maidens', () => {
    it('counts an over with nothing charged to the bowler', () => {
      const inn = currentInnings(play([...start, ...dots(5), ev.extra('bye', 1)]));
      expect(inn.bowlers.b1?.maidens).toBe(1);
    });

    it('does not count an over with a wide', () => {
      const inn = currentInnings(play([...start, ev.extra('wide'), ...dots(6)]));
      expect(inn.bowlers.b1?.maidens).toBe(0);
    });

    it('does not count an over shared by two bowlers', () => {
      const inn = currentInnings(play([...start, ...dots(3), ev.bowler('b3'), ...dots(3)]));
      expect(inn.bowlers.b3?.maidens).toBe(0);
      expect(inn.bowlers.b3?.legalBalls).toBe(3);
    });

    it('still counts when the bowler was swapped before the first ball', () => {
      const inn = currentInnings(play([...start, ev.bowler('b3'), ...dots(6)]));
      expect(inn.bowlers.b3?.maidens).toBe(1);
      expect(inn.bowlingOrder).toEqual(['b3']);
    });
  });
});

describe('wickets', () => {
  it('bowled: credits the bowler, records the fall of wicket and waits for the next batter', () => {
    const inn = currentInnings(play([...start, ev.runs(2), ev.out('bowled', 'a1')]));
    expect(inn.wickets).toBe(1);
    expect(inn.batters.a1?.dismissal).toEqual({ kind: 'bowled', bowler: 'b1' });
    expect(inn.bowlers.b1?.wickets).toBe(1);
    expect(inn.fallOfWickets).toEqual([{ wicket: 1, player: 'a1', runs: 2, legalBalls: 2 }]);
    expect(inn.striker).toBeNull();
    expect(inn.awaitingBatter).toBe('striker');
  });

  it('the new batter takes the vacant slot and starts a new partnership', () => {
    const inn = currentInnings(
      play([...start, ev.runs(2), ev.out('caught', 'a1', { fielder: 'b4' }), ev.batter('a3')]),
    );
    expect(inn.batters.a1?.dismissal).toEqual({ kind: 'caught', bowler: 'b1', fielder: 'b4' });
    expect(inn.striker).toBe('a3');
    expect(inn.awaitingBatter).toBeNull();
    expect(inn.partnerships).toEqual([
      { batters: ['a1', 'a2'], runs: 2, legalBalls: 2 },
      { batters: ['a3', 'a2'], runs: 0, legalBalls: 0 },
    ]);
  });

  it('run out: runs completed count, the bowler gets no wicket, either batter can be out', () => {
    // a1 and a2 complete 1 run (ends change), then a2 is run out at the striker's end.
    const inn = currentInnings(play([...start, ev.out('run_out', 'a2', { runs: 1 })]));
    expect(inn.runs).toBe(1);
    expect(inn.batters.a1?.runs).toBe(1);
    expect(inn.bowlers.b1?.wickets).toBe(0);
    expect(inn.batters.a2?.dismissal).toEqual({ kind: 'run_out' });
    expect(inn.striker).toBeNull();
    expect(inn.nonStriker).toBe('a1');
    expect(inn.awaitingBatter).toBe('striker');
  });

  it('stumped off a wide counts the wide and the wicket', () => {
    const inn = currentInnings(play([...start, ev.out('stumped', 'a1', { extra: 'wide' })]));
    expect(inn.runs).toBe(1);
    expect(inn.wickets).toBe(1);
    expect(inn.legalBalls).toBe(0);
    expect(inn.bowlers.b1?.wickets).toBe(1);
  });

  it('a wicket on the last ball of the over puts the new batter at the non-striker end', () => {
    const inn = currentInnings(play([...start, ...dots(5), ev.out('lbw', 'a1'), ev.batter('a3')]));
    expect(inn.striker).toBe('a2');
    expect(inn.nonStriker).toBe('a3');
  });

  it.each<[string, MatchEvent]>([
    ['caught off a no-ball', ev.out('caught', 'a1', { extra: 'no_ball' })],
    ['bowled off a wide', ev.out('bowled', 'a1', { extra: 'wide' })],
    ['lbw off a bye', ev.out('lbw', 'a1', { extra: 'bye', runs: 1 })],
    ['bowled with runs', ev.out('bowled', 'a1', { runs: 1 })],
    ['non-striker stumped', ev.out('stumped', 'a2')],
    ['player not batting', ev.out('run_out', 'a4')],
  ])('rejects an impossible dismissal: %s', (_label, event) => {
    expectError([...start, event], 'invalid_dismissal');
  });

  it('rejects a fielder from the batting side', () => {
    expectError([...start, ev.out('caught', 'a1', { fielder: 'a3' })], 'unknown_player');
  });

  describe('new batter', () => {
    it('is only accepted when a slot is vacant', () => {
      expectError([...start, ev.batter('a3')], 'no_batter_required');
    });

    it('must not already be batting or out', () => {
      const afterWicket = [...start, ev.out('bowled', 'a1')];
      expectError([...afterWicket, ev.batter('a2')], 'player_unavailable');
      expectError([...afterWicket, ev.batter('a1')], 'player_unavailable');
      expectError([...afterWicket, ev.batter('b3')], 'unknown_player');
    });
  });
});

describe('retirements', () => {
  it('retired hurt vacates the slot without a wicket, and the batter may return later', () => {
    const events = [...start, ev.runs(4), ev.retire('a1', 'retired_hurt'), ev.batter('a3')];
    let inn = currentInnings(play(events));
    expect(inn.wickets).toBe(0);
    expect(inn.batters.a1?.retiredHurt).toBe(true);
    expect(inn.striker).toBe('a3');

    inn = currentInnings(play([...events, ev.out('bowled', 'a3'), ev.batter('a1')]));
    expect(inn.striker).toBe('a1');
    expect(inn.batters.a1).toMatchObject({ runs: 4, retiredHurt: false });
    expect(inn.battingOrder).toEqual(['a1', 'a2', 'a3']);
  });

  it('retired out counts as a wicket but not for the bowler', () => {
    const inn = currentInnings(play([...start, ev.retire('a2', 'retired_out')]));
    expect(inn.wickets).toBe(1);
    expect(inn.batters.a2?.dismissal).toEqual({ kind: 'retired_out' });
    expect(inn.awaitingBatter).toBe('non_striker');
    expect(inn.bowlers.b1).toBeUndefined();
  });

  it('only a batter at the crease can retire, and not while a slot is vacant', () => {
    expectError([...start, ev.retire('a4', 'retired_hurt')], 'player_unavailable');
    expectError(
      [...start, ev.out('bowled', 'a1'), ev.retire('a2', 'retired_hurt')],
      'batter_required',
    );
  });
});

describe('swap strike', () => {
  it('swaps the batters', () => {
    expect(currentInnings(play([...start, ev.swap()])).striker).toBe('a2');
  });

  it('needs both batters at the crease', () => {
    expectError([ev.swap()], 'batter_required');
  });
});

describe('end of innings', () => {
  it('ends after the overs are bowled and starts the chase', () => {
    const state = play(firstInningsOf([1, 0, 4, 0, 0, 0, 6, 0, 0, 0, 0, 2]));
    expect(state.innings[0]?.endReason).toBe('overs');
    expect(state.innings[0]?.runs).toBe(13);
    const chase = currentInnings(state);
    expect(chase).toMatchObject({ number: 2, battingTeam: B, bowlingTeam: A, runs: 0 });
  });

  it('ends when all but one batter is out (wicket limit = squad size - 1)', () => {
    const state = play(
      [...start, ev.out('bowled', 'a1'), ev.batter('a3'), ev.out('bowled', 'a3')],
      makeSetup({ squadSize: 3 }),
    );
    expect(state.innings[0]).toMatchObject({ endReason: 'all_out', wickets: 2 });
    expect(state.innings).toHaveLength(2);
  });

  it('ends when retirements exhaust the batting side', () => {
    const state = play(
      [...start, ev.retire('a1', 'retired_out'), ev.batter('a3'), ev.retire('a3', 'retired_out')],
      makeSetup({ squadSize: 3 }),
    );
    expect(state.innings[0]?.endReason).toBe('all_out');
  });

  it('can be ended manually', () => {
    const state = play([...start, ev.runs(3), ev.endInnings()]);
    expect(state.innings[0]).toMatchObject({ endReason: 'manual', runs: 3 });
  });
});

describe('match result', () => {
  const first = firstInningsOf([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); // 12 runs

  it('chasing side wins by wickets when it passes the target', () => {
    const state = play([
      ...first,
      ev.openers('b1', 'b2'),
      ...over('a1', [ev.runs(6), ev.runs(6), ev.out('bowled', 'b1'), ev.batter('b3'), ev.runs(1)]),
    ]);
    expect(state.status).toBe('complete');
    expect(state.innings[1]?.endReason).toBe('target');
    expect(state.result).toEqual({
      kind: 'win',
      winner: B,
      loser: A,
      margin: { by: 'wickets', wickets: 3, ballsRemaining: 8 },
    });
  });

  it('side batting first wins by runs', () => {
    const state = play([
      ...first,
      ev.openers('b1', 'b2'),
      ...over('a1', dots(6)),
      ...over('a2', dots(6)),
    ]);
    expect(state.result).toEqual({
      kind: 'win',
      winner: A,
      loser: B,
      margin: { by: 'runs', runs: 12 },
    });
  });

  it('scores level is a tie', () => {
    const state = play([
      ...first,
      ev.openers('b1', 'b2'),
      ...over('a1', [ev.runs(6), ev.runs(6), ...dots(4)]),
      ...over('a2', dots(6)),
    ]);
    expect(state.result).toEqual({ kind: 'tie' });
  });

  it('accepts only Player of the Match after completion', () => {
    const complete = [...first, ev.openers('b1', 'b2'), ev.endInnings()];
    expectError([...complete, ev.dot()], 'match_complete');
    expect(play([...complete, ev.potm('a1')]).playerOfMatch).toBe('a1');
    expect(play([...complete, ev.potm('a1'), ev.potm(null)]).playerOfMatch).toBeNull();
    expectError([...complete, ev.potm('zz')], 'unknown_player');
  });

  it('rejects Player of the Match before the match is complete', () => {
    expectError([ev.potm('a1')], 'match_not_complete');
  });
});

describe('mid-game changes', () => {
  it('can increase or reduce the overs', () => {
    expect(play([ev.overs(5)]).oversPerInnings).toBe(5);
    expect(play([...start, ev.dot(), ev.overs(1)]).oversPerInnings).toBe(1);
  });

  it('ends the innings when overs are cut to what has already been bowled', () => {
    const state = play([...start, ...dots(6), ev.overs(1)]);
    expect(state.innings[0]?.endReason).toBe('overs');
  });

  it('cannot cut overs below the over in progress', () => {
    const setup = makeSetup({ oversPerInnings: 5 });
    expectError(
      [...start, ...dots(6), ev.bowler('b2'), ev.dot(), ev.overs(1)],
      'invalid_overs',
      setup,
    );
  });

  it.each([0, 51, 2.5])('rejects %p overs', (overs) => {
    expectError([ev.overs(overs)], 'invalid_overs');
  });

  it('adding a player raises the wicket limit', () => {
    const setup = makeSetup({ squadSize: 2 });
    const state = play([ev.addPlayer(A, 'a3'), ...start, ev.out('bowled', 'a1')], setup);
    expect(state.innings).toHaveLength(1);
    expect(currentInnings(state).awaitingBatter).toBe('striker');
  });

  it('rejects duplicate players and unknown teams', () => {
    expectError([ev.addPlayer(A, 'b1')], 'duplicate_player');
    expectError([ev.addPlayer('C', 'c1')], 'unknown_player');
  });
});

describe('applyEvent / tryApplyEvent / replay', () => {
  it('does not mutate the previous state', () => {
    const before = play(start);
    const snapshot = JSON.stringify(before);
    applyEvent(before, ev.runs(4));
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('applying events one at a time matches replaying them', () => {
    const events: MatchEvent[] = [
      ...start,
      ev.runs(1),
      ev.extra('wide', 2),
      ev.out('caught', 'a2', { fielder: 'b3' }),
      ev.batter('a3'),
      ev.extra('no_ball', 6),
      ...dots(4),
      ev.bowler('b2'),
      ev.runs(4),
    ];
    const setup = makeSetup();
    let incremental: MatchState = createMatch(setup);
    for (const event of events) incremental = applyEvent(incremental, event);
    expect(incremental).toEqual(replay(setup, events));
  });

  it('undo is replaying without the last event', () => {
    const events = [...start, ev.runs(2), ev.out('bowled', 'a1')];
    expect(play(events.slice(0, -1))).toEqual(play([...start, ev.runs(2)]));
  });

  it('tryApplyEvent returns the error instead of throwing', () => {
    const outcome = tryApplyEvent(createMatch(makeSetup()), ev.dot());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('openers_required');
    expect(tryApplyEvent(createMatch(makeSetup()), ev.openers('a1', 'a2')).ok).toBe(true);
  });

  it('tryApplyEvent rethrows unexpected errors', () => {
    const broken = { ...createMatch(makeSetup()), innings: [] } as MatchState;
    expect(() => tryApplyEvent(broken, ev.dot())).toThrow('Match has no innings');
  });

  it('replay reports which event failed', () => {
    try {
      play([ev.openers('a1', 'a2'), ev.dot()]);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ScoringError);
      expect((error as ScoringError).eventIndex).toBe(1);
      expect((error as ScoringError).message).toMatch(/^Event 1: /);
    }
  });
});
