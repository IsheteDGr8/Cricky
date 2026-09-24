import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export interface DataColumn {
  label: string;
  /** Fixed width for numbers; leave out for the one flexible (name) column. */
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface DataRow {
  key: string;
  cells: readonly (string | number)[];
  /** A smaller line under the first cell, e.g. how a batter got out. */
  detail?: string;
  emphasis?: boolean;
  onPress?: () => void;
}

export interface DataTableProps {
  columns: readonly DataColumn[];
  rows: readonly DataRow[];
  accessibilityLabel?: string;
}

/** Compact table for scorecards, standings and leaderboards. */
export function DataTable({ columns, rows, accessibilityLabel }: DataTableProps) {
  const { colors, spacing } = useTheme();

  const size = (column: DataColumn | undefined) =>
    column?.width === undefined ? { flex: 1 } : { width: column.width };
  const align = (column: DataColumn | undefined) =>
    column?.align ?? (column?.width === undefined ? 'left' : 'right');

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <View style={[styles.row, { paddingVertical: spacing.sm, gap: spacing.sm }]}>
        {columns.map((column) => (
          <Text
            key={column.label}
            variant="label"
            color="textMuted"
            align={align(column)}
            style={size(column)}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row) => {
        const content = (
          <View
            style={[
              styles.row,
              {
                paddingVertical: spacing.sm,
                gap: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}>
            {row.cells.map((cell, i) => {
              const column = columns[i];
              return (
                <View key={i} style={size(column)}>
                  <Text
                    variant={row.emphasis ? 'bodyStrong' : 'body'}
                    align={align(column)}
                    style={{ fontVariant: ['tabular-nums'] }}
                    numberOfLines={i === 0 ? 2 : 1}>
                    {cell}
                  </Text>
                  {i === 0 && row.detail ? (
                    <Text variant="caption" color="textMuted" numberOfLines={2}>
                      {row.detail}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
        return row.onPress ? (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="button"
            style={({ pressed }) => pressed && { backgroundColor: colors.surfaceMuted }}>
            {content}
          </Pressable>
        ) : (
          <View key={row.key}>{content}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
