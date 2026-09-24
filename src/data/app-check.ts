import type { FirebaseApp } from 'firebase/app';
import { emulatorHost } from './config';

/**
 * Proves requests come from this app. Not enforced on the live database until cutover
 * (the v1 site has no App Check token). Skips when no site key is configured.
 */
export async function initAppCheck(app: FirebaseApp): Promise<void> {
  if (emulatorHost()) return;
  const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return;

  const debug = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (debug && typeof globalThis !== 'undefined') {
    (
      globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = debug === 'true' ? true : debug;
  }

  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
