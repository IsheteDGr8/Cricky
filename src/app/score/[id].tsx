import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CodeEntry, Loaded, ScoreHeader, ScorePad, useIsStaff, useMatch } from '@/features';
import { Screen } from '@/ui';

export default function ScoreMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useMatch(id);
  const staff = useIsStaff();
  const [redeemed, setRedeemed] = useState(false);
  const allowed = redeemed || (staff.status === 'ready' && staff.data);

  return (
    <Screen edges={[]}>
      <Loaded value={match} loadingLabel="Loading match…">
        {(view) => (
          <>
            <Stack.Screen
              options={{
                title: `Score · ${view.teamName(view.meta.teamA)} v ${view.teamName(view.meta.teamB)}`,
              }}
            />
            <ScoreHeader view={view} />
            {allowed ? (
              <ScorePad view={view} />
            ) : (
              <CodeEntry matchId={view.id} onReady={() => setRedeemed(true)} />
            )}
          </>
        )}
      </Loaded>
    </Screen>
  );
}
