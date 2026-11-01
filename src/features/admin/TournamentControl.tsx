import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { MatchSummary, PlayoffFormat, Tournament, WithId } from '@/data';
import {
  Badge,
  brand,
  Button,
  Card,
  Chip,
  Field,
  Hero,
  Icon,
  onHero,
  Stepper,
  Text,
  useTheme,
} from '@/ui';
import { confirmAction } from '../confirm';
import { useDataLayer } from '../data-provider';
import { ShareButton } from '../ShareButton';
import type { TournamentView } from '../tournaments/tournament-view';
import { Choice, PLAYOFF_FORMATS, type ChoiceOption } from './Choice';
import { parsePlayerNames, parseTeamForm, parseTournamentForm } from './forms';
import { fixtureMatch, nextStep, unrecordedWinners, type ControlSection } from './next-step';
import { ScorerCodePanel } from './ScorerCodePanel';

const STATUSES: ChoiceOption<Tournament['status']>[] = [
  { value: 'upcoming', label: 'Upcoming', detail: 'Announced, not started.' },
  { value: 'active', label: 'Active', detail: 'Matches are being played.' },
  { value: 'complete', label: 'Complete', detail: 'Done. Results stay public.' },
  { value: 'archived', label: 'Archived', detail: 'Hidden from the front page.' },
];

const startMatch = (tournamentId: string, fixtureId?: string) =>
  router.push({
    pathname: '/admin/match/new',
    params: fixtureId ? { tournamentId, fixtureId } : { tournamentId },
  });

