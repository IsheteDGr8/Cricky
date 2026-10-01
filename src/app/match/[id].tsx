import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  Commentary,
  Loaded,
  OverTimeline,
  ScoreHeader,
  Scorecard,
  ShareButton,
  WormChart,
  useIsStaff,
  useMatch,
  type MatchView,
} from '@/features';
import { Button, SegmentedControl, Screen } from '@/ui';

type Section = 'commentary' | 'scorecard' | 'overs' | 'worm';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'commentary', label: 'Commentary' },
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'overs', label: 'Overs' },
  { value: 'worm', label: 'Worm' },
];

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
  const [section, setSection] = useState<Section>(
    view.state.status === 'complete' ? 'scorecard' : 'commentary',
  );
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
      <ScoreLink id={view.id} />
      <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
      {section === 'commentary' && <Commentary view={view} />}
      {section === 'scorecard' && <Scorecard view={view} />}
      {section === 'overs' && <OverTimeline view={view} />}
      {section === 'worm' && <WormChart view={view} />}
    </>
  );
}

function ScoreLink({ id }: { id: string }) {
  const staff = useIsStaff();
  if (staff.status !== 'ready' || !staff.data) return null;
  return (
    <Button
      label="Score this match"
      variant="secondary"
      onPress={() => router.push({ pathname: '/score/[id]', params: { id } })}
    />
  );
}
