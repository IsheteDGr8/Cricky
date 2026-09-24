import { equalTo, onValue, orderByChild, push, query, ref, set, update } from 'firebase/database';
import {
  entriesOf,
  requireUid,
  type DataContext,
  type Listener,
  type Unsubscribe,
} from '../context';
import { DataError, toWriteError } from '../errors';
import { paths } from '../paths';
import { TeamSchema, TournamentSchema, type Team, type Tournament } from '../schemas';

export type WithId<T> = T & { id: string };

export type NewTournament = Pick<
  Tournament,
  'name' | 'oversDefault' | 'playoffFormat' | 'thirdPlace'
>;
export type TournamentChanges = Partial<
  Omit<Tournament, 'createdAt' | 'createdBy' | 'playoffWinners'>
>;

export function createTournamentRepository(ctx: DataContext) {
  const { db } = ctx;

  const write = async (action: () => Promise<void>, message: string) => {
    try {
      await action();
    } catch (error) {
      throw toWriteError(error, message);
    }
  };

  return {
    /** All tournaments, newest first. Invalid records are skipped. */
    watchAll(listener: Listener<WithId<Tournament>[]>): Unsubscribe {
      return onValue(
        ref(db, paths.tournaments),
        (snap) => {
          const items: WithId<Tournament>[] = [];
          for (const [id, value] of entriesOf(snap.val())) {
            const parsed = TournamentSchema.safeParse(value);
            if (parsed.success) items.push({ ...parsed.data, id });
          }
          listener.onData(items.sort((a, b) => b.createdAt - a.createdAt));
        },
        (error) => listener.onError?.(error),
      );
    },

    watch(id: string, listener: Listener<WithId<Tournament>>): Unsubscribe {
      return onValue(
        ref(db, paths.tournament(id)),
        (snap) => {
          const parsed = TournamentSchema.safeParse(snap.val());
          if (parsed.success) listener.onData({ ...parsed.data, id });
          else if (!snap.exists())
            listener.onError?.(new DataError('not_found', 'Tournament not found'));
          else listener.onError?.(new DataError('invalid_data', 'Tournament data is invalid'));
        },
        (error) => listener.onError?.(error),
      );
    },

    /** Admin. */
    async create(input: NewTournament): Promise<string> {
      const uid = requireUid(ctx);
      const id = push(ref(db, paths.tournaments)).key as string;
      const tournament: Tournament = TournamentSchema.parse({
        ...input,
        status: 'upcoming',
        createdAt: Date.now(),
        createdBy: uid,
      });
      await write(
        () => set(ref(db, paths.tournament(id)), tournament),
        'Only admins can create tournaments',
      );
      return id;
    },

    /** Admin. */
    async update(id: string, changes: TournamentChanges): Promise<void> {
      await write(
        () => update(ref(db, paths.tournament(id)), changes),
        'Only admins can edit tournaments',
      );
    },

    /** Admin: records (or clears, with null) the winner of a playoff fixture. */
    async setPlayoffWinner(id: string, fixtureId: string, winner: string | null): Promise<void> {
      await write(
        () => set(ref(db, `${paths.tournament(id)}/playoffWinners/${fixtureId}`), winner),
        'Only admins can record playoff results',
      );
    },

    /** Admin: deletes the tournament and its teams. Matches are deleted separately. */
    async remove(id: string, teamIds: readonly string[]): Promise<void> {
      const changes: Record<string, null> = { [paths.tournament(id)]: null };
      for (const teamId of teamIds) changes[paths.team(teamId)] = null;
      await write(() => update(ref(db), changes), 'Only admins can delete tournaments');
    },

    watchTeams(tournamentId: string, listener: Listener<WithId<Team>[]>): Unsubscribe {
      const q = query(ref(db, paths.teams), orderByChild('tournamentId'), equalTo(tournamentId));
      return onValue(
        q,
        (snap) => {
          const items: WithId<Team>[] = [];
          for (const [id, value] of entriesOf(snap.val())) {
            const parsed = TeamSchema.safeParse(value);
            if (parsed.success) items.push({ ...parsed.data, id });
          }
          listener.onData(items.sort((a, b) => a.name.localeCompare(b.name)));
        },
        (error) => listener.onError?.(error),
      );
    },

    /** Admin: creates (id omitted) or replaces a team. Returns its id. */
    async saveTeam(team: Team, id?: string): Promise<string> {
      const teamId = id ?? (push(ref(db, paths.teams)).key as string);
      const valid = TeamSchema.parse(team);
      await write(() => set(ref(db, paths.team(teamId)), valid), 'Only admins can edit teams');
      return teamId;
    },

    /** Admin. */
    async removeTeam(id: string): Promise<void> {
      await write(() => set(ref(db, paths.team(id)), null), 'Only admins can delete teams');
    },
  };
}

export type TournamentRepository = ReturnType<typeof createTournamentRepository>;
