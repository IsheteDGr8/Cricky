import { useState } from 'react';
import { View } from 'react-native';

import type { DeliveryDismissalKind, ExtraType, PlayerId } from '@/domain';
import { Button, Card, Field, SegmentedControl, Text, useTheme } from '@/ui';
import type { PlayerOption } from './PlayerPicker';

const WICKET_KINDS: { value: DeliveryDismissalKind; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'run_out', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hit_wicket', label: 'Hit wicket' },
];

export function ExtraSheet({
  extra,
  onCancel,
  onConfirm,
  disabled,
}: {
  extra: ExtraType;
  onCancel: () => void;
  onConfirm: (runs: number) => void;
  disabled?: boolean;
}) {
  const { spacing } = useTheme();
  const title =
    extra === 'wide'
      ? 'Wide — extra runs besides the one-run penalty'
      : extra === 'no_ball'
        ? 'No-ball — runs off the bat'
        : extra === 'bye'
          ? 'Byes'
          : 'Leg-byes';
  const min = extra === 'bye' || extra === 'leg_bye' ? 1 : 0;
  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">{title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {Array.from({ length: 7 - min }, (_, i) => i + min).map((n) => (
            <Button key={n} label={String(n)} disabled={disabled} onPress={() => onConfirm(n)} />
          ))}
        </View>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Card>
  );
}

export function WicketSheet({
  striker,
  nonStriker,
  fielders,
  onCancel,
  onConfirm,
  disabled,
}: {
  striker: { id: PlayerId; name: string };
  nonStriker: { id: PlayerId; name: string };
  fielders: PlayerOption[];
  onCancel: () => void;
  onConfirm: (input: {
    kind: DeliveryDismissalKind;
    playerOut: PlayerId;
    fielder?: PlayerId;
  }) => void;
  disabled?: boolean;
}) {
  const { spacing } = useTheme();
  const [kind, setKind] = useState<DeliveryDismissalKind>('bowled');
  const [out, setOut] = useState<PlayerId>(striker.id);
  const [fielder, setFielder] = useState<PlayerId | ''>('');
  const needsFielder = kind === 'caught' || kind === 'stumped' || kind === 'run_out';

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">Wicket</Text>
        <SegmentedControl options={WICKET_KINDS} value={kind} onChange={setKind} />
        <Text variant="label" color="textMuted">
          Who is out
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            label={`${striker.name} (strike)`}
            variant={out === striker.id ? 'primary' : 'secondary'}
            onPress={() => setOut(striker.id)}
          />
          <Button
            label={`${nonStriker.name}`}
            variant={out === nonStriker.id ? 'primary' : 'secondary'}
            disabled={kind !== 'run_out'}
            onPress={() => setOut(nonStriker.id)}
          />
        </View>
        {needsFielder ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color="textMuted">
              Fielder
            </Text>
            {fielders.map((f) => (
              <Button
                key={f.id}
                label={f.name}
                variant={fielder === f.id ? 'primary' : 'secondary'}
                fullWidth
                onPress={() => setFielder(f.id)}
              />
            ))}
          </View>
        ) : null}
        <Button
          label="Confirm wicket"
          disabled={disabled || (needsFielder && !fielder)}
          onPress={() =>
            onConfirm({
              kind,
              playerOut: out,
              ...(fielder && needsFielder ? { fielder } : {}),
            })
          }
        />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Card>
  );
}

export function OversSheet({
  current,
  onCancel,
  onConfirm,
  disabled,
}: {
  current: number;
  onCancel: () => void;
  onConfirm: (overs: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(current));
  const { spacing } = useTheme();
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">Change overs</Text>
        <Field label="Overs a side" value={text} onChangeText={setText} keyboardType="number-pad" />
        <Button label="Save" disabled={disabled} onPress={() => onConfirm(Number(text))} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Card>
  );
}

export function AddPlayerSheet({
  teams,
  onCancel,
  onConfirm,
  disabled,
}: {
  teams: { id: string; name: string }[];
  onCancel: () => void;
  onConfirm: (team: string, name: string) => void;
  disabled?: boolean;
}) {
  const { spacing } = useTheme();
  const [name, setName] = useState('');
  const [team, setTeam] = useState(teams[0]?.id ?? '');
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">Add a player</Text>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {teams.map((t) => (
            <Button
              key={t.id}
              label={t.name}
              variant={team === t.id ? 'primary' : 'secondary'}
              onPress={() => setTeam(t.id)}
            />
          ))}
        </View>
        <Button
          label="Add"
          disabled={disabled || !name.trim()}
          onPress={() => onConfirm(team, name.trim())}
        />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Card>
  );
}
