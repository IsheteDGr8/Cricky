import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  availableBatters,
  availableBowlers,
  currentInnings,
  nextAction,
  type ExtraType,
  type PlayerId,
} from '@/domain';
import { brand, Button, Card, Icon, Text, useTheme } from '@/ui';
import { newRecordId } from '../ids';
import { completedSummary, performerLines, performerText } from '../matches/key-performers';
import type { MatchView } from '../matches/match-view';
import { MatchSummaryCard } from '../matches/MatchSummaryCard';
import { confirmAction } from '../confirm';
import { useScoreActions } from './hooks';
import { PlayerPicker } from './PlayerPicker';
import { AddPlayerSheet, ExtraSheet, OversSheet, WicketSheet } from './Sheets';
import { SyncBanner } from './SyncBanner';

type Sheet = 'extra' | 'wicket' | 'overs' | 'add' | null;
type ExtraSheetKind = ExtraType;

const RUNS = [0, 1, 2, 3, 4, 5, 6] as const;
const EXTRAS: { type: ExtraType; label: string }[] = [
  { type: 'wide', label: 'Wide' },
  { type: 'no_ball', label: 'No-ball' },
  { type: 'bye', label: 'Bye' },
  { type: 'leg_bye', label: 'Leg-bye' },
];

function RunKey({
  runs,
  disabled,
  onPress,
}: {
  runs: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const boundary = runs === 4 || runs === 6;
  const bg = runs === 4 ? brand.gold : runs === 6 ? colors.primary : colors.surface;
  const fg = runs === 4 ? brand.bar : runs === 6 ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={runs === 0 ? 'Dot ball' : runs === 1 ? '1 run' : `${runs} runs`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: boundary ? 76 : 64,
        height: boundary ? 76 : 64,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: boundary ? 0 : 2,
        borderColor: colors.primary,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}>
      <Text style={{ color: fg, fontSize: boundary ? 30 : 24, fontWeight: '800' }}>{runs}</Text>
      {runs === 0 ? <Text style={{ color: fg, fontSize: 10, fontWeight: '700' }}>DOT</Text> : null}
    </Pressable>
  );
}

