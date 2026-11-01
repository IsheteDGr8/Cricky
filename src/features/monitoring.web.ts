import { parseSentryDsn, type SentryIngest } from './sentry-dsn';

let ingest: SentryIngest | null = null;
let hooked = false;

function eventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function send(payload: Record<string, unknown>): void {
  if (!ingest) return;
  void fetch(ingest.storeUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=cricky/2.0.0, sentry_key=${ingest.key}`,
    },
  }).catch(() => {
    // Offline or blocked; the error already happened in the app.
  });
}

function exceptionPayload(error: unknown): Record<string, unknown> {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    environment: 'production',
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? { frames: [{ filename: 'app', function: err.stack }] }
            : undefined,
        },
      ],
    },
    request: typeof location === 'undefined' ? undefined : { url: location.href },
  };
}

/** Starts Sentry on the website. No-ops until `EXPO_PUBLIC_SENTRY_DSN` is set at build time. */
export function initMonitoring(): void {
  if (ingest) return;
  const parsed = parseSentryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN ?? '');
  if (!parsed) return;
  ingest = parsed;
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason);
  });
}

export function reportError(error: unknown): void {
  if (!ingest) return;
  send(exceptionPayload(error));
}
