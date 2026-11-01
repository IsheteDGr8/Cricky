import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  CodeEntry,
  Loaded,
  ScoreHeader,
  ScorePad,
  useAlreadyScorer,
  useIsStaff,
  useMatch,
} from '@/features';
import { LoadingState, Screen } from '@/ui';

export default function ScoreMatchScreen() {
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
  const match = useMatch(id);
  const staff = useIsStaff();
  const already = useAlreadyScorer(id);
  const [redeemed, setRedeemed] = useState(false);
  const onReady = useCallback(() => setRedeemed(true), []);
  const isStaff = staff.status === 'ready' && staff.data;
  const allowed = redeemed || isStaff || already === true;
  const checking = !allowed && (staff.status !== 'ready' || already === null);

  return (
    <Screen>
      <Loaded value={match} loadingLabel="Loading match…">
        {(view) => (
          <>
            <Stack.Screen
              options={{
                title: `${view.teamName(view.meta.teamA)} v ${view.teamName(view.meta.teamB)}`,
              }}
            />
            <ScoreHeader view={view} />
            {allowed ? (
              <ScorePad view={view} />
            ) : checking ? (
              <LoadingState label="Checking scorer access…" />
            ) : (
              <CodeEntry matchId={view.id} initialCode={code} onReady={onReady} />
            )}
          </>
        )}
      </Loaded>
    </Screen>
  );
}
