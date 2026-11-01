import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import {
  AdminHub,
  confirmAction,
  copyText,
  HowItWorks,
  useAdminSignIn,
  useDataLayer,
  type Session,
} from '@/features';
import {
  brand,
  Button,
  Card,
  Hero,
  Icon,
  LoadingState,
  onHero,
  Screen,
  Section,
  Text,
  useTheme,
} from '@/ui';

export default function YouScreen() {
  const { spacing } = useTheme();
  const { session, staff } = useAdminSignIn();
  const signedIn = session.status === 'ready' ? session.data : null;

  return (
    <Screen>
      {session.status !== 'ready' ? (
        <LoadingState label="Checking sign-in…" />
      ) : staff && signedIn ? (
        <AdminHub session={signedIn} />
      ) : (
        <SignInCard session={signedIn} />
      )}
      {!staff ? <HowItWorks /> : null}
      <Settings session={signedIn} />
      <View style={{ height: spacing.lg }} />
    </Screen>
  );
}

function SignInCard({ session }: { session: Session | null }) {
  const { spacing, fonts } = useTheme();
  const { signIn, busy, error } = useAdminSignIn();
  const google = session && !session.isAnonymous;

  if (google) {
    return (
      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="heading">You are signed in, but not an admin yet</Text>
          <Text color="textMuted">
            Send this ID to the club owner so they can add you. Then reload.
          </Text>
          <Text selectable variant="bodyStrong" style={{ fontFamily: fonts.mono }}>
            {session.uid}
          </Text>
          <Button
            label="Copy my ID"
            variant="secondary"
            onPress={() => void copyText(session.uid)}
          />
        </View>
      </Card>
    );
  }

  return (
    <Hero>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="trophy" size={22} color={brand.gold} />
        <Text variant="title" style={{ color: onHero.strong }}>
          Running a tournament?
        </Text>
      </View>
      <Text style={{ color: onHero.soft }}>
        Admins sign in with Google to set up teams, start matches and hand out scorer codes.
        Watching and scoring never need an account.
      </Text>
      {error ? (
        <Text variant="bodyStrong" style={{ color: '#FFB4B4' }}>
          {error}
        </Text>
      ) : null}
      <Button
        label="Sign in with Google"
        variant="gold"
        size="lg"
        loading={busy}
        icon={<Icon name="logo-google" size={18} color={brand.bar} />}
        onPress={() => void signIn()}
      />
    </Hero>
  );
}

function Settings({ session }: { session: Session | null }) {
  const { spacing } = useTheme();
  const { auth } = useDataLayer();
  const version = Constants.expoConfig?.version ?? 'dev';
  const google = session && !session.isAnonymous;

  return (
    <Section title="SETTINGS">
      <Card>
        <View style={{ gap: spacing.xxs }}>
          <Row
            icon="shield-checkmark-outline"
            label="Privacy policy"
            onPress={() => router.push('/privacy' as Href)}
          />
          {google ? (
            <Row icon="log-out-outline" label="Sign out" onPress={() => void auth.signOut()} />
          ) : null}
          {session ? (
            <Row
              icon="trash-outline"
              label="Delete my account"
              danger
              onPress={() => {
                void (async () => {
                  if (
                    await confirmAction(
                      'Delete account',
                      'This removes your sign-in. Scores you already entered stay on the card.',
                    )
                  ) {
                    await auth.deleteAccount();
                  }
                })();
              }}
            />
          ) : null}
          <Text variant="caption" color="textMuted" style={{ paddingTop: spacing.sm }}>
            Cricky {version} · Every match and tournament has its own link. Use Share on its page.
          </Text>
        </View>
      </Card>
    </Section>
  );
}

function Row({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: 'shield-checkmark-outline' | 'log-out-outline' | 'trash-outline';
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors, spacing, radius } = useTheme();
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 48,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}>
      <Icon name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text variant="bodyStrong" style={{ color: tint, flex: 1 }}>
        {label}
      </Text>
      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}
