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
