import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import type { Session, Tournament, WithId } from '@/data';
import { brand, Button, Card, Hero, Icon, onHero, Section, Text, Tile, useTheme } from '@/ui';
import { Loaded } from '../Loaded';
import { useRecentMatches } from '../matches/hooks';
import { useTournament, useTournaments } from '../tournaments/hooks';
import { nextStep } from './next-step';
import { ScorerCodePanel } from './ScorerCodePanel';

function firstName(session: Session): string {
  const name = session.displayName?.trim() || session.email?.split('@')[0] || 'captain';
  return name.split(/\s+/)[0] ?? name;
}

/** What a signed-in admin sees first: shortcuts, live matches, and each tournament's next step. */
export function AdminHub({ session }: { session: Session }) {
  const { spacing } = useTheme();
  const tournaments = useTournaments();
  const recent = useRecentMatches(40);
  const liveCount = recent.status === 'ready' ? recent.data.live.length : 0;

  return (
    <View style={{ gap: spacing.xl }}>
      <Hero>
        <Text variant="caption" style={{ color: brand.gold, fontWeight: '800', letterSpacing: 1 }}>
          {session.role === 'owner' ? 'OWNER' : 'ADMIN'} · {session.email ?? 'signed in'}
        </Text>
        <Text variant="title" style={{ color: onHero.strong }}>
          Hey {firstName(session)}, ready for match day?
        </Text>
        <Text style={{ color: onHero.soft }}>
          {liveCount > 0
            ? `${liveCount} match${liveCount === 1 ? ' is' : 'es are'} live right now.`
            : 'Nothing live. Start a match or set up a tournament.'}
        </Text>
      </Hero>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Tile
          icon="trophy"
          tone="primary"
          title="New tournament"
          subtitle="Teams, groups, playoffs"
          onPress={() => router.push('/admin/tournament/new')}
        />
        <Tile
          icon="flash"
          tone="gold"
          title="Quick match"
          subtitle="Two teams, one game"
          onPress={() => router.push('/admin/match/quick')}
        />
        <Tile
          icon="create-outline"
          title="Score a match"
          subtitle="Pick any live game"
          onPress={() => router.push('/score' as Href)}
        />
      </View>

      <Loaded value={recent} loadingLabel="Loading matches…">
        {(lists) =>
          lists.live.length ? (
            <Section title="LIVE NOW">
              {lists.live.map((m) => {
                const title = `${m.teamAName} v ${m.teamBName}`;
                return (
                  <Card key={m.id}>
                    <View style={{ gap: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text variant="heading" style={{ flex: 1 }}>
                          {title}
                        </Text>
                        <Button
                          label="Score"
                          onPress={() =>
                            router.push({ pathname: '/score/[id]', params: { id: m.id } })
                          }
                        />
                      </View>
                      <ScorerCodePanel matchId={m.id} title={title} compact />
                    </View>
                  </Card>
                );
              })}
            </Section>
          ) : null
        }
      </Loaded>

      <Loaded value={tournaments} loadingLabel="Loading tournaments…">
        {(list) => {
          const active = list.filter((t) => t.status !== 'archived');
          return (
            <Section title="YOUR TOURNAMENTS">
              {active.length === 0 ? (
                <Card>
                  <Text color="textMuted">
                    No tournaments yet. Create one and Cricky walks you through teams, fixtures and
                    playoffs.
                  </Text>
                </Card>
              ) : (
                active.map((t) => <TournamentRow key={t.id} tournament={t} />)
              )}
            </Section>
          );
        }}
      </Loaded>
    </View>
  );
}

function TournamentRow({ tournament }: { tournament: WithId<Tournament> }) {
  const { colors, spacing } = useTheme();
  const view = useTournament(tournament.id);
  const step = view.status === 'ready' ? nextStep(view.data) : null;
  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/admin/tournament/[id]', params: { id: tournament.id } })
      }
      accessibilityLabel={`${tournament.name}${step ? `. Next: ${step.title}` : ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="heading" color="primary">
            {tournament.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon
              name={step?.key === 'done' ? 'checkmark-circle' : 'arrow-forward-circle'}
              size={16}
              color={step?.key === 'live' ? colors.live : brand.gold}
            />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
              {step ? step.title : 'Loading…'}
            </Text>
          </View>
        </View>
        <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
          Control room ›
        </Text>
      </View>
    </Card>
  );
}