function ExtraKey({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        borderRadius: 999,
        backgroundColor: pressed ? colors.primary : colors.primaryMuted,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : 1,
      })}>
      {({ pressed }) => (
        <Text variant="bodyStrong" style={{ color: pressed ? colors.onPrimary : colors.primary }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** The scoring controls for whoever has redeemed this match's code. */
export function ScorePad({ view }: { view: MatchView }) {
  const { spacing, colors } = useTheme();
  const actions = useScoreActions(view);
  const shown = actions.view;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [extra, setExtra] = useState<ExtraSheetKind>('wide');
  const action = nextAction(shown.state);
  const disabled = actions.busy || shown.meta.locked;

  return (
    <View style={{ gap: spacing.md }}>
      <SyncBanner status={actions.status} queued={actions.queued} />
      {shown.meta.locked ? (
        <Card>
          <Text color="warning">This match is locked. An admin can unlock it to keep scoring.</Text>
        </Card>
      ) : null}
      {actions.message ? (
        <Card>
          <Text color="danger">{actions.message}</Text>
        </Card>
      ) : null}

      {action === 'set_openers' && <Openers view={shown} disabled={disabled} send={actions.send} />}
      {action === 'set_bowler' && <Bowler view={shown} disabled={disabled} send={actions.send} />}
      {action === 'new_batter' && (
        <NextBatter view={shown} disabled={disabled} send={actions.send} />
      )}
      {action === 'set_player_of_match' && (
        <Potm view={shown} disabled={disabled} send={actions.send} />
      )}
      {action === 'none' && (
        <Card>
          <Text>Match complete. The card is locked so the result cannot be changed.</Text>
        </Card>
      )}

      {action === 'delivery' && sheet === null && (
        <Card>
          <View style={{ gap: spacing.lg }}>
            <Text variant="label" color="textMuted">
              TAP WHAT HAPPENED ON THIS BALL
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: spacing.md,
              }}>
              {RUNS.map((n) => (
                <RunKey
                  key={n}
                  runs={n}
                  disabled={disabled}
                  onPress={() => actions.send({ type: 'delivery', runs: n })}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: spacing.sm,
              }}>
              {EXTRAS.map((e) => (
                <ExtraKey
                  key={e.type}
                  label={e.label}
                  disabled={disabled}
                  onPress={() => {
                    setExtra(e.type);
                    setSheet('extra');
                  }}
                />
              ))}
            </View>
            <Button
              label="Wicket"
              variant="danger"
              size="lg"
              fullWidth
              disabled={disabled}
              icon={<Icon name="close-circle" size={20} color="#FFFFFF" />}
              onPress={() => setSheet('wicket')}
            />
          </View>
        </Card>
      )}

      {sheet === 'extra' && (
        <ExtraSheet
          extra={extra}
          disabled={disabled}
          onCancel={() => setSheet(null)}
          onConfirm={(runs) => {
            setSheet(null);
            actions.send({ type: 'delivery', runs, extra });
          }}
        />
      )}
      {sheet === 'wicket' && (
        <Wicket
          view={shown}
          disabled={disabled}
          send={actions.send}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'overs' && (
        <OversSheet
          current={shown.state.oversPerInnings}
          disabled={disabled}
          onCancel={() => setSheet(null)}
          onConfirm={(overs) => {
            setSheet(null);
            actions.send({ type: 'set_overs', overs });
          }}
        />
      )}
      {sheet === 'add' && (
        <AddPlayerSheet
          teams={[
            { id: shown.meta.teamA, name: shown.teamName(shown.meta.teamA) },
            { id: shown.meta.teamB, name: shown.teamName(shown.meta.teamB) },
          ]}
          disabled={disabled}
          onCancel={() => setSheet(null)}
          onConfirm={(team, name) => {
            setSheet(null);
            actions.send({ type: 'add_player', team, player: newRecordId() }, name);
          }}
        />
      )}

      {action !== 'none' && sheet === null ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            label="Undo"
            variant="secondary"
            icon={<Icon name="arrow-undo" size={16} color={colors.primary} />}
            disabled={disabled || actions.empty}
            onPress={() => {
              void (async () => {
                if (
                  await confirmAction('Undo last event', 'This removes the last ball or choice.')
                ) {
                  await actions.undo();
                }
              })();
            }}
          />
          {action === 'delivery' ? (
            <Button
              label="Swap strike"
              variant="secondary"
              icon={<Icon name="swap-horizontal" size={16} color={colors.primary} />}
              disabled={disabled}
              onPress={() => actions.send({ type: 'swap_strike' })}
            />
          ) : null}
          {action === 'delivery' ? (
            <Button
              label="End innings"
              accessibilityHint="Ends the batting side and starts the next innings or the result"
              variant="secondary"
              disabled={disabled}
              onPress={() => {
                void (async () => {
                  if (
                    await confirmAction(
                      'End innings',
                      'The other side will bat, or the match will finish.',
                    )
                  ) {
                    await actions.send({ type: 'end_innings' });
                  }
                })();
              }}
            />
          ) : null}
          <Button
            label="Change overs"
            variant="ghost"
            disabled={disabled || shown.state.status === 'complete'}
            onPress={() => setSheet('overs')}
          />
          <Button
            label="Add player"
            variant="ghost"
            disabled={disabled || shown.state.status === 'complete'}
            onPress={() => setSheet('add')}
          />
        </View>
      ) : null}
    </View>
  );
}

function Openers({
  view,
  disabled,
  send,
}: {
  view: MatchView;
  disabled: boolean;
  send: (event: { type: 'set_openers'; striker: PlayerId; nonStriker: PlayerId }) => void;
}) {
  const [striker, setStriker] = useState<PlayerId | null>(null);
  const inn = currentInnings(view.state);
  const options = (view.state.squads[inn.battingTeam] ?? []).map((id) => ({
    id,
    name: view.playerName(id),
  }));
  if (!striker) {
    return (
      <PlayerPicker
        title={`Striker — ${view.teamName(inn.battingTeam)}`}
        options={options}
        disabled={disabled}
        onPick={setStriker}
      />
    );
  }
  return (
    <PlayerPicker
      title="Non-striker"
      options={options.filter((o) => o.id !== striker)}
      disabled={disabled}
      onPick={(nonStriker) => send({ type: 'set_openers', striker, nonStriker })}
    />
  );
}

function Bowler({
  view,
  disabled,
  send,
}: {
  view: MatchView;
  disabled: boolean;
  send: (event: { type: 'set_bowler'; bowler: PlayerId }) => void;
}) {
  return (
    <PlayerPicker
      title="Choose the bowler"
      options={availableBowlers(view.state).map((id) => ({ id, name: view.playerName(id) }))}
      disabled={disabled}
      onPick={(bowler) => send({ type: 'set_bowler', bowler })}
    />
  );
}

function NextBatter({
  view,
  disabled,
  send,
}: {
  view: MatchView;
  disabled: boolean;
  send: (event: { type: 'new_batter'; batter: PlayerId }) => void;
}) {
  return (
    <PlayerPicker
      title="Next batter"
      options={availableBatters(view.state).map((id) => ({ id, name: view.playerName(id) }))}
      disabled={disabled}
      onPick={(batter) => send({ type: 'new_batter', batter })}
    />
  );
}

function Potm({
  view,
  disabled,
  send,
}: {
  view: MatchView;
  disabled: boolean;
  send: (event: { type: 'set_player_of_match'; player: PlayerId }) => void;
}) {
  const ids = [
    ...(view.state.squads[view.meta.teamA] ?? []),
    ...(view.state.squads[view.meta.teamB] ?? []),
  ];
  const summary = completedSummary(view.id, view.state);
  const lines = summary ? performerLines(summary) : [];
  const ranked = [
    ...lines.map((l) => l.player).filter((id) => ids.includes(id)),
    ...ids.filter((id) => !lines.some((l) => l.player === id)),
  ];
  return (
    <>
      <MatchSummaryCard view={view} />
      <PlayerPicker
        title="Pick the Player of the Match"
        options={ranked.map((id) => {
          const line = lines.find((l) => l.player === id);
          const hint = line ? performerText(line) : '';
          return { id, name: view.playerName(id), ...(hint ? { hint } : {}) };
        })}
        disabled={disabled}
        onPick={(player) => send({ type: 'set_player_of_match', player })}
      />
    </>
  );
}

function Wicket({
  view,
  disabled,
  send,
  onClose,
}: {
  view: MatchView;
  disabled: boolean;
  send: ReturnType<typeof useScoreActions>['send'];
  onClose: () => void;
}) {
  const inn = currentInnings(view.state);
  if (!inn.striker || !inn.nonStriker) return null;
  return (
    <WicketSheet
      striker={{ id: inn.striker, name: view.playerName(inn.striker) }}
      nonStriker={{ id: inn.nonStriker, name: view.playerName(inn.nonStriker) }}
      fielders={(view.state.squads[inn.bowlingTeam] ?? []).map((id) => ({
        id,
        name: view.playerName(id),
      }))}
      disabled={disabled}
      onCancel={onClose}
      onConfirm={(wicket) => {
        onClose();
        send({ type: 'delivery', runs: 0, wicket });
      }}
    />
  );
}
