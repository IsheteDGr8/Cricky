import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs, type Href } from 'expo-router';
import { View, type ColorValue } from 'react-native';

import { useIsStaff } from '@/features';
import { brand, BrandBar, useTheme, type IconName } from '@/ui';

function Header() {
  const staff = useIsStaff();
  const isStaff = staff.status === 'ready' && staff.data;
  return <BrandBar onAdmin={isStaff ? () => router.push('/more' as Href) : undefined} />;
}

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({
    color,
    focused,
    size,
  }: {
    color: ColorValue;
    focused: boolean;
    size: number;
  }) {
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  }
  return TabIcon;
}

/** The raised gold button in the middle of the tab bar. */
function ScoreIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 48,
        height: 48,
        transform: [{ translateY: -22 }],
        borderRadius: 24,
        backgroundColor: focused ? brand.bar : brand.gold,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 14px rgba(42, 21, 79, 0.35)',
      }}>
      <Ionicons name="create" size={24} color={focused ? brand.gold : brand.bar} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        header: Header,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#999999',
        tabBarLabelStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Matches', tabBarIcon: tabIcon('radio', 'radio-outline') }}
      />
      <Tabs.Screen
        name="score"
        options={{
          title: 'Score',
          tabBarIcon: ScoreIcon,
          tabBarActiveTintColor: brand.bar,
          tabBarAccessibilityLabel: 'Score a match',
        }}
      />
      <Tabs.Screen
        name="leaders"
        options={{ title: 'Stats', tabBarIcon: tabIcon('podium', 'podium-outline') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'You', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }}
      />
    </Tabs>
  );
}
