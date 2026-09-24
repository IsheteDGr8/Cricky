import { useState } from 'react';
import { View } from 'react-native';

import {
  availableBatters,
  availableBowlers,
  currentInnings,
  nextAction,
  type ExtraType,
  type PlayerId,
} from '@/domain';
import { Button, Card, Text, useTheme } from '@/ui';
import { newRecordId } from '../ids';
import type { MatchView } from '../matches/match-view';
import { confirmAction } from '../confirm';
import { useScoreActions } from './hooks';
import { PlayerPicker } from './PlayerPicker';
import { AddPlayerSheet, ExtraSheet, OversSheet, WicketSheet } from './Sheets';

type Sheet = 'extra' | 'wicket' | 'overs' | 'add' | null;
type ExtraSheetKind = ExtraType;

const RUNS = [0, 1, 2, 3, 4, 5, 6] as const;

/** The scoring controls for whoever has redeemed this match's code. */
export function ScorePad({ view }: { view: MatchView }) {
  const { spacing } = useTheme();
  const actions = useScoreActions(view);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [extra, setExtra] = useState<ExtraSheetKind>('wide');
  const action = nextAction(view.state);
  const disabled = actions.busy || view.meta.locked;

  return (
    <View style={{ gap: spacing.md }}>
      {view.meta.locked ? (
        <Card>
          <Text color="warning">This match is locked. An admin can unlock it to keep scoring.</Text>
        </Card>
      ) : null}
      {actions.message ? (
        <Card>
          <Text color="danger">{actions.message}</Text>
        </Card>
      ) : null}

      {action === 'set_openers' && <Openers view={view} disabled={disabled} send={actions.send} />}
      {action === 'set_bowler' && <Bowler view={view} disabled={disabled} send={actions.send} />}
      {action === 'new_batter' && (
        <NextBatter view={view} disabled={disabled} send={actions.send} />
      )}
      {action === 'set_player_of_match' && (
        <Potm view={view} disabled={disabled} send={actions.send} />
      )}
      {action === 'none' && (
        <Card>
          <Text>Match complete. The card is locked so the result cannot be changed.</Text>
        </Card>
      )}

      {action === 'delivery' && sheet === null && (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">This ball</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {RUNS.map((n) => (
                <Button
                  key={n}
                  label={String(n)}
                  disabled={disabled}
                  onPress={() => actions.send({ type: 'delivery', runs: n })}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Button
                label="Wide"
                variant="secondary"
                disabled={disabled}
                onPress={() => {
                  setExtra('wide');
                  setSheet('extra');
                }}
              />
              <Button
                label="No-ball"
                variant="secondary"
                disabled={disabled}
                onPress={() => {
                  setExtra('no_ball');
                  setSheet('extra');
                }}
              />
              <Button
                label="Bye"
                variant="secondary"
                disabled={disabled}
                onPress={() => {
                  setExtra('bye');
                  setSheet('extra');
                }}
              />
              <Button
                label="Leg-bye"
                variant="secondary"
                disabled={disabled}
                onPress={() => {
                  setExtra('leg_bye');
                  setSheet('extra');
                }}
              />
              <Button
                label="Wicket"
                variant="danger"
                disabled={disabled}
                onPress={() => setSheet('wicket')}
              />
            </View>
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
          view={view}
          disabled={disabled}
          send={actions.send}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'overs' && (
        <OversSheet
          current={view.state.oversPerInnings}
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
            { id: view.meta.teamA, name: view.teamName(view.meta.teamA) },
            { id: view.meta.teamB, name: view.teamName(view.meta.teamB) },
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
              disabled={disabled}
              onPress={() => actions.send({ type: 'swap_strike' })}
            />
          ) : null}
          {action === 'delivery' ? (
            <Button
              label="End innings"
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
            disabled={disabled || view.state.status === 'complete'}
            onPress={() => setSheet('overs')}
          />
          <Button
            label="Add player"
            variant="ghost"
            disabled={disabled || view.state.status === 'complete'}
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
  return (
    <PlayerPicker
      title="Player of the Match"
      options={ids.map((id) => ({ id, name: view.playerName(id) }))}
      disabled={disabled}
      onPick={(player) => send({ type: 'set_player_of_match', player })}
    />
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
