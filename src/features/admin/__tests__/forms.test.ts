import { parseMatchForm, parseQuickTeams, parseTeamForm, parseTournamentForm } from '../forms';

describe('parseTournamentForm', () => {
  it('accepts a valid tournament', () => {
    expect(
      parseTournamentForm({
        name: 'Summer Cup',
        overs: '10',
        playoffFormat: 'crossover',
        thirdPlace: true,
      }),
    ).toEqual({
      name: 'Summer Cup',
      oversDefault: 10,
      playoffFormat: 'crossover',
      thirdPlace: true,
    });
  });

  it('rejects a bad overs value', () => {
    expect(
      parseTournamentForm({ name: 'X', overs: '0', playoffFormat: 'none', thirdPlace: false }),
    ).toBe('Overs must be a whole number from 1 to 50.');
  });
});

describe('parseTeamForm', () => {
  it('builds a squad from a player list', () => {
    const team = parseTeamForm({
      name: 'Huskies',
      tournamentId: 't1',
      group: 'A',
      captainName: 'Asha',
      players: 'Asha, Ben\nDev',
    });
    if (typeof team === 'string') throw new Error(team);
    expect(team.name).toBe('Huskies');
    expect(Object.values(team.players).map((p) => p.name)).toEqual(['Asha', 'Ben', 'Dev']);
    expect(team.captainId && team.players[team.captainId]?.name).toBe('Asha');
  });

  it('needs two players', () => {
    expect(parseTeamForm({ name: 'X', tournamentId: 't1', group: 'A', players: 'Only' })).toBe(
      'A team needs at least two players.',
    );
  });
});

describe('parseQuickTeams and parseMatchForm', () => {
  it('builds a quick match from typed names', () => {
    const sides = parseQuickTeams('Huskies', 'Asha\nBen', 'Eagles', 'Bea, Bo');
    if (typeof sides === 'string') throw new Error(sides);
    const match = parseMatchForm({
      teamA: sides[0],
      teamB: sides[1],
      overs: '8',
      tossWinner: sides[0].id,
      tossDecision: 'bowl',
      stage: 'quick',
    });
    if (typeof match === 'string') throw new Error(match);
    expect(match.stage).toBe('quick');
    expect(match.players).toHaveLength(4);
    expect(match.toss).toEqual({ winner: sides[0].id, decision: 'bowl' });
  });

  it('rejects the same team twice', () => {
    expect(
      parseMatchForm({
        teamA: {
          id: 'A',
          name: 'A',
          players: [
            { id: 'a1', name: 'Asha' },
            { id: 'a2', name: 'Ben' },
          ],
        },
        teamB: {
          id: 'A',
          name: 'A',
          players: [
            { id: 'a1', name: 'Asha' },
            { id: 'a2', name: 'Ben' },
          ],
        },
        overs: '10',
        tossWinner: 'A',
        tossDecision: 'bat',
        stage: 'group',
      }),
    ).toBe('Pick two different teams.');
  });
});
