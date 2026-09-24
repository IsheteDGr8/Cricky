import type { DeliveryEvent, PlayerId } from '@/domain';
import type { BallEntry } from './legacy';

/** Most letters a commentary name may differ from today's name (players renamed since). */
const MAX_RENAME_DISTANCE = 3;

/**
 * Looks up players of one team by the name the v1 app printed in commentary.
 * Players renamed since are matched to the closest current name, and remembered in `renamed`.
 */
export class Roster {
  private readonly byName = new Map<string, PlayerId>();
  private readonly ambiguous = new Set<string>();
  readonly renamed = new Map<string, PlayerId>();
  /** Known names, longest first so "Vivek Sama" is not read as "Vivek"; then any name. */
  readonly pattern: string;

  constructor(private readonly names: Readonly<Record<PlayerId, string>>) {
    for (const [id, name] of Object.entries(names)) {
      const key = normalize(name);
      if (this.byName.has(key)) this.ambiguous.add(key);
      this.byName.set(key, id);
    }
    const known = Object.values(names)
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    this.pattern = [...known, '[^.!,]+?'].join('|');
  }

  id(name: string): PlayerId {
    const key = normalize(name);
    if (this.ambiguous.has(key)) throw new Error(`Two players are called "${name}"`);
    const exact = this.byName.get(key);
    if (exact) return exact;

    const ranked = Object.entries(this.names)
      .map(([id, current]) => ({ id, distance: editDistance(key, normalize(current)) }))
      .sort((a, b) => a.distance - b.distance);
    const [best, second] = ranked;
    if (
      best &&
      best.distance <= MAX_RENAME_DISTANCE &&
      (!second || second.distance > best.distance)
    ) {
      this.renamed.set(name, best.id);
      return best.id;
    }
    throw new Error(`No player called "${name}"`);
  }
}

export interface ParsedBall {
  bowler: PlayerId;
  striker: PlayerId;
  delivery: DeliveryEvent;
  /** After a wicket, who the commentary says came in; null when it says "All out". */
  nextBatter?: PlayerId | null;
}

/**
 * Reads one ball of v1 commentary, e.g. "Sanjay Nagesh to Arhum Palresha. 4 runs." with label 4.
 * The label says what happened; the text says who bowled, who faced and, for wickets, who was out.
 */
export function parseBall(entry: BallEntry, bowling: Roster, batting: Roster): ParsedBall {
  const text = entry.text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const head = new RegExp(
    `^(${bowling.pattern}) to (?:Captain )?(${batting.pattern})\\. (.*)$`,
  ).exec(text);
  if (!head) throw new Error(`Unrecognised commentary: "${text}"`);
  const [, bowlerName = '', strikerName = '', rest = ''] = head;
  const bowler = bowling.id(bowlerName);
  const striker = batting.id(strikerName);
  const label = entry.label.trim();

  const extra = /^(NB|WD)(?:\+(\d+))?$/.exec(label);
  if (extra) {
    return {
      bowler,
      striker,
      delivery: {
        type: 'delivery',
        runs: Number(extra[2] ?? 0),
        extra: extra[1] === 'NB' ? 'no_ball' : 'wide',
      },
    };
  }
  const bye = /^B(\d+)$/.exec(label);
  if (bye) {
    const runs = Number(bye[1]);
    // v1 allowed "0 byes", which is just a dot ball.
    const delivery: DeliveryEvent =
      runs > 0 ? { type: 'delivery', runs, extra: 'bye' } : { type: 'delivery', runs: 0 };
    return { bowler, striker, delivery };
  }
  if (/^\d+$/.test(label)) {
    return { bowler, striker, delivery: { type: 'delivery', runs: Number(label) } };
  }
  if (label.startsWith('W')) {
    return { bowler, striker, ...parseWicket(rest, striker, bowling, batting) };
  }
  throw new Error(`Unrecognised ball label "${label}"`);
}

function parseWicket(
  text: string,
  striker: PlayerId,
  bowling: Roster,
  batting: Roster,
): Pick<ParsedBall, 'delivery' | 'nextBatter'> {
  const next = new RegExp(
    `(?:^|[.!] )(?:(${batting.pattern}) (?:is coming )?in next|All out)\\.$`,
  ).exec(text);
  if (!next) throw new Error(`Can't tell who batted next: "${text}"`);
  const nextBatter = next[1] ? batting.id(next[1]) : null;

  const runOut = new RegExp(
    `^(?:Throw by (${bowling.pattern}), )?(?:Captain )?(${batting.pattern}) RUN OUT`,
  ).exec(text);
  if (runOut) {
    const fielder = runOut[1] ? bowling.id(runOut[1]) : undefined;
    return {
      nextBatter,
      delivery: {
        type: 'delivery',
        runs: 0,
        wicket: {
          kind: 'run_out',
          playerOut: batting.id(runOut[2] ?? ''),
          ...(fielder ? { fielder } : {}),
        },
      },
    };
  }
  const caught = new RegExp(`^Caught by (${bowling.pattern})!`).exec(text);
  if (caught) {
    return {
      nextBatter,
      delivery: {
        type: 'delivery',
        runs: 0,
        wicket: { kind: 'caught', playerOut: striker, fielder: bowling.id(caught[1] ?? '') },
      },
    };
  }
  // v1 recorded every other dismissal as "Bowled!" (earlier versions: "OUT!").
  if (/^(Bowled|OUT)!/.test(text)) {
    return {
      nextBatter,
      delivery: { type: 'delivery', runs: 0, wicket: { kind: 'bowled', playerOut: striker } },
    };
  }
  throw new Error(`Unrecognised wicket: "${text}"`);
}

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
