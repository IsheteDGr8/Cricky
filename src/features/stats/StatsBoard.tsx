import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ballsToOvers, type BattingLeader, type BowlingLeader } from '@/domain';
import {
  brand,
  Card,
  Chip,
  DataTable,
  EmptyState,
  Field,
  Hero,
  Icon,
  onHero,
  Section,
  SegmentedControl,
  Text,
  useTheme,
  type DataColumn,
  type IconName,
} from '@/ui';
import { rateText } from '../format';
import type { StatsView } from './build-stats';

type BatSort = 'runs' | 'average' | 'strikeRate' | 'sixes';
type BowlSort = 'wickets' | 'economy' | 'average';

/** Rates mean little from a handful of balls, so they need a minimum to qualify. */
const MIN_BALLS_FOR_STRIKE_RATE = 30;
const MIN_BALLS_FOR_ECONOMY = 24;
const MIN_WICKETS_FOR_AVERAGE = 3;
const MIN_INNINGS_FOR_AVERAGE = 2;

const BAT_SORTS: { value: BatSort; label: string; note?: string }[] = [
  { value: 'runs', label: 'Runs' },
  {
    value: 'average',
    label: 'Average',
    note: `Batters with ${MIN_INNINGS_FOR_AVERAGE}+ innings and at least one dismissal.`,
  },
  {
    value: 'strikeRate',
    label: 'Strike rate',
    note: `Batters who faced ${MIN_BALLS_FOR_STRIKE_RATE}+ balls.`,
  },
  { value: 'sixes', label: 'Sixes' },
];

const BOWL_SORTS: { value: BowlSort; label: string; note?: string }[] = [
  { value: 'wickets', label: 'Wickets' },
  {
    value: 'economy',
    label: 'Economy',
    note: `Bowlers with ${MIN_BALLS_FOR_ECONOMY / 6}+ overs.`,
  },
  {
    value: 'average',
    label: 'Average',
    note: `Bowlers with ${MIN_WICKETS_FOR_AVERAGE}+ wickets.`,
  },
];

const BATTING: DataColumn[] = [
  { label: 'Batter' },
  { label: 'Inn', width: 32 },
  { label: 'Runs', width: 44 },
  { label: 'Avg', width: 44 },
  { label: 'SR', width: 52 },
  { label: '6s', width: 32 },
];

const BOWLING: DataColumn[] = [
  { label: 'Bowler' },
  { label: 'O', width: 40 },
  { label: 'Wkts', width: 44 },
  { label: 'Econ', width: 48 },
  { label: 'Avg', width: 44 },
  { label: 'Best', width: 44 },
];

function sortBatting(rows: BattingLeader[], by: BatSort): BattingLeader[] {
  switch (by) {
    case 'runs':
      return rows;
    case 'sixes':
      return rows.filter((r) => r.sixes > 0).sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
    case 'average':
      return rows
        .filter((r) => r.average !== null && r.innings >= MIN_INNINGS_FOR_AVERAGE)
        .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    case 'strikeRate':
      return rows
        .filter((r) => r.balls >= MIN_BALLS_FOR_STRIKE_RATE)
        .sort((a, b) => b.strikeRate - a.strikeRate);
  }
}

function sortBowling(rows: BowlingLeader[], by: BowlSort): BowlingLeader[] {
  switch (by) {
    case 'wickets':
      return rows;
    case 'economy':
      return rows
        .filter((r) => r.legalBalls >= MIN_BALLS_FOR_ECONOMY)
        .sort((a, b) => a.economy - b.economy);
    case 'average':
      return rows
        .filter((r) => r.average !== null && r.wickets >= MIN_WICKETS_FOR_AVERAGE)
        .sort((a, b) => (a.average ?? 0) - (b.average ?? 0));
  }
}

