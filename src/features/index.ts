export { DataProvider, useDataLayer } from './data-provider';
export { useLegacyMatchRedirect } from './legacy-hash';
export { initMonitoring, reportError } from './monitoring';
export { Loaded } from './Loaded';
export { combine, mapLoadable, useSubscription, type Loadable } from './loadable';
export { copyText, matchPathFromHash, scorerPath, shareLink, type ShareOutcome } from './share';
export { HowItWorks } from './HowItWorks';
export { LiveCard } from './matches/LiveCard';
export { AdminGate } from './admin/AdminGate';
export { Choice, PLAYOFF_FORMATS, type ChoiceOption } from './admin/Choice';
export { AdminHub } from './admin/AdminHub';
export { MatchWizard, type MatchWizardProps } from './admin/MatchWizard';
export { ScorerCodePanel, spacedCode } from './admin/ScorerCodePanel';
export { TournamentControl } from './admin/TournamentControl';
export { nextStep, type NextStep } from './admin/next-step';
export { ShareButton } from './ShareButton';
export { ScopePicker, scopeFromKey } from './ScopePicker';

export { Commentary } from './matches/Commentary';
export { MatchCentre } from './matches/MatchCentre';
export { MatchSummaryCard } from './matches/MatchSummaryCard';
export { MatchCard } from './matches/MatchCard';
export { OverTimeline } from './matches/OverTimeline';
export { ScoreHeader } from './matches/ScoreHeader';
export { Scorecard } from './matches/Scorecard';
export { WormChart } from './matches/WormChart';
export {
  scopeKey,
  useMatch,
  useRecentMatches,
  useScopedMatches,
  type MatchLists,
  type MatchScope,
} from './matches/hooks';
export type { LiveFigures, MatchView } from './matches/match-view';

export { StatsBoard } from './stats/StatsBoard';
export { useStats } from './stats/hooks';
export type { StatsView } from './stats/build-stats';

export { Leaders } from './tournaments/Leaders';
export { Playoffs } from './tournaments/Playoffs';
export { Squads } from './tournaments/Squads';
export { Standings } from './tournaments/Standings';
export { TournamentCard } from './tournaments/TournamentCard';
export { useTournament, useTournaments } from './tournaments/hooks';
export type { GroupTable, TournamentView } from './tournaments/tournament-view';

export { useSession, isStaff } from './session';
export type { Session } from '@/data';
export { confirmAction } from './confirm';
export { newRecordId } from './ids';

export { CodeEntry } from './scoring/CodeEntry';
export { ScorePad } from './scoring/ScorePad';
export {
  commitEvent,
  commitUndo,
  parseCodeInput,
  parseMatchRef,
  publishDerived,
} from './scoring/commit';
export { useAlreadyScorer, useRedeemCode, useScoreActions } from './scoring/hooks';

export { useAdminSignIn, useIsStaff } from './admin/hooks';
export {
  parseMatchForm,
  parsePlayerNames,
  parseQuickTeams,
  parseTeamForm,
  parseTournamentForm,
} from './admin/forms';
export type { PlayoffFormat, Stage } from '@/data';
export type { TossDecision } from '@/domain';
