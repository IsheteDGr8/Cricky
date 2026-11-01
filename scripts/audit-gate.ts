/**
 * Fails CI on any high or critical advisory in production dependencies, except ones listed in
 * .github/audit-allowlist.json with a reason and an expiry date. Expired entries fail too.
 *
 *   npm run audit:gate
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface AllowedAdvisory {
  advisory: string;
  package: string;
  reason: string;
  expires: string;
}

interface Advisory {
  name: string;
  severity: string;
  url: string;
  title: string;
}

interface AuditReport {
  vulnerabilities?: Record<string, { via: (string | Advisory)[] }>;
}

const BLOCKING = new Set(['high', 'critical']);

/** Problems that should fail the build; empty means the gate passes. */
export function auditProblems(
  report: AuditReport,
  allowlist: readonly AllowedAdvisory[],
  today: string,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of allowlist) {
    if (entry.expires < today) {
      problems.push(
        `Allowlist entry ${entry.advisory} (${entry.package}) expired on ${entry.expires}`,
      );
    }
  }

  for (const { via } of Object.values(report.vulnerabilities ?? {})) {
    for (const item of via) {
      if (typeof item === 'string' || !BLOCKING.has(item.severity)) continue;
      const id = item.url.split('/').pop() ?? item.url;
      if (seen.has(id)) continue;
      seen.add(id);
      const allowed = allowlist.find((a) => a.advisory === id && a.package === item.name);
      if (!allowed || allowed.expires < today) {
        problems.push(`${item.severity} ${item.name}: ${item.title} (${item.url})`);
      }
    }
  }
  return problems;
}

function main(): void {
  const audit = spawnSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!audit.stdout) {
    console.error(`npm audit produced no output: ${audit.stderr}`);
    process.exit(2);
  }
  const allowlist = JSON.parse(
    readFileSync('.github/audit-allowlist.json', 'utf8'),
  ) as AllowedAdvisory[];
  const today = new Date().toISOString().slice(0, 10);
  const problems = auditProblems(JSON.parse(audit.stdout) as AuditReport, allowlist, today);

  if (problems.length > 0) {
    for (const line of problems) console.error(line);
    process.exit(1);
  }
  console.log(
    `No unapproved high or critical advisories (${allowlist.length} allowlisted until reviewed).`,
  );
}

if (require.main === module) main();