/** Totals, a record book and sortable leaderboards for one set of matches. */
export function StatsBoard({ stats }: { stats: StatsView }) {
  const { spacing } = useTheme();
  if (stats.matches === 0) {
    return (
      <EmptyState
        icon="podium-outline"
        title="No completed matches here yet"
        message="Stats appear as soon as a match in this group is finished."
      />
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <Totals stats={stats} />
      <Records stats={stats} />
      <Leaderboards stats={stats} />
    </View>
  );
}

function Totals({ stats }: { stats: StatsView }) {
  const { spacing } = useTheme();
  const items = [
    { value: stats.matches, label: stats.matches === 1 ? 'match' : 'matches' },
    { value: stats.totals.runs, label: 'runs' },
    { value: stats.totals.wickets, label: 'wickets' },
    { value: stats.totals.sixes, label: 'sixes' },
    { value: stats.totals.fours, label: 'fours' },
  ];
  return (
    <Hero>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl }}>
        {items.map((item) => (
          <View key={item.label}>
            <Text style={{ color: onHero.strong, fontSize: 26, fontWeight: '800' }}>
              {item.value}
            </Text>
            <Text variant="caption" style={{ color: onHero.soft }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </Hero>
  );
}

interface RecordTile {
  key: string;
  icon: IconName;
  title: string;
  value: string;
  who: string;
}

function Records({ stats }: { stats: StatsView }) {
  const { spacing } = useTheme();
  const { playerName, teamName } = stats;
  const tiles: RecordTile[] = [];
  const runs = stats.batting[0];
  if (runs) {
    tiles.push({
      key: 'runs',
      icon: 'flame',
      title: 'Most runs',
      value: String(runs.runs),
      who: playerName(runs.player),
    });
  }
  const wickets = stats.bowling[0];
  if (wickets && wickets.wickets > 0) {
    tiles.push({
      key: 'wickets',
      icon: 'flash',
      title: 'Most wickets',
      value: String(wickets.wickets),
      who: playerName(wickets.player),
    });
  }
  if (stats.highestScore) {
    const h = stats.highestScore;
    tiles.push({
      key: 'hs',
      icon: 'trending-up',
      title: 'Highest score',
      value: `${h.runs}${h.notOut ? '*' : ''} (${h.balls})`,
      who: playerName(h.player),
    });
  }
  if (stats.bestBowling && stats.bestBowling.wickets > 0) {
    const b = stats.bestBowling;
    tiles.push({
      key: 'bb',
      icon: 'baseball',
      title: 'Best bowling',
      value: `${b.wickets}/${b.runs}`,
      who: playerName(b.player),
    });
  }
  const sixes = sortBatting(stats.batting, 'sixes')[0];
  if (sixes) {
    tiles.push({
      key: 'sixes',
      icon: 'rocket',
      title: 'Most sixes',
      value: String(sixes.sixes),
      who: playerName(sixes.player),
    });
  }
  const strike = sortBatting(stats.batting, 'strikeRate')[0];
  if (strike) {
    tiles.push({
      key: 'sr',
      icon: 'speedometer',
      title: 'Best strike rate',
      value: rateText(strike.strikeRate),
      who: playerName(strike.player),
    });
  }
  const economy = sortBowling(stats.bowling, 'economy')[0];
  if (economy) {
    tiles.push({
      key: 'econ',
      icon: 'lock-closed',
      title: 'Best economy',
      value: rateText(economy.economy),
      who: playerName(economy.player),
    });
  }
  const potm = stats.playerOfMatch[0];
  if (potm) {
    tiles.push({
      key: 'potm',
      icon: 'star',
      title: 'Most Player of the Match',
      value: `${potm.count}×`,
      who: playerName(potm.player),
    });
  }
  if (stats.highestTotal) {
    const t = stats.highestTotal;
    tiles.push({
      key: 'total',
      icon: 'trophy',
      title: 'Highest team total',
      value: `${t.runs}/${t.wickets}`,
      who: teamName(t.team),
    });
  }

  return (
    <Section title="RECORD BOOK">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {tiles.map((tile) => (
          <RecordCard key={tile.key} tile={tile} />
        ))}
      </View>
    </Section>
  );
}

function RecordCard({ tile }: { tile: RecordTile }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${tile.title}: ${tile.value}, ${tile.who}`}
      style={{
        flexGrow: 1,
        flexBasis: 150,
        gap: spacing.xxs,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name={tile.icon} size={14} color={brand.gold} />
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {tile.title}
        </Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary }}>{tile.value}</Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {tile.who}
      </Text>
    </View>
  );
}

function Leaderboards({ stats }: { stats: StatsView }) {
  const { spacing } = useTheme();
  const [kind, setKind] = useState<'batting' | 'bowling'>('batting');
  const [batSort, setBatSort] = useState<BatSort>('runs');
  const [bowlSort, setBowlSort] = useState<BowlSort>('wickets');
  const [search, setSearch] = useState('');
  const { playerName, teamName, appearances } = stats;
  const needle = search.trim().toLowerCase();
  const matchesSearch = (player: string) =>
    !needle || playerName(player).toLowerCase().includes(needle);
  const detail = (player: string, team: string) => {
    const n = appearances.get(player) ?? 0;
    return `${teamName(team)} · ${n} ${n === 1 ? 'match' : 'matches'}`;
  };

  const batting = useMemo(() => sortBatting(stats.batting, batSort), [stats.batting, batSort]);
  const bowling = useMemo(() => sortBowling(stats.bowling, bowlSort), [stats.bowling, bowlSort]);
  const sorts = kind === 'batting' ? BAT_SORTS : BOWL_SORTS;
  const sort = kind === 'batting' ? batSort : bowlSort;
  const note = sorts.find((s) => s.value === sort)?.note;
  const batRows = batting.filter((b) => matchesSearch(b.player)).slice(0, 25);
  const bowlRows = bowling.filter((b) => matchesSearch(b.player)).slice(0, 25);

  return (
    <Section title="LEADERBOARDS">
      <Card>
        <View style={{ gap: spacing.md }}>
          <SegmentedControl
            options={[
              { value: 'batting', label: 'Batting' },
              { value: 'bowling', label: 'Bowling' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {sorts.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                selected={s.value === sort}
                onPress={() =>
                  kind === 'batting'
                    ? setBatSort(s.value as BatSort)
                    : setBowlSort(s.value as BowlSort)
                }
              />
            ))}
          </View>
          {note ? (
            <Text variant="caption" color="textMuted">
              {note}
            </Text>
          ) : null}
          <Field
            label="Find a player"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            placeholder="Type a name"
          />
          {kind === 'batting' ? (
            batRows.length ? (
              <DataTable
                accessibilityLabel="Batting leaderboard"
                columns={BATTING}
                rows={batRows.map((b) => ({
                  key: b.player,
                  cells: [
                    playerName(b.player),
                    b.innings,
                    b.runs,
                    b.average === null ? '–' : b.average.toFixed(1),
                    rateText(b.strikeRate),
                    b.sixes,
                  ],
                  detail: detail(b.player, b.team),
                }))}
              />
            ) : (
              <Text color="textMuted">Nobody qualifies yet.</Text>
            )
          ) : bowlRows.length ? (
            <DataTable
              accessibilityLabel="Bowling leaderboard"
              columns={BOWLING}
              rows={bowlRows.map((b) => ({
                key: b.player,
                cells: [
                  playerName(b.player),
                  ballsToOvers(b.legalBalls),
                  b.wickets,
                  rateText(b.economy),
                  b.average === null ? '–' : b.average.toFixed(1),
                  `${b.best.wickets}/${b.best.runs}`,
                ],
                detail: detail(b.player, b.team),
              }))}
            />
          ) : (
            <Text color="textMuted">Nobody qualifies yet.</Text>
          )}
        </View>
      </Card>
    </Section>
  );
}
