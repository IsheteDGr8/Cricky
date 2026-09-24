import { View } from 'react-native';

import {
  ballsToOvers,
  describeDismissal,
  economy,
  strikeRate,
  type BatterLine,
  type InningsState,
} from '@/domain';
import { Card, DataTable, Text, useTheme, type DataColumn } from '@/ui';
import { oversText, rateText, scoreText } from '../format';
import type { MatchView } from './match-view';

const BATTING: DataColumn[] = [
  { label: 'Batter' },
  { label: 'R', width: 36 },
  { label: 'B', width: 36 },
  { label: '4s', width: 30 },
  { label: '6s', width: 30 },
  { label: 'SR', width: 56 },
];

const BOWLING: DataColumn[] = [
  { label: 'Bowler' },
  { label: 'O', width: 40 },
  { label: 'M', width: 30 },
  { label: 'R', width: 36 },
  { label: 'W', width: 30 },
  { label: 'Econ', width: 56 },
];

/** Full batting and bowling card for every innings played so far. */
export function Scorecard({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  if (view.innings.length === 0) {
    return <Text color="textMuted">The scorecard appears once the first ball is bowled.</Text>;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {view.innings.map((inn) => (
        <InningsCard key={inn.number} innings={inn} view={view} />
      ))}
    </View>
  );
}

function InningsCard({ innings: inn, view }: { innings: InningsState; view: MatchView }) {
  const { spacing } = useTheme();
  const name = view.playerName;
  const status = (line: BatterLine) => {
    if (line.dismissal) return describeDismissal(line.dismissal, name);
    if (line.retiredHurt) return 'retired hurt';
    return 'not out';
  };
  const didNotBat = (view.state.squads[inn.battingTeam] ?? []).filter(
    (p) => !inn.battingOrder.includes(p),
  );
  const { wides, noBalls, byes, legByes } = inn.extras;
  const extras = wides + noBalls + byes + legByes;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="heading">{view.teamName(inn.battingTeam)}</Text>
          <Text variant="heading">
            {scoreText(inn.runs, inn.wickets)}{' '}
            <Text variant="caption" color="textMuted">
              {oversText(inn.legalBalls)}
            </Text>
          </Text>
        </View>

        <DataTable
          accessibilityLabel={`${view.teamName(inn.battingTeam)} batting`}
          columns={BATTING}
          rows={inn.battingOrder.map((p) => {
            const line = inn.batters[p];
            return {
              key: p,
              cells: line
                ? [
                    name(p),
                    line.runs,
                    line.balls,
                    line.fours,
                    line.sixes,
                    rateText(strikeRate(line)),
                  ]
                : [name(p), 0, 0, 0, 0, '–'],
              detail: line ? status(line) : undefined,
              emphasis: !line?.dismissal && (p === inn.striker || p === inn.nonStriker),
            };
          })}
        />

        <Text color="textMuted">
          Extras {extras} (wd {wides}, nb {noBalls}, b {byes}, lb {legByes})
        </Text>
        {didNotBat.length ? (
          <Text color="textMuted">Did not bat: {didNotBat.map(name).join(', ')}</Text>
        ) : null}
        {inn.fallOfWickets.length ? (
          <Text color="textMuted">
            Fall of wickets:{' '}
            {inn.fallOfWickets
              .map(
                (f) => `${f.runs}-${f.wicket} (${name(f.player)}, ${ballsToOvers(f.legalBalls)})`,
              )
              .join(', ')}
          </Text>
        ) : null}

        <DataTable
          accessibilityLabel={`${view.teamName(inn.bowlingTeam)} bowling`}
          columns={BOWLING}
          rows={inn.bowlingOrder.map((p) => {
            const line = inn.bowlers[p];
            return {
              key: p,
              cells: line
                ? [
                    name(p),
                    ballsToOvers(line.legalBalls),
                    line.maidens,
                    line.runsConceded,
                    line.wickets,
                    rateText(economy(line)),
                  ]
                : [name(p), '0.0', 0, 0, 0, '–'],
              emphasis: p === inn.bowler && view.live?.innings === inn,
            };
          })}
        />
      </View>
    </Card>
  );
}
