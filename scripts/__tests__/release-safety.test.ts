import { readFileSync } from 'node:fs';

const live = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
  hosting: { public: string };
  database: { rules: string };
};
const next = JSON.parse(readFileSync('firebase.next.json', 'utf8')) as {
  hosting: { public: string };
  database: { rules: string };
};
const cutover = JSON.parse(readFileSync('firebase.cutover.json', 'utf8')) as {
  hosting: { public: string };
  database: { rules: string };
};
const expo = JSON.parse(readFileSync('app.json', 'utf8')) as {
  expo: { android: { package: string; versionCode: number; allowBackup: boolean } };
};
const eas = JSON.parse(readFileSync('eas.json', 'utf8')) as {
  build: { preview: { android: { buildType: string } } };
};

describe('live Firebase config', () => {
  it('still serves the v1 site and legacy rules', () => {
    expect(live.hosting.public).toBe('legacy');
    expect(live.database.rules).toBe('firebase/legacy.rules.json');
  });

  it('keeps the next Hosting config off production rules', () => {
    expect(next.hosting.public).toBe('dist');
    expect(next.database.rules).toBe('firebase/legacy.rules.json');
  });

  it('keeps the cutover config unused until an operator runs it', () => {
    expect(cutover.hosting.public).toBe('dist');
    expect(cutover.database.rules).toBe('firebase/database.rules.json');
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
