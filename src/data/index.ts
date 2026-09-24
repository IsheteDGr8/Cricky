import { createAuthService } from './auth';
import type { DataContext } from './context';
import { getBackend, type Backend } from './firebase';
import { secureRandomBytes } from './random';
import { createAccessRepository } from './repositories/access';
import { createMatchRepository } from './repositories/matches';
import { createTournamentRepository } from './repositories/tournaments';

/** Everything the app needs from the backend, wired to one Firebase connection. */
export function createDataLayer(backend: Backend = getBackend()) {
  const ctx: DataContext = {
    db: backend.db,
    currentUid: () => backend.auth.currentUser?.uid ?? null,
  };
  const access = createAccessRepository(ctx, secureRandomBytes);
  return {
    auth: createAuthService(backend.auth, access),
    access,
    tournaments: createTournamentRepository(ctx),
    matches: createMatchRepository(ctx),
  };
}

export type DataLayer = ReturnType<typeof createDataLayer>;

export type { Session, AuthService } from './auth';
export type { Listener, Unsubscribe } from './context';
export { DataError, type DataErrorCode } from './errors';
export { normalizeScorerCode } from './codes';
export { toMatchSetup } from './records';
export type { AccessRepository } from './repositories/access';
export type { MatchRepository, MatchSnapshot, NewMatch, Listed } from './repositories/matches';
export type {
  NewTournament,
  TournamentChanges,
  TournamentRepository,
  WithId,
} from './repositories/tournaments';
export type * from './schemas';
