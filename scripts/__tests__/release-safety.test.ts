import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface HostingConfig {
  hosting: {
    public: string;
    ignore?: string[];
    cleanUrls?: boolean;
    rewrites?: { source: string; destination: string }[];
  };
  database: { rules: string };
}

const live = JSON.parse(readFileSync('firebase.json', 'utf8')) as HostingConfig;
const legacy = JSON.parse(readFileSync('firebase.legacy.json', 'utf8')) as HostingConfig;
const expo = JSON.parse(readFileSync('app.json', 'utf8')) as {
  expo: { android: { package: string; versionCode: number; allowBackup: boolean } };
};
const eas = JSON.parse(readFileSync('eas.json', 'utf8')) as {
  build: { preview: { android: { buildType: string } } };
};

describe('live Firebase config', () => {
  it('serves the Expo web export with the new rules', () => {
    expect(live.hosting.public).toBe('dist');
    expect(live.database.rules).toBe('firebase/database.rules.json');
  });

  it('uploads icon fonts and app-link files', () => {
    const ignore = live.hosting.ignore ?? [];
    expect(ignore).not.toContain('**/node_modules/**');
    expect(ignore).not.toContain('**/.*');
  });

  it('serves each route its own pre-rendered page', () => {
    expect(live.hosting.cleanUrls).toBe(true);
    const rewrites = live.hosting.rewrites ?? [];
    for (const route of ['match', 'tournament', 'score', 'admin/tournament']) {
      expect(rewrites).toContainEqual({
        source: `/${route}/*`,
        destination: `/${route}/[id].html`,
      });
    }
    expect(rewrites.at(-1)).toEqual({ source: '**', destination: '/+not-found.html' });
  });

  it('keeps the v1 config only for rollback', () => {
    expect(legacy.hosting.public).toBe('legacy');
    expect(legacy.database.rules).toBe('firebase/legacy.rules.json');
  });
});

describe('web export', () => {
  const dist = 'dist';
  const exported = existsSync(join(dist, 'index.html'));

  (exported ? it : it.skip)('has a page for every rewrite destination', () => {
    for (const rewrite of live.hosting.rewrites ?? []) {
      expect(existsSync(join(dist, rewrite.destination))).toBe(true);
    }
  });
});

describe('Android preview APK', () => {
  it('ships an internal APK for com.ishete.cricky', () => {
    expect(expo.expo.android.package).toBe('com.ishete.cricky');
    expect(expo.expo.android.versionCode).toBeGreaterThanOrEqual(1);
    expect(expo.expo.android.allowBackup).toBe(false);
    expect(eas.build.preview.android.buildType).toBe('apk');
  });
});
