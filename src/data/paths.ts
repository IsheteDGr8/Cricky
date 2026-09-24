/** Every database location the app uses. Keep in sync with firebase/database.rules.json. */
export const paths = {
  role: (uid: string) => `roles/${uid}`,
  tournaments: 'tournaments',
  tournament: (id: string) => `tournaments/${id}`,
  teams: 'teams',
  team: (id: string) => `teams/${id}`,
  matches: 'matches',
  match: (id: string) => `matches/${id}`,
  matchSummaries: 'matchSummaries',
  matchSummary: (id: string) => `matchSummaries/${id}`,
  matchResults: 'matchResults',
  matchResult: (id: string) => `matchResults/${id}`,
  scorerCode: (matchId: string) => `scorerCodes/${matchId}`,
  scorers: (matchId: string) => `scorers/${matchId}`,
  scorer: (matchId: string, uid: string) => `scorers/${matchId}/${uid}`,
} as const;
