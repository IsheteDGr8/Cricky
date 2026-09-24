import { View } from 'react-native';

import { ballBadge, overSummaries } from '@/domain';
import { BallChip, Card, Text, useTheme } from '@/ui';
import { scoreText } from '../format';
import { ballTone } from './ball-tone';
import type { MatchView } from './match-view';

/** Every over as a row of balls, per innings. */
export function OverTimeline({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  if (view.innings.length === 0) {
    return <Text color="textMuted">Overs appear once the first ball is bowled.</Text>;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {view.innings.map((inn) => (
        <Card key={inn.number}>
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">{view.teamName(inn.battingTeam)}</Text>
            {overSummaries(inn).map((over) => (
              <View key={over.number} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" color="textMuted">
                    Over {over.number} · {view.playerName(over.bowler)}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {over.runs} · {scoreText(over.scoreAfter.runs, over.scoreAfter.wickets)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {over.balls.map((ball, i) => (
                    <BallChip key={i} label={ballBadge(ball)} tone={ballTone(ball)} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}
