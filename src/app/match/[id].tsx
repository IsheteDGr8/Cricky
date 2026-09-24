import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  Commentary,
  Loaded,
  OverTimeline,
  ScoreHeader,
  Scorecard,
  ShareButton,
  useMatch,
  type MatchView,
} from '@/features';
import { SegmentedControl, Screen } from '@/ui';

type Section = 'commentary' | 'scorecard' | 'overs';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'commentary', label: 'Commentary' },
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'overs', label: 'Overs' },
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
      <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
      {section === 'commentary' && <Commentary view={view} />}
      {section === 'scorecard' && <Scorecard view={view} />}
      {section === 'overs' && <OverTimeline view={view} />}
    </>
  );
}
