import { View } from 'react-native';

import { ballsToOvers, strikeRate } from '@/domain';
import { Badge, brand, Text, useTheme } from '@/ui';
import { oversText, rateText, resultText } from '../format';
import type { MatchView } from './match-view';

const soft = { color: 'rgba(255, 255, 255, 0.75)' };

/** The top of a match page: both scores, the result or chase equation, and who is on. */
export function ScoreHeader({ view }: { view: MatchView }) {
  const { colors, spacing, radius } = useTheme();
  const { state, live, teamName, playerName } = view;

  return (
    <View
      style={{
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.primary,
        experimental_backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${brand.bar})`,
        boxShadow: '0 8px 20px rgba(75, 46, 131, 0.25)',
      }}>
      <View style={{ gap: spacing.md, padding: spacing.lg }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="caption" style={soft}>
            {view.meta.oversPerInnings} overs a side
          </Text>
          {live ? <Badge label="Live" tone="live" /> : null}
        </View>

        {view.innings.length === 0 ? (
          <Text variant="heading" color="onPrimary">
            {teamName(view.meta.teamA)} v {teamName(view.meta.teamB)}
          </Text>
        ) : (
          view.innings.map((inn) => (
            <View
              key={inn.number}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text variant="heading" color="onPrimary" numberOfLines={1} style={{ flex: 1 }}>
                {teamName(inn.battingTeam)}
              </Text>
              <Text
                color="onPrimary"
                style={{
                  fontSize: inn === live?.innings ? 32 : 24,
                  lineHeight: inn === live?.innings ? 36 : 28,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}>
                {inn.runs}/{inn.wickets}
              </Text>
              <Text variant="caption" style={soft}>
                {oversText(inn.legalBalls)}
              </Text>
            </View>
          ))
        )}

        {state.result ? (
          <View
            style={{
              alignSelf: 'center',
              backgroundColor: brand.gold,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xs,
            }}>
            <Text variant="bodyStrong" align="center" style={{ color: brand.bar }}>
              {resultText(state.result, teamName)}
            </Text>
          </View>
        ) : null}

        {live ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={soft}>
              Run rate {rateText(live.runRate)}
              {live.chase ? ` · Required ${rateText(live.chase.requiredRate)}` : ''}
            </Text>
            {live.chase ? (
              <Text variant="bodyStrong" style={{ color: brand.gold }}>
                {teamName(live.innings.battingTeam)} need {live.chase.runsNeeded} from{' '}
                {live.chase.ballsLeft} balls
              </Text>
            ) : null}
            <CurrentPlayers view={view} />
          </View>
        ) : null}
      </View>

      {state.playerOfMatch ? (
        <View
          style={{
            backgroundColor: brand.gold,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}>
          <Text variant="bodyStrong" align="center" style={{ color: brand.bar }}>
            Player of the match: {playerName(state.playerOfMatch)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CurrentPlayers({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  const inn = view.live?.innings;
  if (!inn) return null;
  const batters = [inn.striker, inn.nonStriker].filter((p): p is string => p !== null);
  const bowler = inn.bowler ? inn.bowlers[inn.bowler] : undefined;

  return (
    <View
      style={{
        gap: spacing.xxs,
        marginTop: spacing.xs,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.15)',
      }}>
      {batters.map((p) => {
        const line = inn.batters[p];
        return (
          <Text key={p} color="onPrimary">
            {view.playerName(p)}
            {p === inn.striker ? '*' : ''} {line?.runs ?? 0} ({line?.balls ?? 0})
            <Text variant="caption" style={soft}>
              {line ? `  SR ${rateText(strikeRate(line))}` : ''}
            </Text>
          </Text>
        );
      })}
      {bowler ? (
        <Text style={soft}>
          {view.playerName(bowler.player)} {ballsToOvers(bowler.legalBalls)}-{bowler.maidens}-
          {bowler.runsConceded}-{bowler.wickets}
        </Text>
      ) : null}
    </View>
  );
}
