import type { NewMatch, NewTournament, PlayoffFormat, Stage, Team } from '@/data';
import type { TossDecision } from '@/domain';
import { newRecordId } from '../ids';

const trim = (value: string) => value.trim();

export function parseTournamentForm(input: {
  name: string;
  overs: string;
  playoffFormat: PlayoffFormat;
  thirdPlace: boolean;
}): NewTournament | string {
  const name = trim(input.name);
  const oversDefault = Number(input.overs);
  if (!name) return 'Give the tournament a name.';
  if (name.length > 60) return 'The name must be 60 characters or fewer.';
  if (!Number.isInteger(oversDefault) || oversDefault < 1 || oversDefault > 50) {
    return 'Overs must be a whole number from 1 to 50.';
  }
  return { name, oversDefault, playoffFormat: input.playoffFormat, thirdPlace: input.thirdPlace };
}

export function parsePlayerNames(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map(trim)
    .filter(Boolean);
}

export function parseTeamForm(input: {
  name: string;
  tournamentId: string;
  group: string;
  captainName?: string;
  players: string;
}): Team | string {
  const name = trim(input.name);
  const group = trim(input.group) || 'A';
  const players = parsePlayerNames(input.players);
  if (!name) return 'Give the team a name.';
  if (name.length > 40) return 'The team name must be 40 characters or fewer.';
  if (group.length > 10) return 'The group must be 10 characters or fewer.';
  if (players.length < 2) return 'A team needs at least two players.';
  if (players.some((p) => p.length > 40)) return 'Player names must be 40 characters or fewer.';
  const unique = new Set(players.map((p) => p.toLowerCase()));
  if (unique.size !== players.length) return 'Two players have the same name.';
  const records = Object.fromEntries(
    players.map((player, order) => [newRecordId(), { name: player, order }]),
  );
  const captainId = input.captainName
    ? Object.entries(records).find(([, p]) => p.name === trim(input.captainName ?? ''))?.[0]
    : undefined;
  return {
    name,
    tournamentId: input.tournamentId,
    group,
    ...(captainId ? { captainId } : {}),
    players: records,
  };
}

export function parseMatchForm(input: {
  teamA: { id: string; name: string; players: { id: string; name: string }[] };
  teamB: { id: string; name: string; players: { id: string; name: string }[] };
  overs: string;
  tossWinner: string;
  tossDecision: TossDecision;
  stage: Stage;
  tournamentId?: string;
  fixtureId?: string;
}): NewMatch | string {
  const oversPerInnings = Number(input.overs);
  if (input.teamA.id === input.teamB.id) return 'Pick two different teams.';
  if (input.teamA.players.length < 2 || input.teamB.players.length < 2) {
    return 'Each team needs at least two players.';
  }
  if (!Number.isInteger(oversPerInnings) || oversPerInnings < 1 || oversPerInnings > 50) {
    return 'Overs must be a whole number from 1 to 50.';
  }
  if (input.tossWinner !== input.teamA.id && input.tossWinner !== input.teamB.id) {
    return 'The toss winner must be one of the two teams.';
  }
  return {
    stage: input.stage,
    ...(input.tournamentId ? { tournamentId: input.tournamentId } : {}),
    ...(input.fixtureId ? { fixtureId: input.fixtureId } : {}),
    teams: [
      { id: input.teamA.id, name: input.teamA.name },
      { id: input.teamB.id, name: input.teamB.name },
    ],
    players: [
      ...input.teamA.players.map((p) => ({ ...p, team: input.teamA.id })),
      ...input.teamB.players.map((p) => ({ ...p, team: input.teamB.id })),
    ],
    oversPerInnings,
    toss: { winner: input.tossWinner, decision: input.tossDecision },
  };
}

export function parseQuickTeams(
  aName: string,
  aPlayers: string,
  bName: string,
  bPlayers: string,
):
  | [
      { id: string; name: string; players: { id: string; name: string }[] },
      { id: string; name: string; players: { id: string; name: string }[] },
    ]
  | string {
  const sides = [
    { name: trim(aName), players: parsePlayerNames(aPlayers) },
    { name: trim(bName), players: parsePlayerNames(bPlayers) },
  ];
  for (const side of sides) {
    if (!side.name) return 'Both teams need a name.';
    if (side.players.length < 2) return `${side.name || 'Each team'} needs at least two players.`;
  }
  return sides.map((side) => ({
    id: newRecordId(),
    name: side.name,
    players: side.players.map((name) => ({ id: newRecordId(), name })),
  })) as [
    { id: string; name: string; players: { id: string; name: string }[] },
    { id: string; name: string; players: { id: string; name: string }[] },
  ];
}
