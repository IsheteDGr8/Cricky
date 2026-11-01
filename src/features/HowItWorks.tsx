import { View } from 'react-native';

import { brand, Card, Icon, Text, useTheme, type IconName } from '@/ui';

const STEPS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'eye-outline',
    title: 'Watch',
    detail: 'Every score is live and public. No account, just open a link.',
  },
  {
    icon: 'create-outline',
    title: 'Score',
    detail: 'Got a scorer link from an admin? Open it and tap runs ball by ball.',
  },
  {
    icon: 'trophy-outline',
    title: 'Run it',
    detail: 'Admins sign in with Google to set up teams, matches and playoffs.',
  },
];

/** Three-line explainer for people opening Cricky for the first time. */
export function HowItWorks() {
  const { colors, spacing, radius } = useTheme();
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">How Cricky works</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          {STEPS.map((s, i) => (
            <View
              key={s.title}
              style={{ flexGrow: 1, flexBasis: 200, flexDirection: 'row', gap: spacing.md }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.pill,
                  backgroundColor: i === 1 ? brand.gold : colors.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name={s.icon} size={18} color={i === 1 ? brand.bar : colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{s.title}</Text>
                <Text variant="caption" color="textMuted">
                  {s.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
