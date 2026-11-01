import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { BrandBar, useTheme } from '@/ui';

function Header() {
  return <BrandBar onAdmin={() => router.push('/admin' as Href)} />;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

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
        options={{ title: 'Tournaments', tabBarIcon: tabIcon('trophy', 'trophy-outline') }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Matches', tabBarIcon: tabIcon('radio', 'radio-outline') }}
      />
      <Tabs.Screen
        name="leaders"
        options={{ title: 'Leaders', tabBarIcon: tabIcon('podium', 'podium-outline') }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: tabIcon('ellipsis-horizontal', 'ellipsis-horizontal'),
        }}
      />
    </Tabs>
  );
}
