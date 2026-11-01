import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import type { MatchSummary, WithId } from '@/data';
import { brand, Hero, onHero, Text, useReducedMotion, useTheme } from '@/ui';
import { oversText } from '../format';

function Pulse() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, scale]);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.live,
          opacity: 0.35,
          transform: [{ scale }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live }} />
    </View>
  );
}

/** A live match, big: both scores and a pulsing LIVE tag. Tapping opens the match. */
export function LiveCard({ match, onPress }: { match: WithId<MatchSummary>; onPress: () => void }) {
  const { spacing, radius } = useTheme();
  const innings = match.innings ?? [];
  const order = [
    { id: match.teamA, name: match.teamAName },
    { id: match.teamB, name: match.teamBName },
  ];
  if (innings[0]?.battingTeam === match.teamB) order.reverse();
  const batting = innings.at(-1)?.battingTeam;
  const first = innings[0];
  const second = innings[1];
  const chase =
    first && second
      ? `${second.battingTeam === match.teamA ? match.teamAName : match.teamBName} need ${Math.max(0, first.runs + 1 - second.runs)}`
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Live: ${match.teamAName} versus ${match.teamBName}`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <Hero>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: radius.pill,
            }}>
            <Pulse />
            <Text variant="label" style={{ color: '#D32F2F', fontWeight: '800' }}>
              Live
            </Text>
          </View>
          <Text variant="caption" style={{ color: onHero.soft }}>
            Tap for ball-by-ball ›
          </Text>
        </View>
        {order.map((t) => {
          const inn = innings.find((i) => i.battingTeam === t.id);
          const on = t.id === batting;
          return (
            <View
              key={t.id}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <View
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text
                  variant="heading"
                  numberOfLines={1}
                  style={{ flexShrink: 1, color: on ? onHero.strong : onHero.soft }}>
                  {t.name}
                </Text>
                {on ? (
                  <MaterialCommunityIcons
                    name="cricket"
                    size={16}
                    color={brand.gold}
                    accessibilityLabel="batting"
                  />
                ) : null}
              </View>
              {inn ? (
                <>
                  <Text
                    style={{
                      color: onHero.strong,
                      fontSize: on ? 34 : 24,
                      lineHeight: on ? 38 : 28,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                    }}>
                    {inn.runs}/{inn.wickets}
                  </Text>
                  <Text variant="caption" style={{ color: onHero.soft }}>
                    {oversText(inn.legalBalls)}
                  </Text>
                </>
              ) : (
                <Text variant="caption" style={{ color: onHero.soft }}>
                  Yet to bat
                </Text>
              )}
            </View>
          );
        })}
        {chase ? (
          <Text variant="bodyStrong" style={{ color: brand.gold }}>
            {chase} to win
          </Text>
        ) : null}
      </Hero>
    </Pressable>
  );
}
