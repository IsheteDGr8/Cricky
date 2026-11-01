import { auditProblems, type AllowedAdvisory } from '../audit-gate';

const advisory = (name: string, severity: string, id: string) => ({
  name,
  severity,
  title: `${name} problem`,
  url: `https://github.com/advisories/${id}`,
});

const report = {
  vulnerabilities: {
    zod: { via: [advisory('zod', 'high', 'GHSA-zod')] },
    expo: { via: ['zod'] },
    uuid: { via: [advisory('uuid', 'moderate', 'GHSA-uuid')] },
  },
};

const allow = (expires: string): AllowedAdvisory[] => [
  { advisory: 'GHSA-zod', package: 'zod', reason: 'build tool only', expires },
];

describe('auditProblems', () => {
  it('blocks an unlisted high advisory and ignores moderate ones', () => {
    expect(auditProblems(report, [], '2026-11-01')).toEqual([
      'high zod: zod problem (https://github.com/advisories/GHSA-zod)',
    ]);
  });

  it('passes an allowlisted advisory before it expires', () => {
    expect(auditProblems(report, allow('2026-12-31'), '2026-11-01')).toEqual([]);
  });

  it('fails once the allowlist entry has expired', () => {
    expect(auditProblems(report, allow('2026-10-31'), '2026-11-01')).toEqual([
      'Allowlist entry GHSA-zod (zod) expired on 2026-10-31',
      'high zod: zod problem (https://github.com/advisories/GHSA-zod)',
    ]);
  });

  it('blocks a critical advisory even if another package is allowlisted', () => {
    const withCritical = {
      vulnerabilities: {
        ...report.vulnerabilities,
        'shell-quote': { via: [advisory('shell-quote', 'critical', 'GHSA-sq')] },
      },
    };
    expect(auditProblems(withCritical, allow('2026-12-31'), '2026-11-01')).toEqual([
      'critical shell-quote: shell-quote problem (https://github.com/advisories/GHSA-sq)',
    ]);
  });
});