/** The admin's home for one tournament: what to do next, then teams, matches, playoffs, settings. */
export function TournamentControl({ view }: { view: TournamentView }) {
  const { spacing } = useTheme();
  const step = nextStep(view);
  const [section, setSection] = useState<ControlSection>(step.section);
  const t = view.tournament;
  const live = view.matches.filter((m) => m.status === 'live').length;
  const played = view.matches.filter((m) => m.status === 'complete').length;

  return (
    <View style={{ gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: 'Control room',
          headerRight: () => <ShareButton path={`/tournament/${t.id}`} title={t.name} />,
        }}
      />
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Badge label={t.status} tone="onHero" />
          <Text variant="caption" style={{ color: onHero.soft }}>
            {t.oversDefault} overs ·{' '}
            {PLAYOFF_FORMATS.find((f) => f.value === t.playoffFormat)?.label}
          </Text>
        </View>
        <Text variant="title" style={{ color: onHero.strong }}>
          {t.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' }}>
          <Stat value={view.teams.length} label="teams" />
          <Stat value={played} label="played" />
          <Stat value={live} label="live" gold={live > 0} />
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="eye-outline" size={16} color={brand.gold} />
          <Text variant="caption" style={{ color: brand.gold, fontWeight: '700' }}>
            See what viewers see
          </Text>
        </Pressable>
      </Hero>

      <NextStepCard view={view} onSection={setSection} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip
          label="Teams"
          icon="people-outline"
          count={view.teams.length}
          selected={section === 'teams'}
          onPress={() => setSection('teams')}
        />
        <Chip
          label="Matches"
          icon="baseball-outline"
          count={view.matches.length}
          selected={section === 'matches'}
          onPress={() => setSection('matches')}
        />
        {view.bracket ? (
          <Chip
            label="Playoffs"
            icon="trophy-outline"
            selected={section === 'playoffs'}
            onPress={() => setSection('playoffs')}
          />
        ) : null}
        <Chip
          label="Settings"
          icon="settings-outline"
          selected={section === 'settings'}
          onPress={() => setSection('settings')}
        />
      </View>

      {section === 'teams' && <TeamsPanel view={view} />}
      {section === 'matches' && <MatchesPanel view={view} />}
      {section === 'playoffs' && <PlayoffsPanel view={view} />}
      {section === 'settings' && <SettingsPanel view={view} />}
    </View>
  );
}

function Stat({ value, label, gold }: { value: number; label: string; gold?: boolean }) {
  return (
    <View>
      <Text
        style={{
          color: gold ? brand.gold : onHero.strong,
          fontSize: 26,
          lineHeight: 30,
          fontWeight: '800',
        }}>
        {value}
      </Text>
      <Text variant="caption" style={{ color: onHero.soft }}>
        {label}
      </Text>
    </View>
  );
}

function NextStepCard({
  view,
  onSection,
}: {
  view: TournamentView;
  onSection: (s: ControlSection) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { tournaments } = useDataLayer();
  const step = nextStep(view);
  const [busy, setBusy] = useState(false);
  const t = view.tournament;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const action = (() => {
    switch (step.key) {
      case 'teams':
        return { label: 'Add a team', onPress: () => onSection('teams') };
      case 'first_match':
      case 'more':
        return { label: 'Start a match', onPress: () => startMatch(t.id) };
      case 'live':
        return {
          label: 'Score it',
          onPress: () =>
            step.matchId && router.push({ pathname: '/score/[id]', params: { id: step.matchId } }),
        };
      case 'playoff':
        return { label: step.title, onPress: () => startMatch(t.id, step.fixtureId) };
      case 'record':
        return {
          label: 'Record winners',
          onPress: () =>
            void run(async () => {
              for (const w of unrecordedWinners(view)) {
                await tournaments.setPlayoffWinner(t.id, w.fixtureId, w.winner);
              }
            }),
        };
      case 'finish':
        return {
          label: 'Mark complete',
          onPress: () => void run(() => tournaments.update(t.id, { status: 'complete' })),
        };
      case 'done':
        return {
          label: 'Open public page',
          onPress: () => router.push({ pathname: '/tournament/[id]', params: { id: t.id } }),
        };
    }
  })();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderLeftWidth: 5,
        borderLeftColor: brand.gold,
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
      <View style={{ flex: 1, minWidth: 220, gap: spacing.xxs }}>
        <Text variant="label" style={{ color: '#85764F' }}>
          {step.key === 'done' ? 'All done' : 'Next step'}
        </Text>
        <Text variant="heading">{step.title}</Text>
        <Text color="textMuted">{step.detail}</Text>
      </View>
      <Button
        label={action.label}
        variant="gold"
        loading={busy}
        icon={<Icon name="arrow-forward" size={18} color={brand.bar} />}
        onPress={action.onPress}
      />
    </View>
  );
}

function TeamsPanel({ view }: { view: TournamentView }) {
  const { spacing, colors } = useTheme();
  const { tournaments } = useDataLayer();
  const groups = [...new Set(view.teams.map((t) => t.group))].sort();
  const [editing, setEditing] = useState<string | 'new' | null>(
    view.teams.length < 2 ? 'new' : null,
  );
  const [name, setName] = useState('');
  const [group, setGroup] = useState(groups[0] ?? 'A');
  const [players, setPlayers] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = parsePlayerNames(players).length;

  const open = (id: string | 'new') => {
    const team = view.teams.find((t) => t.id === id);
    setEditing(id);
    setError(null);
    setName(team?.name ?? '');
    setGroup(team?.group ?? groups[0] ?? 'A');
    setPlayers(
      team
        ? Object.values(team.players)
            .sort((a, b) => a.order - b.order)
            .map((p) => p.name)
            .join('\n')
        : '',
    );
  };

  const save = async () => {
    const parsed = parseTeamForm({ name, tournamentId: view.tournament.id, group, players });
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }
    const existing = view.teams.find((t) => t.id === editing);
    if (existing) {
      const byName = new Map(Object.entries(existing.players).map(([id, p]) => [p.name, id]));
      parsed.players = Object.fromEntries(
        Object.entries(parsed.players).map(([id, p]) => [byName.get(p.name) ?? id, p]),
      );
    }
    setBusy(true);
    try {
      await tournaments.saveTeam(parsed, existing?.id);
      setEditing(null);
      setName('');
      setPlayers('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const groupOptions = [...new Set([...groups, 'A', 'B'])].sort();

  return (
    <View style={{ gap: spacing.md }}>
      {editing ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">{editing === 'new' ? 'New team' : `Edit ${name}`}</Text>
            <Field
              label="Team name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pitch Predators"
            />
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="textMuted">
                Group
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {groupOptions.map((g) => (
                  <Chip key={g} label={g} selected={group === g} onPress={() => setGroup(g)} />
                ))}
              </View>
            </View>
            <Field
              label="Squad"
              value={players}
              onChangeText={setPlayers}
              multiline
              placeholder="Paste names, one per line or separated by commas"
              hint={
                count === 0
                  ? 'Copy the squad straight from the group chat.'
                  : `${count} player${count === 1 ? '' : 's'}`
              }
            />
            {error ? <Text color="danger">{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button
                label={editing === 'new' ? 'Add team' : 'Save team'}
                loading={busy}
                onPress={() => void save()}
              />
              <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} />
            </View>
          </View>
        </Card>
      ) : (
        <Button
          label="Add a team"
          icon={<Icon name="add" size={20} color={colors.onPrimary} />}
          onPress={() => open('new')}
        />
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {view.teams.map((team) => {
          const names = Object.values(team.players).sort((a, b) => a.order - b.order);
          return (
            <Card key={team.id} style={{ flexGrow: 1, flexBasis: 280 }}>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="heading" color="primary" style={{ flex: 1 }} numberOfLines={1}>
                    {team.name}
                  </Text>
                  <Badge label={`Group ${team.group}`} tone="brand" />
                </View>
                <Text color="textMuted" numberOfLines={3}>
                  {names.map((p) => p.name).join(' · ')}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label="Edit" variant="secondary" onPress={() => open(team.id)} />
                  <Button
                    label="Remove"
                    variant="ghost"
                    onPress={() => {
                      void (async () => {
                        if (
                          await confirmAction(
                            'Remove team',
                            `Delete ${team.name}? Matches already played keep their scorecards.`,
                          )
                        ) {
                          await tournaments.removeTeam(team.id);
                        }
                      })();
                    }}
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

function MatchesPanel({ view }: { view: TournamentView }) {
  const { spacing, colors } = useTheme();
  const groups: [string, WithId<MatchSummary>[]][] = [
    ['Live now', view.matches.filter((m) => m.status === 'live')],
    ['Not started', view.matches.filter((m) => m.status === 'scheduled')],
    ['Finished', view.matches.filter((m) => m.status === 'complete')],
  ];
  return (
    <View style={{ gap: spacing.md }}>
      <Button
        label="Start a match"
        icon={<Icon name="add" size={20} color={colors.onPrimary} />}
        onPress={() => startMatch(view.tournament.id)}
      />
      {view.matches.length === 0 ? (
        <Text color="textMuted">No matches yet. Start one and hand out the scorer code.</Text>
      ) : null}
      {groups.map(([title, list]) =>
        list.length ? (
          <View key={title} style={{ gap: spacing.sm }}>
            <Text variant="label" color="primary" style={{ fontWeight: '800' }}>
              {title}
            </Text>
            {list.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </View>
        ) : null,
      )}
    </View>
  );
}

function MatchRow({ match }: { match: WithId<MatchSummary> }) {
  const { spacing, colors } = useTheme();
  const { matches } = useDataLayer();
  const [open, setOpen] = useState(match.status === 'live');
  const title = `${match.teamAName} v ${match.teamBName}`;
  const score = (match.innings ?? []).map((i) => `${i.runs}/${i.wickets}`).join(' · ');

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{title}</Text>
            <Text variant="caption" color="textMuted">
              {match.stage === 'playoff' ? 'Playoff · ' : ''}
              {score || 'Not started'}
            </Text>
          </View>
          {match.status === 'live' ? <Badge label="Live" tone="live" /> : null}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </Pressable>
        {open ? (
          <View style={{ gap: spacing.md }}>
            {match.status !== 'complete' ? (
              <ScorerCodePanel matchId={match.id} title={title} compact />
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {match.status !== 'complete' ? (
                <Button
                  label="Score"
                  icon={<Icon name="create-outline" size={18} color={colors.onPrimary} />}
                  onPress={() => router.push({ pathname: '/score/[id]', params: { id: match.id } })}
                />
              ) : null}
              <Button
                label="Match page"
                variant="secondary"
                onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
              />
              <Button
                label="Delete"
                variant="ghost"
                onPress={() => {
                  void (async () => {
                    if (
                      await confirmAction('Delete match', `${title} and its scorecard go for good.`)
                    ) {
                      await matches.remove(match.id);
                    }
                  })();
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function PlayoffsPanel({ view }: { view: TournamentView }) {
  const { spacing, colors } = useTheme();
  const { tournaments } = useDataLayer();
  const pending = unrecordedWinners(view);
  const [busy, setBusy] = useState(false);
  if (!view.bracket) return null;

  return (
    <View style={{ gap: spacing.md }}>
      {pending.length ? (
        <Button
          label={`Record ${pending.length} winner${pending.length === 1 ? '' : 's'}`}
          variant="gold"
          loading={busy}
          onPress={() => {
            setBusy(true);
            void (async () => {
              try {
                for (const w of pending) {
                  await tournaments.setPlayoffWinner(view.tournament.id, w.fixtureId, w.winner);
                }
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      ) : null}
      {view.bracket.fixtures.map((f) => {
        const match = fixtureMatch(view, f);
        const ready = f.home && f.away;
        return (
          <Card key={f.id}>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon
                  name={f.winner ? 'trophy' : 'trophy-outline'}
                  size={20}
                  color={f.winner ? brand.gold : colors.textMuted}
                />
                <Text variant="heading" style={{ flex: 1 }}>
                  {f.name}
                </Text>
                {f.winner ? (
                  <Badge label={`${view.teamName(f.winner)} won`} tone="success" />
                ) : null}
              </View>
              <Text color={ready ? 'text' : 'textMuted'}>
                {f.home ? view.teamName(f.home) : 'To be decided'} v{' '}
                {f.away ? view.teamName(f.away) : 'To be decided'}
              </Text>
              {!f.winner ? (
                match ? (
                  <Button
                    label={match.status === 'live' ? 'Score it' : 'Open match'}
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: match.status === 'live' ? '/score/[id]' : '/match/[id]',
                        params: { id: match.id },
                      })
                    }
                  />
                ) : ready ? (
                  <Button
                    label={`Start the ${f.name}`}
                    onPress={() => startMatch(view.tournament.id, f.id)}
                  />
                ) : (
                  <Text variant="caption" color="textMuted">
                    Fills in from the standings and earlier rounds.
                  </Text>
                )
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function SettingsPanel({ view }: { view: TournamentView }) {
  const { spacing } = useTheme();
  const { tournaments } = useDataLayer();
  const t = view.tournament;
  const [name, setName] = useState(t.name);
  const [overs, setOvers] = useState(t.oversDefault);
  const [format, setFormat] = useState<PlayoffFormat>(t.playoffFormat);
  const [status, setStatus] = useState(t.status);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const parsed = parseTournamentForm({
      name,
      overs: String(overs),
      playoffFormat: format,
      thirdPlace: t.thirdPlace,
    });
    if (typeof parsed === 'string') {
      setNote({ ok: false, text: parsed });
      return;
    }
    try {
      await tournaments.update(t.id, {
        name: parsed.name,
        oversDefault: parsed.oversDefault,
        playoffFormat: parsed.playoffFormat,
        status,
      });
      setNote({ ok: true, text: 'Saved.' });
    } catch (caught) {
      setNote({ ok: false, text: caught instanceof Error ? caught.message : String(caught) });
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ gap: spacing.lg }}>
          <Field label="Name" value={name} onChangeText={setName} />
          <Stepper
            label="Default overs for new matches"
            value={overs}
            onChange={setOvers}
            min={1}
            max={50}
            presets={[5, 6, 8, 10, 12, 20]}
            unit="overs"
          />
          <Choice label="Playoffs" options={PLAYOFF_FORMATS} value={format} onChange={setFormat} />
          <Choice label="Status" options={STATUSES} value={status} onChange={setStatus} />
          {note ? <Text color={note.ok ? 'success' : 'danger'}>{note.text}</Text> : null}
          <Button label="Save changes" onPress={() => void save()} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading" color="danger">
            Danger zone
          </Text>
          <Text color="textMuted">
            Deleting removes the tournament and its teams. Match scorecards are kept.
          </Text>
          <Button
            label="Delete tournament"
            variant="danger"
            onPress={() => {
              void (async () => {
                if (!(await confirmAction('Delete tournament', `Delete ${t.name} for good?`))) {
                  return;
                }
                await tournaments.remove(
                  t.id,
                  view.teams.map((team) => team.id),
                );
                router.replace('/more' as Href);
              })();
            }}
          />
        </View>
      </Card>
    </View>
  );
}
