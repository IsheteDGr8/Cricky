import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ev } from '@/domain/__fixtures__/scoring';
import type { MatchResultRecord, MatchSummary } from '@/data';
import { AppThemeProvider } from '@/ui';
import {
  Commentary,
  DataProvider,
  Leaders,
  Loaded,
  MatchCard,
  Playoffs,
  ScoreHeader,
  ScorePad,
  Scorecard,
  Standings,
  useMatch,
  useTournament,
} from '..';
import {
  fakeDataLayer,
  listed,
  result,
  snapshot,
  summary,
  teams,
  tournament,
} from '../__fixtures__/data';

const layer = fakeDataLayer({
  tournaments: [tournament],
  teams,
  results: listed<MatchResultRecord>([result]),
  summaries: listed<MatchSummary>([summary()]),
  matches: { m1: snapshot() },
});

const wrap = (children: ReactNode) =>
  render(
    <DataProvider value={layer}>
      <AppThemeProvider scheme="light">{children}</AppThemeProvider>
    </DataProvider>,
  );

function MatchPage({ id }: { id: string }) {
  const match = useMatch(id);
  return (
    <Loaded value={match}>
      {(view) => (
        <>
          <ScoreHeader view={view} />
          <Scorecard view={view} />
          <Commentary view={view} />
        </>
      )}
    </Loaded>
  );
}

function TournamentPage() {
  const view = useTournament('t1');
  return (
    <Loaded value={view}>
      {(v) => (
        <>
          <Standings view={v} />
          <Playoffs view={v} />
          <Leaders view={v} />
        </>
      )}
    </Loaded>
  );
}

describe('match components', () => {
  it('shows the result, scorecard and commentary of a match', async () => {
    await wrap(<MatchPage id="m1" />);
    expect(screen.getByText('Huskies won by 12 runs')).toBeTruthy();
    expect(screen.getByText('Player of the match: Asha')).toBeTruthy();
    expect(screen.getByLabelText('Huskies batting')).toBeTruthy();
    expect(screen.getAllByText('not out').length).toBe(4);
    expect(screen.getAllByText('Asha to Bea, no run')).toHaveLength(6);
  });

  it('explains a missing match', async () => {
    await wrap(<MatchPage id="nope" />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Match nope not found')).toBeTruthy();
  });

  it('lists the side that batted first on top', async () => {
    const onPress = jest.fn();
    const chased = summary({
      innings: [
        { battingTeam: 'B', runs: 70, wickets: 4, legalBalls: 48 },
        { battingTeam: 'A', runs: 69, wickets: 5, legalBalls: 48 },
      ],
      result: { kind: 'win', winner: 'B', by: 'runs', margin: 1 },
    });
    await wrap(<MatchCard match={chased} onPress={onPress} />);
    const names = screen.getAllByText(/^(Huskies|Eagles)$/).map((n) => n.props.children);
    expect(names).toEqual(['Eagles', 'Huskies']);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('score pad', () => {
  it('offers runs when the next action is a delivery', async () => {
    const live = fakeDataLayer({
      matches: { live: snapshot([ev.openers('a1', 'a2'), ev.bowler('b1')], 'live') },
    });
    function Pad() {
      const match = useMatch('live');
      return <Loaded value={match}>{(view) => <ScorePad view={view} />}</Loaded>;
    }
    await render(
      <DataProvider value={live}>
        <AppThemeProvider scheme="light">
          <Pad />
        </AppThemeProvider>
      </DataProvider>,
    );
    expect(await screen.findByText('This ball')).toBeTruthy();
    expect(screen.getByLabelText('4 runs')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('4 runs'));
  });
});

describe('tournament components', () => {
  it('shows standings, the playoff final and leaders', async () => {
    await wrap(<TournamentPage />);
    expect(screen.getByLabelText('Group A standings')).toBeTruthy();
    expect(screen.getByText('1. Huskies')).toBeTruthy();
    expect(screen.getByText('Final')).toBeTruthy();
    expect(screen.getByLabelText('Most runs')).toBeTruthy();
    expect(screen.getAllByText('Asha').length).toBeGreaterThan(0);
  });
});
