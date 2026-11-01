import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Stage, WithId, Team } from '@/data';
import type { TossDecision } from '@/domain';
import {
  brand,
  Button,
  Card,
  Chip,
  Field,
  Hero,
  Icon,
  onHero,
  Stepper,
  Steps,
  Text,
  useTheme,
} from '@/ui';
import { useDataLayer } from '../data-provider';
import type { TournamentView } from '../tournaments/tournament-view';
import { parseMatchForm, parsePlayerNames, parseQuickTeams } from './forms';
import { fixtureMatch } from './next-step';
import { ScorerCodePanel } from './ScorerCodePanel';

type Side = { id: string; name: string; players: { id: string; name: string }[] };

export type MatchWizardProps =
  { mode: 'tournament'; view: TournamentView; fixtureId?: string } | { mode: 'quick' };

const STEPS = ['Teams', 'Toss', 'Overs', 'Go'] as const;
const OVER_PRESETS = [5, 6, 8, 10, 12, 20] as const;

function sideOf(team: WithId<Team>): Side {
  return {
    id: team.id,
    name: team.name,
    players: Object.entries(team.players)
      .sort(([, x], [, y]) => x.order - y.order)
      .map(([pid, p]) => ({ id: pid, name: p.name })),
  };
}

/** Sets up a match in four short steps and ends on the scorer code. */
export function MatchWizard(props: MatchWizardProps) {
  const { spacing } = useTheme();
  const { matches, access } = useDataLayer();
  const view = props.mode === 'tournament' ? props.view : null;
  const fixture = view?.bracket?.fixtures.find(
    (f) => props.mode === 'tournament' && f.id === props.fixtureId,
  );

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(
    fixture?.home && fixture.away ? [fixture.home, fixture.away] : [],
  );
  const [names, setNames] = useState(['', '']);
  const [squads, setSquads] = useState(['', '']);
  const [tossSide, setTossSide] = useState<0 | 1 | null>(null);
  const [decision, setDecision] = useState<TossDecision>('bat');
  const [overs, setOvers] = useState(view?.tournament.oversDefault ?? 10);
  const [stage, setStage] = useState<Stage>(
    props.mode === 'quick' ? 'quick' : fixture ? 'playoff' : 'group',
  );
  const [fixtureId, setFixtureId] = useState(fixture?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  const teamName = (i: 0 | 1): string => {
    if (view) {
      const id = picked[i];
      return id ? view.teamName(id) : i === 0 ? 'Team 1' : 'Team 2';
    }
    return names[i]?.trim() || (i === 0 ? 'Team 1' : 'Team 2');
  };

  const teamsReady = view
    ? picked.length === 2
    : names.every((n) => n.trim()) && squads.every((s) => parsePlayerNames(s).length >= 2);
  const canNext = [teamsReady, tossSide !== null, stage !== 'playoff' || !!fixtureId, true][step];
  const batting = tossSide === null ? null : decision === 'bat' ? tossSide : tossSide === 0 ? 1 : 0;

  const create = () => {
    setError(null);
    let sides: [Side, Side] | string;
    if (view) {
      const [a, b] = picked.map((id) => view.teams.find((t) => t.id === id));
      sides = a && b ? [sideOf(a), sideOf(b)] : 'Pick two teams.';
    } else {
      sides = parseQuickTeams(names[0] ?? '', squads[0] ?? '', names[1] ?? '', squads[1] ?? '');
    }
    if (typeof sides === 'string') {
      setError(sides);
      return;
    }
    const parsed = parseMatchForm({
      teamA: sides[0],
      teamB: sides[1],
      overs: String(overs),
      tossWinner: sides[tossSide ?? 0].id,
      tossDecision: decision,
      stage,
      ...(view ? { tournamentId: view.tournament.id } : {}),
      ...(stage === 'playoff' && fixtureId ? { fixtureId } : {}),
    });
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }
    setBusy(true);
    matches
      .create(parsed)
      .then(async (id) => setCreated({ id, code: await access.issueScorerCode(id) }))
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setBusy(false));
  };

  if (created) {
    const title = `${teamName(0)} v ${teamName(1)}`;
    return (
      <View style={{ gap: spacing.lg }}>
        <Hero>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="checkmark-circle" size={28} color={brand.gold} />
            <Text variant="title" style={{ color: onHero.strong }}>
              Match is set
            </Text>
          </View>
          <Text style={{ color: onHero.soft }}>
            {title} · {overs} overs · {batting === null ? '' : `${teamName(batting)} bat first`}
          </Text>
        </Hero>
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">Hand scoring to someone</Text>
            <Text color="textMuted">
              Send them the scorer link. It opens the score pad on their phone, with no sign-in.
            </Text>
            <ScorerCodePanel matchId={created.id} title={title} initialCode={created.code} />
          </View>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            label="Score it myself"
            size="lg"
            icon={<Icon name="create-outline" size={20} color="#FFFFFF" />}
            onPress={() => router.replace({ pathname: '/score/[id]', params: { id: created.id } })}
          />
          <Button
            label="Open match page"
            size="lg"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/match/[id]', params: { id: created.id } })}
          />
          {view ? (
            <Button
              label="Back to control room"
              size="lg"
              variant="ghost"
              onPress={() =>
                router.replace({
                  pathname: '/admin/tournament/[id]',
                  params: { id: view.tournament.id },
                })
              }
            />
          ) : (
            <Button
              label="Back to home"
              size="lg"
              variant="ghost"
              onPress={() => router.replace('/more' as Href)}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Steps labels={STEPS} current={step} onBack={setStep} />
      <Matchup left={teamName(0)} right={teamName(1)} batting={batting} />

      {step === 0 &&
        (view ? (
          <PickTeams view={view} picked={picked} onChange={setPicked} />
        ) : (
          <TypeTeams names={names} squads={squads} setNames={setNames} setSquads={setSquads} />
        ))}

      {step === 1 && (
        <Toss
          names={[teamName(0), teamName(1)]}
          side={tossSide}
          decision={decision}
          onSide={setTossSide}
          onDecision={setDecision}
        />
      )}

      {step === 2 && (
        <Card>
          <View style={{ gap: spacing.lg }}>
            <Stepper
              label="Overs per side"
              value={overs}
              onChange={setOvers}
              min={1}
              max={50}
              presets={OVER_PRESETS}
              unit="overs"
            />
            {view ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" color="textMuted">
                  Stage
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  <Chip
                    label="Group game"
                    selected={stage === 'group'}
                    onPress={() => setStage('group')}
                  />
                  {view.bracket ? (
                    <Chip
                      label="Playoff"
                      icon="trophy-outline"
                      selected={stage === 'playoff'}
                      onPress={() => setStage('playoff')}
                    />
                  ) : null}
                </View>
                {stage === 'playoff' && view.bracket ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text color="textMuted">Which playoff is this?</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {view.bracket.fixtures
                        .filter((f) => !f.winner && !fixtureMatch(view, f))
                        .map((f) => (
                          <Chip
                            key={f.id}
                            label={f.name}
                            selected={fixtureId === f.id}
                            onPress={() => {
                              setFixtureId(f.id);
                              if (f.home && f.away) setPicked([f.home, f.away]);
                            }}
                          />
                        ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">Ready to go?</Text>
            <Summary label="Match" value={`${teamName(0)} v ${teamName(1)}`} />
            <Summary
              label="Toss"
              value={
                tossSide === null
                  ? '—'
                  : `${teamName(tossSide)} won and chose to ${decision === 'bat' ? 'bat' : 'bowl'}`
              }
            />
            <Summary label="Overs" value={`${overs} a side`} />
            <Summary
              label="Stage"
              value={
                stage === 'playoff'
                  ? (view?.bracket?.fixtures.find((f) => f.id === fixtureId)?.name ?? 'Playoff')
                  : stage === 'quick'
                    ? 'Quick match (not in a tournament)'
                    : 'Group game'
              }
            />
            <Text variant="caption" color="textMuted">
              Next you get a scorer code. Squads can still grow during the match with Add player.
            </Text>
          </View>
        </Card>
      )}

      {error ? <Text color="danger">{error}</Text> : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
        <Button
          label="Back"
          variant="ghost"
          disabled={step === 0}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
        />
        {step < STEPS.length - 1 ? (
          <Button
            label="Next"
            size="lg"
            disabled={!canNext}
            icon={<Icon name="arrow-forward" size={20} color="#FFFFFF" />}
            onPress={() => setStep((s) => s + 1)}
          />
        ) : (
          <Button
            label="Create match"
            size="lg"
            variant="gold"
            loading={busy}
            icon={<Icon name="flash" size={20} color={brand.bar} />}
            onPress={create}
          />
        )}
      </View>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceMuted,
      }}>
      <Text color="textMuted">{label}</Text>
      <Text variant="bodyStrong" align="right" style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}

/** The two sides facing off, with a bat icon on whoever bats first. */
function Matchup({ left, right, batting }: { left: string; right: string; batting: 0 | 1 | null }) {
  const { spacing, radius } = useTheme();
  const side = (name: string, i: 0 | 1) => (
    <View style={{ flex: 1, alignItems: i === 0 ? 'flex-start' : 'flex-end', gap: 2 }}>
      <Text
        variant="heading"
        numberOfLines={2}
        align={i === 0 ? 'left' : 'right'}
        style={{ color: onHero.strong }}>
        {name}
      </Text>
      {batting === i ? (
        <Text variant="caption" style={{ color: brand.gold, fontWeight: '700' }}>
          BATS FIRST
        </Text>
      ) : null}
    </View>
  );
  return (
    <Hero style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      {side(left, 0)}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          backgroundColor: brand.gold,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: brand.bar, fontWeight: '900' }}>VS</Text>
      </View>
      {side(right, 1)}
    </Hero>
  );
}

function PickTeams({
  view,
  picked,
  onChange,
}: {
  view: TournamentView;
  picked: string[];
  onChange: (next: string[]) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const groups = useMemo(() => [...new Set(view.teams.map((t) => t.group))].sort(), [view.teams]);

  if (view.teams.length < 2) {
    return (
      <Card>
        <Text color="textMuted">
          This tournament needs at least two teams. Add them in the control room first.
        </Text>
      </Card>
    );
  }

  const toggle = (id: string) => {
    if (picked.includes(id)) onChange(picked.filter((p) => p !== id));
    else onChange(picked.length >= 2 ? [picked[0] as string, id] : [...picked, id]);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text color="textMuted">Tap two teams. The first one you tap is on the left.</Text>
      {groups.map((group) => (
        <View key={group} style={{ gap: spacing.sm }}>
          {groups.length > 1 ? (
            <Text variant="label" color="textMuted">
              Group {group}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {view.teams
              .filter((t) => t.group === group)
              .map((t) => {
                const slot = picked.indexOf(t.id);
                const on = slot >= 0;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggle(t.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${t.name}${on ? `, team ${slot + 1}` : ''}`}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: 150,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 2,
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on
                        ? colors.primaryMuted
                        : pressed
                          ? colors.surfaceMuted
                          : colors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                    })}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? colors.primary : colors.surfaceMuted,
                      }}>
                      <Text
                        variant="caption"
                        style={{
                          fontWeight: '800',
                          color: on ? colors.onPrimary : colors.textMuted,
                        }}>
                        {on ? slot + 1 : t.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {Object.keys(t.players).length} players
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </View>
      ))}
    </View>
  );
}

function TypeTeams({
  names,
  squads,
  setNames,
  setSquads,
}: {
  names: string[];
  squads: string[];
  setNames: (next: string[]) => void;
  setSquads: (next: string[]) => void;
}) {
  const { spacing } = useTheme();
  const set = (list: string[], i: number, value: string) =>
    list.map((v, j) => (j === i ? value : v));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {[0, 1].map((i) => {
        const count = parsePlayerNames(squads[i] ?? '').length;
        return (
          <Card key={i} style={{ flexGrow: 1, flexBasis: 280 }}>
            <View style={{ gap: spacing.md }}>
              <Field
                label={`Team ${i + 1}`}
                value={names[i]}
                onChangeText={(v) => setNames(set(names, i, v))}
                placeholder={i === 0 ? 'e.g. Night Owls' : 'e.g. Early Birds'}
              />
              <Field
                label="Players"
                value={squads[i]}
                onChangeText={(v) => setSquads(set(squads, i, v))}
                multiline
                placeholder={'One per line, or separated by commas'}
                hint={
                  count === 0
                    ? 'Paste from the group chat; commas or new lines both work.'
                    : `${count} player${count === 1 ? '' : 's'}${count < 2 ? ' · need at least 2' : ''}`
                }
              />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function Toss({
  names,
  side,
  decision,
  onSide,
  onDecision,
}: {
  names: [string, string];
  side: 0 | 1 | null;
  decision: TossDecision;
  onSide: (side: 0 | 1) => void;
  onDecision: (d: TossDecision) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const [coin, setCoin] = useState<'Heads' | 'Tails' | null>(null);
  const [flips, setFlips] = useState(0);

  return (
    <Card>
      <View style={{ gap: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            flexWrap: 'wrap',
          }}>
          <Text variant="heading">Who won the toss?</Text>
          <Pressable
            onPress={() => {
              setCoin(Math.random() < 0.5 ? 'Heads' : 'Tails');
              setFlips((n) => n + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={coin ? `Flip again. Last flip: ${coin}` : 'Flip a coin'}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: pressed ? '#A3926A' : brand.gold,
            })}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: '#E8DDBE',
                borderWidth: 2,
                borderColor: brand.bar,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotateY: `${flips * 180}deg` }],
              }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: brand.bar }}>
                {coin ? coin[0] : '?'}
              </Text>
            </View>
            <Text variant="bodyStrong" style={{ color: brand.bar }}>
              {coin ? `${coin}! Flip again` : 'Flip a coin'}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {([0, 1] as const).map((i) => (
            <Pressable
              key={i}
              onPress={() => onSide(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: side === i }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 72,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: side === i ? colors.primary : colors.border,
                backgroundColor:
                  side === i ? colors.primary : pressed ? colors.surfaceMuted : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              })}>
              <Text
                variant="bodyStrong"
                align="center"
                style={{ color: side === i ? colors.onPrimary : colors.text }}>
                {names[i]}
              </Text>
            </Pressable>
          ))}
        </View>

        {side !== null ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color="textMuted">
              {names[side]} chose to
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip
                label="Bat first"
                icon="baseball-outline"
                selected={decision === 'bat'}
                onPress={() => onDecision('bat')}
              />
              <Chip
                label="Bowl first"
                icon="disc-outline"
                selected={decision === 'bowl'}
                onPress={() => onDecision('bowl')}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
