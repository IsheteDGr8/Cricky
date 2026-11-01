import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { brand, maxContentWidth } from '../tokens';
import { Text } from './Text';

export interface BrandBarProps {
  /** Shows the gold ADMIN pill on the right. */
  onAdmin?: () => void;
}

/** The purple club bar from the original site, shown above the main tabs. */
export function BrandBar({ onAdmin }: BrandBarProps) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: brand.bar,
        borderBottomWidth: 3,
        borderBottomColor: brand.barEdge,
        paddingTop: insets.top,
        boxShadow: '0 4px 15px rgba(75, 46, 131, 0.3)',
        zIndex: 1,
      }}>
      <View
        style={{
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <MaterialCommunityIcons
            name="cricket"
            size={26}
            color={brand.gold}
            accessibilityElementsHidden
          />
          <View>
            <Text
              accessibilityRole="header"
              style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '800' }}>
              UWB Cricket Club
            </Text>
            <Text
              style={{
                color: brand.gold,
                fontSize: 10,
                lineHeight: 12,
                fontWeight: '700',
                letterSpacing: 1.5,
              }}>
              CRICKY LIVE SCORES
            </Text>
          </View>
        </View>
        {onAdmin ? (
          <Pressable
            onPress={onAdmin}
            accessibilityRole="button"
            accessibilityLabel="Admin"
            hitSlop={8}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(183, 165, 122, 0.5)',
              backgroundColor: pressed ? 'rgba(183, 165, 122, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            })}>
            <Text
              style={{ color: brand.gold, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
              ADMIN
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
