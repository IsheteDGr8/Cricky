import { router } from 'expo-router';
import { View } from 'react-native';

import { Loaded, TournamentCard, useAdminSignIn, useTournaments } from '@/features';
import { Button, Card, Screen, Text, useTheme } from '@/ui';

export default function AdminHomeScreen() {
  const { spacing } = useTheme();
  const { session, staff, signIn, signOut, busy, error } = useAdminSignIn();
  const tournaments = useTournaments();

  return (
    <Screen title="Admin" subtitle="Tournaments, teams, matches and scorer codes.">
      <Card>
        <View style={{ gap: spacing.sm }}>
          {session.status === 'ready' && session.data && !session.data.isAnonymous ? (
            <Text>
              Signed in{staff ? ' as admin' : ''}.{' '}
              {staff ? '' : 'This account is not an admin yet.'}
            </Text>
          ) : (
            <Text color="textMuted">
              Admins sign in with Google on the website. Viewers never need an account.
            </Text>
          )}
          {error ? <Text color="danger">{error}</Text> : null}
          {staff ? (
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
          ) : (
            <Button label="Sign in with Google" loading={busy} onPress={() => void signIn()} />
          )}
        </View>
      </Card>

      {staff ? (
        <>
          <Button label="New tournament" onPress={() => router.push('/admin/tournament/new')} />
          <Button
            label="Quick match"
            variant="secondary"
            onPress={() => router.push('/admin/match/quick')}
          />
          <Loaded value={tournaments} loadingLabel="Loading tournaments…">
            {(list) => (
              <View style={{ gap: spacing.md }}>
                {list.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onPress={() =>
                      router.push({ pathname: '/admin/tournament/[id]', params: { id: t.id } })
                    }
                  />
                ))}
              </View>
            )}
          </Loaded>
        </>
      ) : null}
    </Screen>
  );
}
