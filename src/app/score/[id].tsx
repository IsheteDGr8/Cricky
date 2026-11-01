import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import {
  CodeEntry,
  Loaded,
  MatchCentre,
  ScoreHeader,
  ScorePad,
  ScorerCodePanel,
  useAlreadyScorer,
  useIsStaff,
  useMatch,
  type MatchView,
} from '@/features';
import { brand, Icon, LoadingState, Screen, Text, useTheme } from '@/ui';

type Access = 'admin' | 'scorer';

export default function ScoreMatchScreen() {
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
  const match = useMatch(id);
  const staff = useIsStaff();
  const already = useAlreadyScorer(id);
  const [redeemed, setRedeemed] = useState(false);
  const onReady = useCallback(() => setRedeemed(true), []);
  const isStaff = staff.status === 'ready' && staff.data;
  const access: Access | null = isStaff ? 'admin' : redeemed || already === true ? 'scorer' : null;
  const checking = !access && (staff.status !== 'ready' || already === null);

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
            {access ? (
              <MatchCentre
                view={view}
                score={
                  <>
                    <AccessBadge access={access} />
                    {access === 'admin' ? <ShareScoring view={view} /> : null}
                    <ScorePad view={view} />
                  </>
                }
              />
            ) : checking ? (
              <>
                <LoadingState label="Checking scorer access…" />
                <MatchCentre view={view} />
              </>
            ) : (
              <>
                <CodeEntry matchId={view.id} initialCode={code} onReady={onReady} />
                <MatchCentre view={view} />
              </>
            )}
          </>
        )}
      </Loaded>
    </Screen>
  );
}

function AccessBadge({ access }: { access: Access }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: 999,
          backgroundColor: access === 'admin' ? brand.bar : colors.primaryMuted,
        }}>
        <Icon
          name={access === 'admin' ? 'shield-checkmark' : 'create'}
          size={14}
          color={access === 'admin' ? brand.gold : colors.primary}
        />
        <Text
          variant="label"
          style={{ color: access === 'admin' ? brand.gold : colors.primary, fontWeight: '800' }}>
          {access === 'admin' ? 'SCORING AS ADMIN' : 'SCORING AS SCORER'}
        </Text>
      </View>
    </View>
  );
}

function ShareScoring({ view }: { view: MatchView }) {
  const title = `${view.teamName(view.meta.teamA)} v ${view.teamName(view.meta.teamB)}`;
  return <ScorerCodePanel matchId={view.id} title={title} compact />;
}
