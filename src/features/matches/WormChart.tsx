import { useState } from 'react';
import { View } from 'react-native';

import { ballsToOvers, wormExtent, type WormPoint } from '@/domain';
import { Card, Text, useTheme } from '@/ui';
import { wormCaption, wormLines } from './worm-view';
import type { MatchView } from './match-view';

const HEIGHT = 168;

/** Cumulative runs vs overs for each innings, overlaid on one pair of axes. */
export function WormChart({ view }: { view: MatchView }) {
  const { colors, spacing } = useTheme();
  const lines = wormLines(view);
  const { maxBalls, maxRuns } = wormExtent(lines.map((line) => line.points));

  if (view.innings.length === 0) {
    return <Text color="textMuted">{wormCaption(view)}</Text>;
  }

  return (
    <Card>
      <View
        accessibilityRole="image"
        accessibilityLabel={wormCaption(view)}
        style={{ gap: spacing.md }}>
        <Text variant="heading">Worm</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {lines.map((line) => (
            <Text key={line.key} variant="caption" color="textMuted">
              <Text color={line.innings === 1 ? 'primary' : 'accent'}>● </Text>
              {line.label} {line.runs} ({ballsToOvers(line.legalBalls)})
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ justifyContent: 'space-between', width: 28 }}>
            <Text variant="caption" color="textMuted">
              {maxRuns}
            </Text>
            <Text variant="caption" color="textMuted">
              0
            </Text>
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Plot
              lines={lines}
              maxBalls={maxBalls}
              maxRuns={maxRuns}
              first={colors.primary}
              second={colors.accent}
              grid={colors.border}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color="textMuted">
                0
              </Text>
              <Text variant="caption" color="textMuted">
                {ballsToOvers(maxBalls)} ov
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

function Plot({
  lines,
  maxBalls,
  maxRuns,
  first,
  second,
  grid,
}: {
  lines: { key: string; innings: 1 | 2; points: WormPoint[] }[];
  maxBalls: number;
  maxRuns: number;
  first: string;
  second: string;
  grid: string;
}) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={{ height: HEIGHT, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: grid }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0
        ? lines.map((line) => (
            <Polyline
              key={line.key}
              points={line.points}
              color={line.innings === 1 ? first : second}
              maxBalls={maxBalls}
              maxRuns={maxRuns}
              width={width}
              height={HEIGHT}
            />
          ))
        : null}
    </View>
  );
}

function Polyline({
  points,
  color,
  maxBalls,
  maxRuns,
  width,
  height,
}: {
  points: WormPoint[];
  color: string;
  maxBalls: number;
  maxRuns: number;
  width: number;
  height: number;
}) {
  const at = (point: WormPoint) => ({
    x: (point.legalBalls / maxBalls) * width,
    y: height - (point.runs / maxRuns) * height,
  });

  return (
    <>
      {points.slice(1).map((point, i) => {
        const from = points[i];
        if (!from) return null;
        const a = at(from);
        const b = at(point);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 0.5) return null;
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`${from.legalBalls}-${from.runs}-${point.legalBalls}-${point.runs}-${i}`}
            style={{
              position: 'absolute',
              left: (a.x + b.x) / 2 - length / 2,
              top: (a.y + b.y) / 2 - 1,
              width: length,
              height: 2,
              backgroundColor: color,
              transform: [{ rotate: `${deg}deg` }],
            }}
          />
        );
      })}
    </>
  );
}
