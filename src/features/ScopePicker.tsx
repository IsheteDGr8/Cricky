import { Select, type SelectOption } from '@/ui';
import { scopeKey, type MatchScope } from './matches/hooks';
import { useTournaments } from './tournaments/hooks';

export function scopeFromKey(key: string): MatchScope {
  if (key === 'quick') return { kind: 'quick' };
  if (key.startsWith('tournament:')) return { kind: 'tournament', id: key.slice(11) };
  return { kind: 'all' };
}

const STATUS_TEXT = {
  upcoming: 'Upcoming',
  active: 'In progress',
  complete: 'Finished',
  archived: 'Archived',
} as const;

/** Dropdown for "all matches", "quick matches" or one tournament, newest tournaments first. */
export function ScopePicker({
  value,
  onChange,
  allLabel = 'All matches',
}: {
  value: MatchScope;
  onChange: (scope: MatchScope) => void;
  allLabel?: string;
}) {
  const tournaments = useTournaments();
  const list = tournaments.status === 'ready' ? tournaments.data : [];
  const options: SelectOption<string>[] = [
    { value: 'all', label: allLabel, icon: 'albums-outline' },
    {
      value: 'quick',
      label: 'Quick matches',
      detail: 'One-off games outside tournaments',
      icon: 'flash-outline',
    },
    ...[...list]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        value: scopeKey({ kind: 'tournament', id: t.id }),
        label: t.name,
        detail: `${STATUS_TEXT[t.status]} · ${t.oversDefault} overs`,
        icon: 'trophy-outline' as const,
      })),
  ];
  const key = scopeKey(value);
  if (!options.some((o) => o.value === key)) {
    options.push({ value: key, label: 'Loading tournament…', icon: 'trophy-outline' });
  }
  return (
    <Select
      label="Showing"
      options={options}
      value={key}
      onChange={(next) => onChange(scopeFromKey(next))}
    />
  );
}
