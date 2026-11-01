import { View } from 'react-native';

import { brand, Card, Icon, Text, useTheme } from '@/ui';
import { oversText, resultText, scoreText } from '../format';
import {
  battingText,
  bowlingText,
  completedSummary,
  performerLines,
  performerText,
  topBatters,
  topBowlers,
} from './key-performers';
import type { MatchView } from './match-view';

/** Result, both innings and the standout batters and bowlers of a finished match. */
export function MatchSummaryCard({ view }: { view: MatchView }) {
  const { colors, spacing } = useTheme();
  const match = completedSummary(view.id, view.state);
  if (!match) return null;
  const best = performerLines(match)[0];

  return (
    <Card>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="label" color="textMuted">
            MATCH SUMMARY
          </Text>
          <Text variant="heading" color="primary">
            {resultText(match.result, view.teamName)}
          </Text>
        </View>

        {match.innings.map((inn, i) => (
          <View
            key={i}
            style={{
              gap: spacing.sm,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {view.teamName(inn.battingTeam)}
              </Text>
              <Text variant="heading">{scoreText(inn.runs, inn.wickets)}</Text>
              <Text variant="caption" color="textMuted">
                {oversText(inn.legalBalls)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
              <View style={{ flex: 1, minWidth: 140, gap: spacing.xxs }}>
                <Text variant="caption" color="textMuted">
                  Top batters
                </Text>
                {topBatters(match, inn.battingTeam).map((b) => (
                  <FigureRow
                    key={b.player}
                    name={view.playerName(b.player)}
                    figures={battingText(b)}
                  />
                ))}
              </View>
              <View style={{ flex: 1, minWidth: 140, gap: spacing.xxs }}>
                <Text variant="caption" color="textMuted">
                  Top bowlers ({view.teamName(inn.bowlingTeam)})
                </Text>
                {topBowlers(match, inn.bowlingTeam).map((b) => (
                  <FigureRow
                    key={b.player}
                    name={view.playerName(b.player)}
                    figures={bowlingText(b)}
                  />
                ))}
              </View>
            </View>
          </View>
        ))}

        {best ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: '#FBF8F1',
              borderWidth: 1,
              borderColor: brand.gold,
            }}>
            <Icon name="star" size={22} color={brand.gold} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="textMuted">
                Biggest impact (runs + 20 per wicket)
              </Text>
              <Text variant="bodyStrong">
                {view.playerName(best.player)} · {performerText(best)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function FigureRow({ name, figures }: { name: string; figures: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Text numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </Text>
      <Text variant="bodyStrong">{figures}</Text>
    </View>
  );
}
