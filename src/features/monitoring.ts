/**
 * Crash reporting. No-ops until EXPO_PUBLIC_SENTRY_DSN is set (free Sentry project).
 * The package is optional at runtime so tests and local web still start without it.
 */
type SentryClient = {
  init: (options: {
    dsn: string;
    enabled: boolean;
    tracesSampleRate: number;
    sendDefaultPii: boolean;
  }) => void;
  captureException: (error: unknown) => void;
};

let client: SentryClient | null = null;

export function initMonitoring(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || client) return;
  void import('@sentry/react-native')
    .then((mod) => {
      const Sentry = mod as SentryClient;
      Sentry.init({
        dsn,
        enabled: true,
        tracesSampleRate: 0,
        sendDefaultPii: false,
      });
      client = Sentry;
    })
    .catch(() => {
      // Native module missing (Jest, or web without a rebuild). Errors stay local.
    });
}

export function reportError(error: unknown): void {
  client?.captureException(error);
}
