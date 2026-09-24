import { get, onValue, ref, serverTimestamp, set, update } from 'firebase/database';
import { generateScorerCode, normalizeScorerCode, type RandomBytes } from '../codes';
import { requireUid, type DataContext, type Listener, type Unsubscribe } from '../context';
import { DataError, isPermissionDenied, toWriteError } from '../errors';
import { paths } from '../paths';
import { RoleSchema, ScorerCodeSchema, type Role } from '../schemas';

/** Roles (who is an admin) and scorer codes (who may score a match). */
export function createAccessRepository(ctx: DataContext, randomBytes: RandomBytes) {
  const { db } = ctx;

  return {
    /** The role of a signed-in user; null for everyone who is not an admin. */
    watchRole(uid: string, listener: Listener<Role | null>): Unsubscribe {
      return onValue(
        ref(db, paths.role(uid)),
        (snap) => {
          const parsed = RoleSchema.safeParse(snap.val());
          listener.onData(parsed.success ? parsed.data : null);
        },
        (error) => listener.onError?.(error),
      );
    },

    /** Owner: grants or revokes admin. */
    async setAdmin(uid: string, isAdmin: boolean): Promise<void> {
      try {
        await set(ref(db, paths.role(uid)), isAdmin ? 'admin' : null);
      } catch (error) {
        throw toWriteError(error, 'Only the owner can change admins');
      }
    },

    /** Admin: creates or replaces a match's scorer code. Replacing it revokes existing scorers. */
    async issueScorerCode(matchId: string): Promise<string> {
      const code = generateScorerCode(randomBytes);
      try {
        await update(ref(db), {
          [paths.scorerCode(matchId)]: { code },
          [paths.scorers(matchId)]: null,
        });
      } catch (error) {
        throw toWriteError(error, 'Only admins can issue scorer codes');
      }
      return code;
    },

    /** Admin: the current code, or null if scoring is closed. */
    async getScorerCode(matchId: string): Promise<string | null> {
      const snap = await get(ref(db, `${paths.scorerCode(matchId)}/code`));
      return typeof snap.val() === 'string' ? (snap.val() as string) : null;
    },

    /** Admin: closes scoring for everyone except admins. */
    async revokeScorerCode(matchId: string): Promise<void> {
      try {
        await update(ref(db), {
          [paths.scorerCode(matchId)]: null,
          [paths.scorers(matchId)]: null,
        });
      } catch (error) {
        throw toWriteError(error, 'Only admins can revoke scorer codes');
      }
    },

    /** Scorer: registers the signed-in user as a scorer for the match. */
    async redeemScorerCode(matchId: string, input: string): Promise<void> {
      const uid = requireUid(ctx);
      const code = normalizeScorerCode(input);
      if (!ScorerCodeSchema.safeParse(code).success) {
        throw new DataError('invalid_code', 'Scorer codes are 10 letters and numbers');
      }
      try {
        await set(ref(db, paths.scorer(matchId, uid)), { code, at: serverTimestamp() });
      } catch (error) {
        if (isPermissionDenied(error)) {
          throw new DataError('invalid_code', 'That code is not valid for this match', {
            cause: error,
          });
        }
        throw error;
      }
    },

    /** Scorer: whether this user has redeemed a code for the match (it may since have been revoked). */
    async hasRedeemed(matchId: string): Promise<boolean> {
      const uid = requireUid(ctx);
      return (await get(ref(db, paths.scorer(matchId, uid)))).exists();
    },
  };
}

export type AccessRepository = ReturnType<typeof createAccessRepository>;
