import AsyncStorage from '@react-native-async-storage/async-storage';
import { replay, type MatchEvent } from '@/domain';
import { toMatchSetup } from '@/data';
import type { MatchView } from '../matches/match-view';

export interface PendingWrite {
  event: MatchEvent;
  playerName?: string;
}

const storageKey = (matchId: string) => `cricky:score-queue:${matchId}`;

export async function loadQueue(matchId: string): Promise<PendingWrite[]> {
  const raw = await AsyncStorage.getItem(storageKey(matchId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingWrite);
  } catch {
    return [];
  }
}

export async function saveQueue(matchId: string, items: PendingWrite[]): Promise<void> {
  if (items.length === 0) {
    await AsyncStorage.removeItem(storageKey(matchId));
    return;
  }
  await AsyncStorage.setItem(storageKey(matchId), JSON.stringify(items));
}

/** Replays the server match plus queued events so the pad can keep scoring offline. */
export function overlayQueue(view: MatchView, queue: PendingWrite[]): MatchView {
  if (queue.length === 0) return view;
  const events = [...view.events, ...queue.map((item) => item.event)];
  const extraNames: Record<string, string> = {};
  for (const item of queue) {
    if (item.event.type === 'add_player' && item.playerName) {
      extraNames[item.event.player] = item.playerName;
    }
  }
  const state = replay(toMatchSetup(view.meta), events);
  return {
    ...view,
    head: view.head + queue.length,
    events,
    state,
    innings: state.innings.filter((inn) => inn.battingOrder.length > 0),
    live: null,
    playerName: (id) => extraNames[id] ?? view.playerName(id),
  };
}

export function popQueue(queue: PendingWrite[]): PendingWrite[] {
  return queue.slice(0, -1);
}

function isPendingWrite(value: unknown): value is PendingWrite {
  return (
    typeof value === 'object' &&
    value !== null &&
    'event' in value &&
    typeof (value as PendingWrite).event === 'object' &&
    (value as PendingWrite).event !== null &&
    typeof (value as PendingWrite).event.type === 'string'
  );
}
