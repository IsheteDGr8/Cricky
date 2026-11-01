import { router, Stack, useLocalSearchParams } from 'expo-router';

import {
  Loaded,
  MatchCentre,
  MatchSummaryCard,
  ScoreHeader,
  ShareButton,
  useIsStaff,
  useMatch,
  type MatchView,
} from '@/features';
import { Button, Icon, Screen, useTheme } from '@/ui';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useMatch(id);

  return (
    <Screen edges={[]}>
      <Loaded value={match} loadingLabel="Loading match…">
        {(view) => <MatchPage view={view} />}
      </Loaded>
    </Screen>
  );
}

function MatchPage({ view }: { view: MatchView }) {
  const title = `${view.teamName(view.meta.teamA)} v ${view.teamName(view.meta.teamB)}`;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => <ShareButton path={`/match/${view.id}`} title={title} />,
        }}
      />
      <ScoreHeader view={view} />
      <ScoreLink view={view} />
      <MatchSummaryCard view={view} />
      <MatchCentre view={view} />
    </>
  );
}

/** Admins score straight away; anyone else is asked for the scorer link or code. */
function ScoreLink({ view }: { view: MatchView }) {
  const { colors } = useTheme();
  const staff = useIsStaff();
  const isStaff = staff.status === 'ready' && staff.data;
  const finished =
    view.meta.locked || (view.state.status === 'complete' && Boolean(view.state.playerOfMatch));
  if (!isStaff && finished) return null;
  return (
    <Button
      label={isStaff ? 'Score this match' : "I'm the scorer"}
      variant="secondary"
      icon={<Icon name="create-outline" size={18} color={colors.text} />}
      onPress={() => router.push({ pathname: '/score/[id]', params: { id: view.id } })}
    />
  );
}
