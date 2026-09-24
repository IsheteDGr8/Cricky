import { View } from 'react-native';

import { ballBadge, describeBall, overLabel, overSummaries, type InningsState } from '@/domain';
import { BallChip, Card, Text, useTheme } from '@/ui';
import { scoreText } from '../format';
import { ballTone } from './ball-tone';
import type { MatchView } from './match-view';

/** Ball-by-ball commentary, newest first, with a line at the end of each over. */
export function Commentary({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  if (view.innings.length === 0) {
    return <Text color="textMuted">Commentary starts with the first ball.</Text>;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {[...view.innings].reverse().map((inn) => (
        <InningsCommentary key={inn.number} innings={inn} view={view} />
      ))}
    </View>
  );
}

function InningsCommentary({ innings, view }: { innings: InningsState; view: MatchView }) {
  const { colors, spacing } = useTheme();
  const overs = overSummaries(innings).reverse();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textMuted">
        {view.teamName(innings.battingTeam)} innings
      </Text>
      {overs.map((over) => (
        <Card key={over.number}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">
                Over {over.number} · {view.playerName(over.bowler)}
              </Text>
              <Text color="textMuted">
                {over.runs} runs · {scoreText(over.scoreAfter.runs, over.scoreAfter.wickets)}
              </Text>
            </View>
            {[...over.balls].reverse().map((ball, i) => (
              <View
                key={over.balls.length - i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}>
                <Text variant="caption" color="textMuted" style={{ width: 32 }}>
                  {overLabel(ball)}
                </Text>
                <BallChip label={ballBadge(ball)} tone={ballTone(ball)} />
                <Text style={{ flex: 1 }}>{describeBall(ball, view.playerName)}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}
