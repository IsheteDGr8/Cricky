import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DataError, isUnavailable } from '@/data';
import type { MatchEvent } from '@/domain';
import { useDataLayer } from '../data-provider';
import { reportError } from '../monitoring';
import type { MatchView } from '../matches/match-view';
import { commitEvent, commitUndo } from './commit';
import { loadQueue, overlayQueue, popQueue, saveQueue, type PendingWrite } from './queue';
import type { SyncStatus } from './SyncBanner';

/** Writes scoring events, queues them when offline, and surfaces a short message if one is rejected. */
export function useScoreActions(view: MatchView) {
  const { matches, watchConnection } = useDataLayer();
  const [connected, setConnected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<PendingWrite[]>([]);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    void loadQueue(view.id).then(setQueue);
  }, [view.id]);

  useEffect(() => {
    return watchConnection({
      onData: (online) => {
        setConnected(online);
        if (online) void flushRef.current();
      },
    });
  }, [watchConnection]);

  const persist = useCallback(
    async (next: PendingWrite[]) => {
      setQueue(next);
      await saveQueue(view.id, next);
    },
    [view.id],
  );

  const shown = useMemo(() => overlayQueue(view, queue), [view, queue]);

  const flush = useCallback(async () => {
    if (!connected || queue.length === 0 || busy || syncing) return;
    setSyncing(true);
    try {
      let cursor = view;
      let remaining = queue;
      while (remaining.length > 0) {
        const [next, ...rest] = remaining;
        if (!next) break;
        await commitEvent(matches, cursor, next.event, next.playerName);
        cursor = overlayQueue(cursor, [next]);
        remaining = rest;
        await persist(remaining);
      }
    } catch (error) {
      if (!isUnavailable(error)) {
        reportError(error);
        setMessage(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSyncing(false);
    }
  }, [busy, connected, matches, persist, queue, syncing, view]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      setMessage(null);
      try {
        await work();
      } catch (error) {
        reportError(error);
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const send = (event: MatchEvent, playerName?: string) =>
    run(async () => {
      if (connected && queue.length > 0) await flush();
      try {
        await commitEvent(matches, shown, event, playerName);
      } catch (error) {
        if (!isUnavailable(error)) throw error;
        await persist([...queue, { event, playerName }]);
      }
    });

  const undo = () =>
    run(async () => {
      if (queue.length > 0) {
        await persist(popQueue(queue));
        return;
      }
      try {
        await commitUndo(matches, shown);
      } catch (error) {
        if (!isUnavailable(error)) throw error;
        setMessage('Undo needs a connection. Try again when you are online.');
      }
    });

  const status: SyncStatus = syncing
    ? 'syncing'
    : !connected && queue.length > 0
      ? 'queued'
      : !connected
        ? 'offline'
        : 'online';

  return {
    view: shown,
    busy,
    message,
    dismiss: () => setMessage(null),
    send,
    undo,
    locked: shown.meta.locked,
    empty: shown.head === 0,
    status,
    queued: queue.length,
  };
}

/** Signs in anonymously and redeems the match's scorer code. */
export function useRedeemCode(matchId: string) {
  const { auth, access } = useDataLayer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const redeem = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      await auth.ensureSignedIn();
      await access.redeemScorerCode(matchId, code);
      setOk(true);
    } catch (caught) {
      const invalid = caught instanceof DataError && caught.code === 'invalid_code';
      setError(invalid ? 'That code is not valid for this match.' : (caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return { redeem, busy, error, ok };
}
