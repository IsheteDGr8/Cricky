import { useCallback, useState } from 'react';

import { DataError } from '@/data';
import type { MatchEvent } from '@/domain';
import { useDataLayer } from '../data-provider';
import type { MatchView } from '../matches/match-view';
import { commitEvent, commitUndo } from './commit';

/** Writes scoring events and surfaces a short message if one is rejected. */
export function useScoreActions(view: MatchView) {
  const { matches } = useDataLayer();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      setMessage(null);
      try {
        await work();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return {
    busy,
    message,
    dismiss: () => setMessage(null),
    send: (event: MatchEvent, playerName?: string) =>
      run(() => commitEvent(matches, view, event, playerName)),
    undo: () => run(() => commitUndo(matches, view)),
    locked: view.meta.locked,
    empty: view.head === 0,
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
