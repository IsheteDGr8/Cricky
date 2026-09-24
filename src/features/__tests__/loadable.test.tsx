import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Listener } from '@/data';
import { combine, mapLoadable, useSubscription, type Loadable } from '../loadable';

type Subscriber = { key: string; listener: Listener<number>; stopped: boolean };

function Probe({ id, subscribers }: { id: string; subscribers: Subscriber[] }) {
  const value = useSubscription<number>(id, (listener) => {
    const sub = { key: id, listener, stopped: false };
    subscribers.push(sub);
    return () => {
      sub.stopped = true;
    };
  });
  return <Text>{value.status === 'ready' ? `${id}:${value.data}` : value.status}</Text>;
}

describe('useSubscription', () => {
  it('shows loading, then each value, then the error', async () => {
    const subs: Subscriber[] = [];
    await render(<Probe id="a" subscribers={subs} />);
    expect(screen.getByText('loading')).toBeTruthy();

    await act(() => subs[0]?.listener.onData(1));
    expect(screen.getByText('a:1')).toBeTruthy();
    await act(() => subs[0]?.listener.onError?.(new Error('offline')));
    expect(screen.getByText('error')).toBeTruthy();
  });

  it('re-subscribes when the key changes and ignores the old subscription', async () => {
    const subs: Subscriber[] = [];
    const view = await render(<Probe id="a" subscribers={subs} />);
    await act(() => subs[0]?.listener.onData(1));

    await view.rerender(<Probe id="b" subscribers={subs} />);
    expect(subs[0]?.stopped).toBe(true);
    expect(screen.getByText('loading')).toBeTruthy();

    await act(() => subs[0]?.listener.onData(99));
    expect(screen.getByText('loading')).toBeTruthy();
    await act(() => subs.find((s) => s.key === 'b')?.listener.onData(2));
    expect(screen.getByText('b:2')).toBeTruthy();
  });

  it('unsubscribes on unmount', async () => {
    const subs: Subscriber[] = [];
    const view = await render(<Probe id="a" subscribers={subs} />);
    await view.unmount();
    expect(subs.every((s) => s.stopped)).toBe(true);
  });
});

describe('combine and mapLoadable', () => {
  const ready = <T,>(data: T): Loadable<T> => ({ status: 'ready', data });
  const loading: Loadable<never> = { status: 'loading' };
  const failed: Loadable<never> = { status: 'error', error: new Error('no') };

  it('is ready only when every input is, and reports the first error', () => {
    expect(combine(ready(1), ready('x'))).toEqual(ready([1, 'x']));
    expect(combine(ready(1), loading)).toEqual(loading);
    expect(combine(loading, failed)).toBe(failed);
  });

  it('turns a throwing derivation into an error', () => {
    expect(mapLoadable(ready(2), (n) => n * 2)).toEqual(ready(4));
    const result = mapLoadable(ready(2), () => {
      throw new Error('bad events');
    });
    expect(result).toEqual({ status: 'error', error: new Error('bad events') });
    expect(mapLoadable(loading, () => 1)).toBe(loading);
  });
});
