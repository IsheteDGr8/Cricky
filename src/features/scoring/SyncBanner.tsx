import { Card, Text } from '@/ui';

export type SyncStatus = 'online' | 'offline' | 'queued' | 'syncing';

const COPY: Record<SyncStatus, string> = {
  online: 'Online — each ball is saved as you score.',
  offline: 'Offline — balls stay on this device until you reconnect.',
  queued: 'Offline — queued balls will upload when you are back online.',
  syncing: 'Uploading queued balls…',
};

/** Visible connection / queue state on the scoring pad. */
export function SyncBanner({ status, queued }: { status: SyncStatus; queued: number }) {
  const tone = status === 'online' ? 'textMuted' : status === 'syncing' ? 'info' : 'warning';
  const text =
    status === 'queued' || status === 'offline'
      ? queued > 0
        ? `${COPY.queued} (${queued} waiting)`
        : COPY.offline
      : COPY[status];
  return (
    <Card>
      <Text color={tone} accessibilityLiveRegion="polite">
        {text}
      </Text>
    </Card>
  );
}
