import { View } from 'react-native';

import { ballsToOvers, strikeRate } from '@/domain';
import { Badge, Card, Text, useTheme } from '@/ui';
import { oversText, rateText, resultText, scoreText } from '../format';
import type { MatchView } from './match-view';

/** The top of a match page: both scores, the result or chase equation, and who is on. */
export function ScoreHeader({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  const { state, live, teamName, playerName } = view;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textMuted">
            {view.meta.oversPerInnings} overs a side
          </Text>
          {live ? <Badge label="Live" tone="live" /> : null}
        </View>

        {view.innings.length === 0 ? (
          <Text variant="heading">
            {teamName(view.meta.teamA)} v {teamName(view.meta.teamB)}
          </Text>
        ) : (
          view.innings.map((inn) => (
            <View
              key={inn.number}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                {teamName(inn.battingTeam)}
              </Text>
              <Text variant={inn === live?.innings ? 'title' : 'heading'}>
                {scoreText(inn.runs, inn.wickets)}
              </Text>
              <Text variant="caption" color="textMuted">
                {oversText(inn.legalBalls)}
              </Text>
            </View>
          ))
        )}

        {state.result ? (
          <Text variant="bodyStrong" color="primary">
            {resultText(state.result, teamName)}
          </Text>
        ) : null}

        {live ? (
          <View style={{ gap: spacing.xs }}>
            <Text color="textMuted">
              Run rate {rateText(live.runRate)}
              {live.chase ? ` · Required ${rateText(live.chase.requiredRate)}` : ''}
            </Text>
            {live.chase ? (
              <Text variant="bodyStrong">
                {teamName(live.innings.battingTeam)} need {live.chase.runsNeeded} from{' '}
                {live.chase.ballsLeft} balls
              </Text>
            ) : null}
            <CurrentPlayers view={view} />
          </View>
        ) : null}

        {state.playerOfMatch ? (
          <Text color="textMuted">Player of the match: {playerName(state.playerOfMatch)}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function CurrentPlayers({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  const inn = view.live?.innings;
  if (!inn) return null;
  const batters = [inn.striker, inn.nonStriker].filter((p): p is string => p !== null);
  const bowler = inn.bowler ? inn.bowlers[inn.bowler] : undefined;

  return (
    <View style={{ gap: spacing.xxs, marginTop: spacing.xs }}>
      {batters.map((p) => {
        const line = inn.batters[p];
        return (
          <Text key={p}>
            {view.playerName(p)}
            {p === inn.striker ? '*' : ''} {line?.runs ?? 0} ({line?.balls ?? 0})
            <Text variant="caption" color="textMuted">
              {line ? `  SR ${rateText(strikeRate(line))}` : ''}
            </Text>
          </Text>
        );
      })}
      {bowler ? (
        <Text color="textMuted">
          {view.playerName(bowler.player)} {ballsToOvers(bowler.legalBalls)}-{bowler.maidens}-
          {bowler.runsConceded}-{bowler.wickets}
        </Text>
      ) : null}
    </View>
  );
}
