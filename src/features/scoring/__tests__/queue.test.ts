import { ev } from '@/domain/__fixtures__/scoring';
import { buildMatchView } from '../../matches/match-view';
import { snapshot } from '../../__fixtures__/data';
import { overlayQueue, popQueue } from '../queue';

describe('overlayQueue', () => {
  it('leaves the view alone when nothing is queued', () => {
    const view = buildMatchView(snapshot([ev.openers('a1', 'a2'), ev.bowler('b1')]));
    expect(overlayQueue(view, [])).toBe(view);
  });

  it('replays queued deliveries on top of the server events', () => {
    const view = buildMatchView(snapshot([ev.openers('a1', 'a2'), ev.bowler('b1')]));
    const next = overlayQueue(view, [{ event: ev.runs(4) }, { event: ev.runs(1) }]);
    expect(next.head).toBe(view.head + 2);
    expect(next.state.innings[0]?.runs).toBe(5);
  });

  it('pops the last queued write for offline undo', () => {
    const queue = [{ event: ev.runs(4) }, { event: ev.runs(1) }];
    expect(popQueue(queue)).toEqual([{ event: ev.runs(4) }]);
  });
});
