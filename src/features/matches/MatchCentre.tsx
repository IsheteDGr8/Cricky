import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { SegmentedControl, useTheme } from '@/ui';
import { Commentary } from './Commentary';
import type { MatchView } from './match-view';
import { OverTimeline } from './OverTimeline';
import { Scorecard } from './Scorecard';
import { WormChart } from './WormChart';

type BuiltIn = 'commentary' | 'scorecard' | 'overs' | 'worm';
type Section = BuiltIn | 'score';

const CARD: { value: BuiltIn; label: string }[] = [
  { value: 'commentary', label: 'Commentary' },
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'overs', label: 'Overs' },
  { value: 'worm', label: 'Worm' },
];

/** Commentary, scorecard, over-by-over and worm. Pass `score` to add a Score tab in front. */
export function MatchCentre({ view, score }: { view: MatchView; score?: ReactNode }) {
  const { spacing } = useTheme();
  const sections = score
    ? ([{ value: 'score' as const, label: 'Score' }, ...CARD] as {
        value: Section;
        label: string;
      }[])
    : CARD;
  const [section, setSection] = useState<Section>(
    score ? 'score' : view.state.status === 'complete' ? 'scorecard' : 'commentary',
  );
  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl options={sections} value={section} onChange={setSection} />
      {section === 'score' && score}
      {section === 'commentary' && <Commentary view={view} />}
      {section === 'scorecard' && <Scorecard view={view} />}
      {section === 'overs' && <OverTimeline view={view} />}
      {section === 'worm' && <WormChart view={view} />}
    </View>
  );
}
