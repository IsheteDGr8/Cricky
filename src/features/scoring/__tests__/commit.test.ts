import { ev } from '@/domain/__fixtures__/scoring';
import { buildMatchView } from '../../matches/match-view';
import { snapshot } from '../../__fixtures__/data';
import { commitEvent, commitUndo, parseMatchRef, type Publishable } from '../commit';

function recorder(): Publishable & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    append: async (_id, head, event) => {
      calls.push(`append ${head} ${event.type}`);
    },
    undo: async (_id, head) => {
      calls.push(`undo ${head}`);
    },
    publishSummary: async (_id, _meta, state) => {
      calls.push(`summary ${state.status}`);
    },
    publishResult: async () => {
      calls.push('result');
    },
    clearResult: async () => {
      calls.push('clear');
    },
    setLocked: async (_id, locked) => {
      calls.push(`lock ${locked}`);
    },
  };
}

describe('parseMatchRef', () => {
  it('reads an id from links and bare ids', () => {
    expect(parseMatchRef('https://app.example/match/-OmfXyHFYX11YWaDmxEL')).toBe(
      '-OmfXyHFYX11YWaDmxEL',
    );
    expect(parseMatchRef('cricky://score/abc123xyz')).toBe('abc123xyz');
    expect(parseMatchRef('  abc123xyz  ')).toBe('abc123xyz');
    expect(parseMatchRef('nope')).toBeNull();
  });
});

describe('commitEvent', () => {
  it('rejects an illegal event before writing', async () => {
    const matches = recorder();
    await expect(
      commitEvent(matches, buildMatchView(snapshot([])), ev.runs(4)),
    ).rejects.toMatchObject({ name: 'ScoringError', code: 'openers_required' });
    expect(matches.calls).toEqual([]);
  });

  it('appends and publishes a live summary after a legal ball', async () => {
    const view = buildMatchView(snapshot([ev.openers('a1', 'a2'), ev.bowler('b1')]));
    const matches = recorder();
    const next = await commitEvent(matches, view, ev.runs(4));
    expect(next.innings[0]?.runs).toBe(4);
    expect(matches.calls).toEqual(['append 2 delivery', 'summary in_progress']);
  });

  it('publishes the result and locks after Player of the Match', async () => {
    const events = snapshot().events.slice(0, -1);
    const view = buildMatchView(snapshot(events));
    const matches = recorder();
    await commitEvent(matches, view, ev.potm('a1'));
    expect(matches.calls).toEqual([
      `append ${view.head} set_player_of_match`,
      'summary complete',
      'result',
      'lock true',
    ]);
  });
});

describe('commitUndo', () => {
  it('removes the last event and clears a finished result', async () => {
    const view = buildMatchView(snapshot());
    const matches = recorder();
    const next = await commitUndo(matches, view);
    expect(next.playerOfMatch).toBeNull();
    expect(next.status).toBe('complete');
    expect(matches.calls[0]).toBe(`undo ${view.head}`);
    expect(matches.calls).toContain('result');
  });
});
