import {
  equalTo,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import {
  scoreSummary,
  type MatchEvent,
  type MatchState,
  type PlayerId,
  type TeamId,
} from '@/domain';
import {
  entriesOf,
  requireUid,
  type DataContext,
  type Listener,
  type Unsubscribe,
} from '../context';
import { DataError, toWriteError } from '../errors';
import { paths } from '../paths';
import { playerNames, toDomainEvent, toMatchResultRecord, toStoredEvent } from '../records';
import {
  EventRecordSchema,
  MatchMetaSchema,
  MatchResultRecordSchema,
  MatchSummarySchema,
  type EventRecord,
  type MatchMeta,
  type MatchResultRecord,
  type MatchSummary,
  type Stage,
} from '../schemas';

export interface NewMatch {
  stage: Stage;
  tournamentId?: string;
  fixtureId?: string;
  teams: [{ id: TeamId; name: string }, { id: TeamId; name: string }];
  /** In batting-list order per team. */
  players: { id: PlayerId; name: string; team: TeamId }[];
  oversPerInnings: number;
  toss: MatchMeta['toss'];
}

export interface MatchSnapshot {
  id: string;
  meta: MatchMeta;
  /** Number of events; the next event's sequence number. */
  head: number;
  events: MatchEvent[];
  records: EventRecord[];
  names: Record<PlayerId, string>;
}

export interface Listed<T> {
  items: (T & { id: string })[];
  /** Ids of records that failed validation and were left out. */
  invalid: string[];
}

export function createMatchRepository(ctx: DataContext) {
  const { db } = ctx;

  return {
    /** Admin: creates the match, its (empty) summary and returns the new id. */
    async create(input: NewMatch): Promise<string> {
      const uid = requireUid(ctx);
      const id = push(ref(db, paths.matches)).key as string;
      const [a, b] = input.teams;
      const order: Record<TeamId, number> = {};
      const meta: MatchMeta = {
        stage: input.stage,
        ...(input.tournamentId ? { tournamentId: input.tournamentId } : {}),
        ...(input.fixtureId ? { fixtureId: input.fixtureId } : {}),
        teamA: a.id,
        teamB: b.id,
        teams: { [a.id]: { name: a.name }, [b.id]: { name: b.name } },
        players: Object.fromEntries(
          input.players.map((p) => {
            const n = order[p.team] ?? 0;
            order[p.team] = n + 1;
            return [p.id, { name: p.name, team: p.team, order: n }];
          }),
        ),
        oversPerInnings: input.oversPerInnings,
        toss: input.toss,
        createdAt: Date.now(),
        createdBy: uid,
        locked: false,
      };
      MatchMetaSchema.parse(meta);
      try {
        await update(ref(db), {
          [paths.match(id)]: { meta, head: 0 },
          [paths.matchSummary(id)]: {
            stage: meta.stage,
            ...(meta.tournamentId ? { tournamentId: meta.tournamentId } : {}),
            teamA: meta.teamA,
            teamB: meta.teamB,
            teamAName: a.name,
            teamBName: b.name,
            status: 'scheduled',
            updatedAt: serverTimestamp(),
          },
        });
      } catch (error) {
        throw toWriteError(error, 'Only admins can create matches');
      }
      return id;
    },

    /** Live match: setup plus every event, re-delivered on each change. */
    watch(id: string, listener: Listener<MatchSnapshot>): Unsubscribe {
      return onValue(
        ref(db, paths.match(id)),
        (snap) => {
          try {
            listener.onData(parseMatch(id, snap.val()));
          } catch (error) {
            listener.onError?.(error as Error);
          }
        },
        (error) => listener.onError?.(error),
      );
    },

    async get(id: string): Promise<MatchSnapshot> {
      return parseMatch(id, (await get(ref(db, paths.match(id)))).val());
    },

    /**
     * Scorer: appends `event` as number `head`. Fails with permission_denied if another scorer
     * got there first; re-read the match and try again.
     */
    async append(id: string, head: number, event: MatchEvent, playerName?: string): Promise<void> {
      const uid = requireUid(ctx);
      const record = { ...toStoredEvent(event, playerName), by: uid, at: serverTimestamp() };
      try {
        await update(ref(db, paths.match(id)), { [`events/${head}`]: record, head: head + 1 });
      } catch (error) {
        throw toWriteError(
          error,
          'This event was not saved: you may not be a scorer for this match',
        );
      }
    },

    /** Scorer: removes the last event (undo). */
    async undo(id: string, head: number): Promise<void> {
      if (head < 1) throw new DataError('not_found', 'There is nothing to undo');
      try {
        await update(ref(db, paths.match(id)), { [`events/${head - 1}`]: null, head: head - 1 });
      } catch (error) {
        throw toWriteError(error, 'Undo was not saved');
      }
    },

    /** Scorer: updates the small record that match lists read. Call after each event. */
    async publishSummary(id: string, meta: MatchMeta, state: MatchState): Promise<void> {
      const summary = scoreSummary(state);
      try {
        await update(ref(db, paths.matchSummary(id)), {
          stage: meta.stage,
          ...(meta.tournamentId ? { tournamentId: meta.tournamentId } : {}),
          teamA: meta.teamA,
          teamB: meta.teamB,
          status: summary.status,
          innings: summary.innings,
          result: summary.result ?? null,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        throw toWriteError(error, 'The match summary was not saved');
      }
    },

    /** Scorer: stores the final scorecard used for standings and leaderboards. */
    async publishResult(id: string, meta: MatchMeta, state: MatchState): Promise<void> {
      const record = toMatchResultRecord(id, meta, state);
      try {
        await set(ref(db, paths.matchResult(id)), record);
      } catch (error) {
        throw toWriteError(error, 'The match result was not saved');
      }
    },

    /** Scorer or admin: stops further scoring. Only an admin can unlock. */
    async setLocked(id: string, locked: boolean): Promise<void> {
      try {
        await update(ref(db, `${paths.match(id)}/meta`), { locked });
      } catch (error) {
        throw toWriteError(error, locked ? 'Could not lock the match' : 'Only admins can unlock');
      }
    },

    /** Admin: deletes the match and everything attached to it. */
    async remove(id: string): Promise<void> {
      try {
        await update(ref(db), {
          [paths.match(id)]: null,
          [paths.matchSummary(id)]: null,
          [paths.matchResult(id)]: null,
          [paths.scorerCode(id)]: null,
          [paths.scorers(id)]: null,
        });
      } catch (error) {
        throw toWriteError(error, 'Only admins can delete matches');
      }
    },

    /** Summaries for one tournament, or the most recently updated when no id is given. */
    watchSummaries(
      filter: { tournamentId: string } | { recent: number },
      listener: Listener<Listed<MatchSummary>>,
    ): Unsubscribe {
      const base = ref(db, paths.matchSummaries);
      const q =
        'tournamentId' in filter
          ? query(base, orderByChild('tournamentId'), equalTo(filter.tournamentId))
          : query(base, orderByChild('updatedAt'), limitToLast(filter.recent));
      return onValue(
        q,
        (snap) => {
          const listed = parseList(snap.val(), MatchSummarySchema);
          listed.items.sort((x, y) => y.updatedAt - x.updatedAt);
          listener.onData(listed);
        },
        (error) => listener.onError?.(error),
      );
    },

    /** Completed-match records for a tournament: the input to standings and leaderboards. */
    watchResults(tournamentId: string, listener: Listener<Listed<MatchResultRecord>>): Unsubscribe {
      const q = query(
        ref(db, paths.matchResults),
        orderByChild('tournamentId'),
        equalTo(tournamentId),
      );
      return onValue(
        q,
        (snap) => listener.onData(parseList(snap.val(), MatchResultRecordSchema)),
        (error) => listener.onError?.(error),
      );
    },
  };
}

export type MatchRepository = ReturnType<typeof createMatchRepository>;

function parseMatch(id: string, raw: unknown): MatchSnapshot {
  if (raw === null || raw === undefined) throw new DataError('not_found', `Match ${id} not found`);
  const value = raw as { meta?: unknown; head?: unknown; events?: unknown };

  const meta = MatchMetaSchema.safeParse(value.meta);
  if (!meta.success) throw invalid(id, 'setup', meta.error);
  const head = typeof value.head === 'number' ? value.head : NaN;

  const bySeq = new Map<number, EventRecord>();
  for (const [key, rawEvent] of entriesOf(value.events)) {
    const seq = Number(key);
    const parsed = EventRecordSchema.safeParse(rawEvent);
    if (!Number.isInteger(seq) || seq < 0 || !parsed.success) {
      throw invalid(id, `event ${key}`, parsed.error);
    }
    bySeq.set(seq, parsed.data);
  }
  const records: EventRecord[] = [];
  for (let seq = 0; seq < head; seq++) {
    const record = bySeq.get(seq);
    if (!record) throw new DataError('invalid_data', `Match ${id} is missing event ${seq}`);
    records.push(record);
  }
  if (bySeq.size !== head) throw new DataError('invalid_data', `Match ${id} has extra events`);

  return {
    id,
    meta: meta.data,
    head,
    records,
    events: records.map(toDomainEvent),
    names: playerNames(meta.data, records),
  };
}

function parseList<T>(
  raw: unknown,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
): Listed<T> {
  const listed: Listed<T> = { items: [], invalid: [] };
  for (const [id, value] of entriesOf(raw)) {
    const parsed = schema.safeParse(value);
    if (parsed.success) listed.items.push({ ...parsed.data, id });
    else listed.invalid.push(id);
  }
  return listed;
}

function invalid(id: string, what: string, cause?: unknown): DataError {
  return new DataError('invalid_data', `Match ${id} has an invalid ${what}`, { cause });
}
