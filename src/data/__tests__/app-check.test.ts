import { initAppCheck } from '../app-check';

describe('initAppCheck', () => {
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  const key = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;

  afterEach(() => {
    restore('EXPO_PUBLIC_FIREBASE_EMULATOR_HOST', host);
    restore('EXPO_PUBLIC_RECAPTCHA_SITE_KEY', key);
  });

  it('does nothing against the emulator or when no site key is set', async () => {
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = '127.0.0.1';
    process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY = 'test-key';
    await expect(initAppCheck({} as never)).resolves.toBeUndefined();

    delete process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
    delete process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
    await expect(initAppCheck({} as never)).resolves.toBeUndefined();
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
