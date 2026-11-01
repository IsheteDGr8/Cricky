import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Jest resolves the .native file, so the web module is checked as source.
const web = readFileSync(join(__dirname, '..', 'auth-persistence.ts'), 'utf8');

describe('web auth dependencies', () => {
  it('include the popup resolver Google sign-in needs', () => {
    expect(web).toMatch(/popupRedirectResolver:\s*browserPopupRedirectResolver/);
  });

  it('keep the session in localStorage', () => {
    expect(web).toMatch(/persistence:\s*browserLocalPersistence/);
  });
});
