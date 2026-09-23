// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAzIFrKBsY2iwHRdFAPzE4NrincGKv8iyE",
  authDomain: "cricky-cricket-analysis.firebaseapp.com",
  projectId: "cricky-cricket-analysis",
  storageBucket: "cricky-cricket-analysis.firebasestorage.app",
  messagingSenderId: "42341049471",
  appId: "1:42341049471:web:f95eca1eddbf492b1d0b4a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
// Persist auth across reloads so an iPad signed in once stays signed in
// until the admin taps "Sign Out" explicitly.
try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (_) {}

// --- STATE ---
const DEFAULT_MAX_WICKETS = 10; // fallback for when a team's roster isn't loaded yet
const QUICK_MATCH_PREVIEW_COUNT = 5;
const DEFAULT_TOURNAMENT_KEY = 'default';

// The number of wickets that ends an innings = (registered players on the
// batting team) - 1, because the last batter has no partner. This lets a team
// with 13 registered players actually use all 13 over time, while still
// auto-ending the innings only when the squad is truly exhausted.
function maxWicketsFor(teamId) {
    const players = teamsCache[teamId]?.players;
    const size = players ? Object.keys(players).length : 0;
    return size > 1 ? size - 1 : DEFAULT_MAX_WICKETS;
}

let isAdmin = false;
let currentAdminUser = null;         // firebase.User when signed in, null when signed out
let persistedTeamsCache = {};        // teams that live in /teams/ in Firebase (real / reusable)
let teamsCache = {};                 // persisted teams + ephemeral quick-match teams merged in
let tournamentsCache = {};           // { tid: { name, status, oversDefault, playoffs } }
let matchesCache = {};               // { mid: match }
let matchPinsCache = {};             // { mid: { pin } } - only populated when admin is signed in
let matchPinsListener = null;        // detach handle for the /matchPins listener
let pinMigrationAttempted = false;   // run legacy pin migration at most once per session
let currentTournamentId = null;      // tournament being viewed in detail
let currentMatchId = null;
let currentMatch = null;
let isScoringUnlocked = false;
let currentMatchTab = 'scorecard';
let currentInningTab = 1;
let currentStageView = 'groups';
let currentTournamentSubTab = 'standings';
let currentMatchFilter = 'all';      // 'all' | 'quick' | <tid>
let currentViewingTeamId = null;
let lastViewBeforeTeam = 'view-tournaments';
let selectionMode = '';

// Initial sync flags so we run migration exactly once after first data is loaded.
let migrationAttempted = false;
let syncedFlags = { tournaments: false, teams: false, matches: false };

// =====================================================================
// AUTH  (4-digit PIN backed by Firebase Authentication)
// =====================================================================
//
// SECURITY MODEL
// --------------
// * All writes to /tournaments, /teams, /matches, /matchPins, /playoffs are
//   gated by Firebase Security Rules (`auth != null`). The client cannot
//   bypass them by tapping admin buttons — the database itself rejects
//   unauthenticated writes.
// * `isAdmin` here is just a UI flag derived from the Firebase Auth
//   session. We never use it as a security boundary; the rules do.
// * Sign-in UX is a single 4-digit PIN, but underneath it's a real Firebase
//   email/password sign-in. The PIN is converted to a Firebase password
//   via PIN_TO_PASSWORD() and sent to Firebase Auth. The corresponding user
//   must exist in the Firebase project — without it, the sign-in fails and
//   the database stays locked. (i.e. just "knowing" the PIN doesn't help
//   anyone unless the admin has also provisioned the Firebase user.)
// * Firebase Auth automatically throttles brute-force attempts on the same
//   IP / email, so the 10,000-combo PIN space is meaningfully protected.
// * To change the PIN: create a new user in Firebase Console with password
//   PIN_TO_PASSWORD(<newPin>) and delete the old one. The client doesn't
//   need a code change.
// =====================================================================
const ADMIN_EMAIL = "admin@cricky-cricket-analysis.web.app";

// Map the 4-digit PIN to a Firebase password. Firebase requires passwords
// of >= 6 characters, so we wrap the PIN. Anyone who reads this code sees
// the scheme; that's expected — the secret is still the PIN itself, and
// every sign-in goes through Firebase Auth's throttled endpoint.
function pinToPassword(pin) { return `cricky-admin-pin-${pin}`; }

function showAdminLogin() {
    const modal = document.getElementById('modal-admin-login');
    modal.style.display = 'flex';
    setSignInError('');
    const pinEl = document.getElementById('signin-pin');
    if (pinEl) pinEl.value = '';
    setTimeout(() => pinEl?.focus(), 50);
}

function setSignInError(msg) {
    const el = document.getElementById('signin-error');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else { el.textContent = ''; el.style.display = 'none'; }
}

function friendlyAuthError(err) {
    const code = err && err.code ? err.code : '';
    switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
                                         return 'Incorrect PIN.';
        case 'auth/user-disabled':       return 'This admin account has been disabled.';
        case 'auth/too-many-requests':   return 'Too many attempts. Please wait a minute and try again.';
        case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
        case 'auth/operation-not-allowed':
                                         return 'Email/password sign-in is not enabled in Firebase yet. Enable it in the Firebase Console (Authentication → Sign-in method).';
        default:                         return (err && err.message) || 'Sign-in failed. Please try again.';
    }
}

async function signInAdmin() {
    const pin = (document.getElementById('signin-pin').value || '').trim();
    const btn = document.getElementById('signin-submit-btn');
    if (!/^\d{4}$/.test(pin)) {
        setSignInError('Enter your 4-digit PIN.');
        return;
    }
    setSignInError('');
    if (btn) { btn.disabled = true; btn.textContent = 'Unlocking...'; }
    try {
        await auth.signInWithEmailAndPassword(ADMIN_EMAIL, pinToPassword(pin));
        // onAuthStateChanged handles the rest (cache wiring, UI refresh).
        document.getElementById('signin-pin').value = '';
        closeModal('modal-admin-login');
    } catch (err) {
        console.error('Sign-in failed:', err);
        setSignInError(friendlyAuthError(err));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Unlock'; }
    }
}

function adminLogout() {
    auth.signOut()
        .catch(err => console.error('Sign-out failed:', err))
        .finally(() => window.location.reload());
}

// Called by onAuthStateChanged below when the user signs in.
function onAdminSignedIn(user) {
    currentAdminUser = user;
    isAdmin = true;
    document.getElementById('admin-login-btn')?.classList.add('hidden');
    document.getElementById('admin-logout-btn')?.classList.remove('hidden');
    document.getElementById('nav-setup')?.classList.remove('hidden');
    document.getElementById('new-tournament-quick-btn')?.classList.remove('hidden');
    document.getElementById('quick-match-btn')?.classList.remove('hidden');

    attachMatchPinsListener();
    migrateLegacyMatchPins();
    // The legacy flat-data migration is gated on isAdmin; kick it now that
    // we're signed in (no-op for fresh installs and for users already migrated).
    tryMigration();

    // Refresh all views so admin-only controls appear
    renderTournamentList();
    renderAdminTournamentsList();
    renderMatchList();
    if (currentTournamentId) renderTournamentDetail();
    if (currentViewingTeamId && document.getElementById('view-team-details')?.classList.contains('active')) {
        viewTeamDetails(currentViewingTeamId, true);
    }
    if (currentMatch) {
        // If the admin just signed in while looking at a match, surface the
        // "Unlock Scoring" PIN entry (unless they're already unlocked).
        const loginContainer = document.getElementById('scorer-login-container');
        if (loginContainer && !isScoringUnlocked) loginContainer.classList.remove('hidden');
        updateScoringUI();
    }
}

function onAdminSignedOut() {
    currentAdminUser = null;
    isAdmin = false;
    document.getElementById('admin-login-btn')?.classList.remove('hidden');
    document.getElementById('admin-logout-btn')?.classList.add('hidden');
    document.getElementById('nav-setup')?.classList.add('hidden');
    document.getElementById('new-tournament-quick-btn')?.classList.add('hidden');
    document.getElementById('quick-match-btn')?.classList.add('hidden');
    detachMatchPinsListener();
}

// Wire up the auth observer. Fires immediately on page load with the
// cached session (if any), then on every sign-in / sign-out.
auth.onAuthStateChanged(user => {
    if (user) onAdminSignedIn(user);
    else onAdminSignedOut();
});

// =====================================================================
// MATCH PIN CACHE  (/matchPins -> { mid: { pin } }, auth-only)
// =====================================================================
function attachMatchPinsListener() {
    if (matchPinsListener) return;
    const ref = db.ref('matchPins');
    const handler = snap => {
        matchPinsCache = snap.val() || {};
        if (currentMatch) updateScoringUI();
    };
    ref.on('value', handler, err => {
        console.warn('matchPins listener denied:', err && err.message);
        matchPinsCache = {};
    });
    matchPinsListener = () => ref.off('value', handler);
}

function detachMatchPinsListener() {
    if (matchPinsListener) {
        try { matchPinsListener(); } catch (_) {}
        matchPinsListener = null;
    }
    matchPinsCache = {};
}

function getMatchPin(mid) {
    if (!mid) return null;
    const fromVault = matchPinsCache && matchPinsCache[mid] && matchPinsCache[mid].pin;
    if (fromVault) return String(fromVault);
    // Legacy fallback for matches that pre-date the migration. The migration
    // step below sweeps these into /matchPins on first admin sign-in.
    const legacy = matchesCache[mid] && matchesCache[mid].pin;
    return legacy ? String(legacy) : null;
}

// One-shot migration: copy any legacy `matches/{mid}/pin` into
// /matchPins/{mid}/pin, then remove the public copy. Idempotent and only
// touches matches that still carry the legacy field.
async function migrateLegacyMatchPins() {
    if (pinMigrationAttempted) return;
    pinMigrationAttempted = true;
    try {
        const snap = await db.ref('matches').once('value');
        const all = snap.val() || {};
        const updates = {};
        let count = 0;
        for (const mid of Object.keys(all)) {
            const m = all[mid];
            if (!m || !m.pin) continue;
            updates[`matchPins/${mid}/pin`] = String(m.pin);
            updates[`matches/${mid}/pin`] = null;
            count++;
        }
        if (count > 0) {
            await db.ref().update(updates);
            console.info(`[migration] Moved ${count} match PIN(s) from /matches/*/pin to /matchPins/*.`);
        }
    } catch (err) {
        // Most likely cause: rules not yet deployed, or transient permission issue.
        console.warn('Match PIN migration skipped:', err && err.message);
    }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// =====================================================================
// SHARE + TOAST + DEEP LINKING
// =====================================================================
let toastTimer = null;
function showToast(message, durationMs) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), durationMs || 2400);
}

function matchShareUrl(mid) {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#match=${mid}`;
}

function buildShareTextFor(mid) {
    const m = matchesCache[mid];
    if (!m) return { title: 'Cricky Scorecard', text: 'Live cricket scorecard' };

    const tA = teamsCache[m.teamA], tB = teamsCache[m.teamB];
    const aName = tA ? tA.name : 'Team A';
    const bName = tB ? tB.name : 'Team B';

    let text;
    if (m.status === 'live') {
        text = `🔴 LIVE: ${aName} vs ${bName} — tap to follow the scorecard.`;
    } else if (m.status === 'completed') {
        text = `📋 ${aName} vs ${bName}${m.result ? ` — ${m.result}` : ''}`;
    } else {
        text = `${aName} vs ${bName} — Cricky scorecard`;
    }
    return { title: `${aName} vs ${bName}`, text };
}

async function shareMatch(mid) {
    if (!mid) return;
    const url = matchShareUrl(mid);
    const { title, text } = buildShareTextFor(mid);

    // 1) Native share sheet on mobile / supported browsers
    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') return; // user dismissed — stay silent
            // Otherwise fall through to clipboard
        }
    }

    // 2) Clipboard fallback
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(url);
            showToast('Link copied to clipboard');
            return;
        }
    } catch (_) {
        // fall through
    }

    // 3) Last-resort fallback: legacy execCommand
    try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { showToast('Link copied to clipboard'); return; }
    } catch (_) {}

    // 4) Final fallback: show the link so the user can copy manually
    prompt('Copy this link to share the match:', url);
}

function shareCurrentMatch() {
    if (!currentMatchId) return;
    shareMatch(currentMatchId);
}

// Reflect the currently-open match in the URL so refresh / back-button work
// and so the address bar shows a shareable link automatically.
function setMatchInUrl(mid) {
    const target = mid ? `#match=${mid}` : '';
    if (window.location.hash === target) return;
    if (mid) {
        // Use replaceState so we don't pile up history entries while scoring.
        history.replaceState(null, '', target);
    } else {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
}

function parseMatchFromHash() {
    const h = window.location.hash || '';
    const match = h.match(/^#?match=([A-Za-z0-9_\-]+)/);
    return match ? match[1] : null;
}

// Auto-open a deep-linked match once data has finished syncing. We only fire
// once per page load and only after teams + matches are both available so the
// scoring view can resolve names immediately.
let deepLinkConsumed = false;
function tryDeepLink() {
    if (deepLinkConsumed) return;
    if (!syncedFlags.teams || !syncedFlags.matches) return;
    const mid = parseMatchFromHash();
    if (!mid) { deepLinkConsumed = true; return; }
    if (!matchesCache[mid]) {
        // Hash refers to a deleted / unknown match — clear it quietly.
        deepLinkConsumed = true;
        setMatchInUrl(null);
        return;
    }
    deepLinkConsumed = true;
    openScoring(mid);
}

// Respond to hash changes while the app is open (e.g. user pastes a link
// into the address bar without reloading).
window.addEventListener('hashchange', () => {
    const mid = parseMatchFromHash();
    if (!mid) return;
    if (mid === currentMatchId) return;
    if (!matchesCache[mid]) return;
    openScoring(mid);
});

// =====================================================================
// NAVIGATION
// =====================================================================
function switchTab(tabId) {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    // Highlight the top-level nav item that this view belongs under
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItems = document.querySelectorAll('.nav-item');
    if (['view-tournaments', 'view-tournament-detail', 'view-team-details'].includes(tabId)) {
        navItems[0]?.classList.add('active');
    } else if (['view-matches', 'view-scoring'].includes(tabId)) {
        navItems[1]?.classList.add('active');
    } else if (tabId === 'view-admin') {
        navItems[2]?.classList.add('active');
    }

    if (tabId === 'view-tournaments') renderTournamentList();
    if (tabId === 'view-matches') { populateMatchFilterOptions(); renderMatchList(); }
    if (tabId === 'view-admin') renderAdminTournamentsList();

    // Keep the URL hash in sync — only the scoring view owns a shareable hash.
    if (tabId !== 'view-scoring') setMatchInUrl(null);
}

function switchTournamentSubTab(tab) {
    currentTournamentSubTab = tab;
    document.querySelectorAll('#tournament-sub-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`tt-${tab}`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('#view-tournament-detail .match-tab-content').forEach(c => c.classList.remove('active'));
    const pane = document.getElementById(`tsub-${tab}`);
    if (pane) pane.classList.add('active');
    renderTournamentDetail();
}

function switchMatchTab(tab) {
    currentMatchTab = tab;
    document.querySelectorAll('#match-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`mtab-${tab}`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('#view-scoring .match-tab-content').forEach(c => {
        c.classList.remove('active');
        c.classList.remove('hidden');
    });
    document.getElementById(`tab-${tab}`).classList.add('active');
    updateScoringUI();
}

function switchInningTab(inn) {
    currentInningTab = inn;
    document.querySelectorAll('.inning-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`itab-${inn}`).classList.add('active');
    updateScoringUI();
}

function switchStageView(view) {
    currentStageView = view;
    document.getElementById('btn-group-stage').classList.remove('active');
    document.getElementById('btn-playoffs').classList.remove('active');
    if (view === 'groups') document.getElementById('btn-group-stage').classList.add('active');
    else document.getElementById('btn-playoffs').classList.add('active');
    renderTournamentStandings();
}

// =====================================================================
// DATA SYNC + ONE-TIME MIGRATION
// =====================================================================
db.ref('tournaments').on('value', snap => {
    tournamentsCache = snap.val() || {};
    syncedFlags.tournaments = true;
    tryMigration();
    onDataChange();
});

db.ref('teams').on('value', snap => {
    persistedTeamsCache = snap.val() || {};
    rebuildTeamsCache();
    syncedFlags.teams = true;
    tryMigration();
    tryDeepLink();
    onDataChange();
});

db.ref('matches').on('value', snap => {
    matchesCache = snap.val() || {};
    rebuildTeamsCache();
    syncedFlags.matches = true;
    tryMigration();
    tryDeepLink();
    onDataChange();
});

// Quick-match teams live inside their match record (matches/{mid}/quickTeams) so
// they don't pollute /teams/ as reusable squads. We merge them into teamsCache
// at runtime so the scoring engine, scorecard, commentary etc. can resolve
// team / player names with the same teamsCache[id] lookup as tournament teams.
function rebuildTeamsCache() {
    teamsCache = {};
    Object.entries(persistedTeamsCache).forEach(([id, t]) => { teamsCache[id] = t; });
    Object.entries(matchesCache).forEach(([mid, m]) => {
        if (m && m.isQuickMatch && m.quickTeams) {
            Object.entries(m.quickTeams).forEach(([tid, t]) => {
                teamsCache[tid] = Object.assign({}, t, { _ephemeral: true, _matchId: mid });
            });
        }
    });
}

function onDataChange() {
    renderTournamentList();
    if (currentTournamentId) renderTournamentDetail();
    if (document.getElementById('view-matches').classList.contains('active')) {
        populateMatchFilterOptions();
        renderMatchList();
    }
    if (document.getElementById('view-admin').classList.contains('active')) {
        renderAdminTournamentsList();
    }

    // Refresh team detail if visible
    const detailEl = document.getElementById('view-team-details');
    if (detailEl.classList.contains('active') && currentViewingTeamId) {
        viewTeamDetails(currentViewingTeamId, true);
    }

    if (currentMatch && document.getElementById('view-scoring').classList.contains('active')) {
        updateScoringUI();
    }
}

function tryMigration() {
    if (migrationAttempted) return;
    if (!syncedFlags.tournaments || !syncedFlags.teams || !syncedFlags.matches) return;
    // Migration writes to the DB, which now requires an authenticated admin.
    // Skip silently for visitors; re-runs naturally after sign-in via the
    // post-sign-in hook below.
    if (!isAdmin) return;
    migrationAttempted = true;

    const hasTournaments = Object.keys(tournamentsCache).length > 0;
    if (hasTournaments) return;

    // Only consider PERSISTED teams (ones at /teams/) — quick-match teams are
    // ephemeral and live inside their match record, they should never trigger
    // migration into a tournament.
    const hasTeams = Object.keys(persistedTeamsCache).length > 0;
    const hasTournamentStyleMatches = Object.entries(matchesCache).some(([, m]) => !m.isQuickMatch);

    // Also check legacy `playoffs/` root from old schema
    db.ref('playoffs').once('value', poSnap => {
        const legacyPlayoffs = poSnap.val();
        const hasLegacyPlayoffs = legacyPlayoffs && Object.keys(legacyPlayoffs).length > 0;

        if (!hasTeams && !hasTournamentStyleMatches && !hasLegacyPlayoffs) return; // pristine install (quick-match-only is fine)

        // Create a single default tournament under a deterministic key so concurrent
        // clients race-converge instead of creating duplicates.
        const tid = DEFAULT_TOURNAMENT_KEY;
        db.ref(`tournaments/${tid}`).set({
            name: 'Default Tournament',
            createdAt: Date.now(),
            status: 'active',
            oversDefault: 10,
            playoffs: legacyPlayoffs || null
        });

        Object.entries(persistedTeamsCache).forEach(([teamId, team]) => {
            if (!team.tournamentId) {
                db.ref(`teams/${teamId}/tournamentId`).set(tid);
            }
        });

        Object.entries(matchesCache).forEach(([mid, m]) => {
            if (!m.tournamentId && !m.isQuickMatch) {
                db.ref(`matches/${mid}/tournamentId`).set(tid);
            }
        });

        if (hasLegacyPlayoffs) db.ref('playoffs').remove();
    });
}

// =====================================================================
// HELPERS
// =====================================================================
function teamsInTournament(tid) {
    return Object.entries(teamsCache).filter(([, t]) => t.tournamentId === tid);
}
function matchesInTournament(tid) {
    return Object.entries(matchesCache).filter(([, m]) => m.tournamentId === tid);
}
function quickMatches() {
    return Object.entries(matchesCache).filter(([, m]) => m.isQuickMatch === true);
}
function activeTournaments() {
    return Object.entries(tournamentsCache).filter(([, t]) => t.status !== 'archived');
}
function calculateNRR(stats) {
    if (!stats || !stats.nrr_ballsFaced) return 0;
    const oversFaced = stats.nrr_ballsFaced / 6;
    const runsForRate = stats.nrr_runsScored / oversFaced;
    let runsAgainstRate = 0;
    if (stats.nrr_ballsBowled && stats.nrr_ballsBowled > 0) {
        runsAgainstRate = stats.nrr_runsConceded / (stats.nrr_ballsBowled / 6);
    }
    return (runsForRate - runsAgainstRate).toFixed(3);
}
function ballsFromOvers(oversStr) {
    if (!oversStr) return 0;
    const parts = oversStr.toString().split('.');
    return (parseInt(parts[0]) * 6) + (parseInt(parts[1] || 0));
}
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// =====================================================================
// TOURNAMENTS — LIST (landing view)
// =====================================================================
function renderTournamentList() {
    const container = document.getElementById('tournaments-list');
    if (!container) return;

    const all = Object.entries(tournamentsCache);
    if (all.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>No tournaments yet</strong>
                ${isAdmin ? 'Tap <em>+ New</em> above or head to Setup to create one.' : 'An admin needs to create a tournament first.'}
            </div>`;
    } else {
        // Active first, then archived; both sorted by createdAt desc
        all.sort((a, b) => {
            const sa = a[1].status === 'archived' ? 1 : 0;
            const sb = b[1].status === 'archived' ? 1 : 0;
            if (sa !== sb) return sa - sb;
            return (b[1].createdAt || 0) - (a[1].createdAt || 0);
        });

        container.innerHTML = all.map(([tid, t]) => {
            const teamCount = teamsInTournament(tid).length;
            const matches = matchesInTournament(tid);
            const completed = matches.filter(([, m]) => m.status === 'completed').length;
            const isArchived = t.status === 'archived';
            const statusPill = isArchived
                ? `<span class="status-pill archived">Archived</span>`
                : `<span class="status-pill active">Active</span>`;
            return `
                <div class="tournament-card ${isArchived ? 'archived' : ''}" onclick="viewTournament('${tid}')">
                    <div style="flex:1; min-width:0;">
                        <div class="tc-name">${escapeHtml(t.name || 'Tournament')}</div>
                        <div class="tc-meta">${teamCount} team${teamCount !== 1 ? 's' : ''} · ${completed}/${matches.length} match${matches.length !== 1 ? 'es' : ''} played &nbsp; ${statusPill}</div>
                    </div>
                    <div class="tc-arrow">›</div>
                </div>`;
        }).join('');
    }

    // Quick matches preview
    const qmContainer = document.getElementById('quick-matches-list');
    if (qmContainer) {
        const qm = quickMatches().sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        if (qm.length === 0) {
            qmContainer.innerHTML = `
                <div class="empty-state">
                    <strong>No quick matches yet</strong>
                    ${isAdmin ? 'Tap <em>Start Quick Match</em> to play a friendly.' : 'Friendlies will appear here once started.'}
                </div>`;
        } else {
            qmContainer.innerHTML = renderMatchCards(qm.slice(0, QUICK_MATCH_PREVIEW_COUNT));
        }
    }
}

// =====================================================================
// TOURNAMENT DETAIL
// =====================================================================
function viewTournament(tid) {
    currentTournamentId = tid;
    currentTournamentSubTab = 'standings';
    currentStageView = 'groups';
    document.querySelectorAll('#tournament-sub-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tt-standings').classList.add('active');
    document.querySelectorAll('#view-tournament-detail .match-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tsub-standings').classList.add('active');
    document.getElementById('btn-group-stage').classList.add('active');
    document.getElementById('btn-playoffs').classList.remove('active');

    switchTab('view-tournament-detail');
    renderTournamentDetail();
}

function renderTournamentDetail() {
    if (!currentTournamentId) return;
    const t = tournamentsCache[currentTournamentId];
    if (!t) { switchTab('view-tournaments'); return; }

    document.getElementById('tournament-detail-name').innerText = t.name || 'Tournament';
    const teamCount = teamsInTournament(currentTournamentId).length;
    const matches = matchesInTournament(currentTournamentId);
    const completed = matches.filter(([, m]) => m.status === 'completed').length;
    document.getElementById('tournament-detail-meta').innerText =
        `${teamCount} team${teamCount !== 1 ? 's' : ''} · ${completed}/${matches.length} match${matches.length !== 1 ? 'es' : ''} played · Default ${t.oversDefault || 10} overs`;

    const pill = document.getElementById('tournament-status-badge');
    const isArchived = t.status === 'archived';
    pill.innerText = isArchived ? 'Archived' : 'Active';
    pill.className = `status-pill ${isArchived ? 'archived' : 'active'}`;

    const manageBtn = document.getElementById('tt-manage');
    if (isAdmin) {
        manageBtn.classList.remove('hidden');
    } else {
        manageBtn.classList.add('hidden');
        if (currentTournamentSubTab === 'manage') {
            currentTournamentSubTab = 'standings';
            document.querySelectorAll('#tournament-sub-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('tt-standings').classList.add('active');
            document.querySelectorAll('#view-tournament-detail .match-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tsub-standings').classList.add('active');
        }
    }

    const startMatchBtn = document.getElementById('tournament-new-match-btn');
    if (startMatchBtn) {
        if (isAdmin && !isArchived) startMatchBtn.classList.remove('hidden');
        else startMatchBtn.classList.add('hidden');
    }

    if (currentTournamentSubTab === 'standings') renderTournamentStandings();
    else if (currentTournamentSubTab === 'matches') renderTournamentMatches();
    else if (currentTournamentSubTab === 'players') renderTournamentTopPlayers();
    else if (currentTournamentSubTab === 'squad') renderTournamentSquad();
    else if (currentTournamentSubTab === 'manage') renderTournamentManage();
}

// =====================================================================
// TOURNAMENT — STANDINGS (groups & playoffs sub-toggle)
// =====================================================================
function renderTournamentStandings() {
    const container = document.getElementById('standings-container');
    if (!container) return;
    if (!currentTournamentId) return;

    const tid = currentTournamentId;
    const t = tournamentsCache[tid] || {};
    const playoffConfig = t.playoffs || {};
    const teams = teamsInTournament(tid);

    if (teams.length === 0) {
        container.innerHTML = `<div class="empty-state" style="margin:10px;"><strong>No teams yet</strong>${isAdmin ? 'Use Manage to register teams.' : 'Waiting on the admin to register teams.'}</div>`;
        return;
    }

    if (currentStageView === 'playoffs') {
        const getTeamSpan = (tidPart, winnerId) => {
            if (!tidPart) return '<strong>TBD</strong>';
            const name = teamsCache[tidPart] ? teamsCache[tidPart].name : 'TBD';
            if (tidPart === winnerId) return `<strong class="playoff-winner">👑 ${escapeHtml(name)}</strong>`;
            return `<strong class="${winnerId ? 'playoff-loser' : ''}">${escapeHtml(name)}</strong>`;
        };
        container.innerHTML = `
            <div style="padding:20px 10px; text-align:center;">
                <div class="playoff-match-box">
                    <div class="playoff-match-title">Playoff 1 (Group A #1 vs Group B #2)</div>
                    <div class="playoff-teams">${getTeamSpan(playoffConfig.p1?.a, playoffConfig.p1?.w)} <span>VS</span> ${getTeamSpan(playoffConfig.p1?.b, playoffConfig.p1?.w)}</div>
                </div>
                <div class="playoff-match-box">
                    <div class="playoff-match-title">Playoff 2 (Group B #1 vs Group A #2)</div>
                    <div class="playoff-teams">${getTeamSpan(playoffConfig.p2?.a, playoffConfig.p2?.w)} <span>VS</span> ${getTeamSpan(playoffConfig.p2?.b, playoffConfig.p2?.w)}</div>
                </div>
                <div class="playoff-match-box" style="margin-top: 25px; border-color: #aaa;">
                    <div class="playoff-match-title" style="background: #aaa;">3rd Place Match</div>
                    <div class="playoff-teams">${getTeamSpan(playoffConfig.p3?.a, playoffConfig.p3?.w)} <span>VS</span> ${getTeamSpan(playoffConfig.p3?.b, playoffConfig.p3?.w)}</div>
                </div>
                <div class="playoff-match-box" style="margin-top: 20px; border-color: var(--uwb-gold); border-width: 2px;">
                    <div class="playoff-match-title" style="background: var(--uwb-gold); color: var(--uwb-black);">🏆 GRAND FINAL</div>
                    <div class="playoff-teams" style="font-size:1.1rem; padding:15px;">${getTeamSpan(playoffConfig.pf?.a, playoffConfig.pf?.w)} <span style="color:var(--uwb-gold);">VS</span> ${getTeamSpan(playoffConfig.pf?.b, playoffConfig.pf?.w)}</div>
                </div>
            </div>`;
        return;
    }

    // GROUP STAGE
    const list = teams.map(([id, tm]) => {
        const s = tm.stats || {};
        return {
            id, name: tm.name, group: (tm.group || 'A').toUpperCase(),
            played: s.played || 0, won: s.won || 0, lost: s.lost || 0, points: s.points || 0,
            nrr: parseFloat(calculateNRR(s))
        };
    });

    const groups = {};
    list.forEach(team => {
        if (!groups[team.group]) groups[team.group] = [];
        groups[team.group].push(team);
    });

    let html = '';
    Object.keys(groups).sort().forEach(grpName => {
        const grpTeams = groups[grpName];
        grpTeams.sort((a, b) => (b.points - a.points) || (b.nrr - a.nrr));

        html += `<div class="group-header">Group ${grpName}</div>`;
        html += `<table class="modern-table" style="margin-bottom: 10px;">
            <thead><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th><th style="width:15px;"></th></tr></thead><tbody>`;

        grpTeams.forEach((team, idx) => {
            const nrrDisplay = team.nrr > 0 ? `+${team.nrr}` : team.nrr;
            let rankImg = '';
            if (idx === 0) rankImg = '🥇 ';
            else if (idx === 1) rankImg = '🥈 ';
            else if (idx === 2) rankImg = '🥉 ';

            html += `
                <tr class="clickable-row" onclick="viewTeamDetails('${team.id}')">
                    <td class="team-name-cell"><strong>${rankImg}${escapeHtml(team.name)}</strong></td>
                    <td>${team.played}</td>
                    <td><span class="win-tag">${team.won}</span></td>
                    <td><span class="loss-tag">${team.lost}</span></td>
                    <td class="pts-cell">${team.points}</td>
                    <td><small>${nrrDisplay}</small></td>
                    <td class="chevron-cell">›</td>
                </tr>`;
        });
        html += `</tbody></table>`;
    });
    container.innerHTML = html;
}

// =====================================================================
// TOURNAMENT — MATCHES (scoped to current tournament)
// =====================================================================
function renderTournamentMatches() {
    if (!currentTournamentId) return;
    const container = document.getElementById('tournament-matches-list');
    if (!container) return;

    const matches = matchesInTournament(currentTournamentId)
        .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0));

    if (matches.length === 0) {
        container.innerHTML = `<div class="empty-state"><strong>No matches yet</strong><span>${isAdmin ? 'Tap "+ Start New Match" above to play the first game.' : 'No matches have been played in this tournament yet.'}</span></div>`;
        return;
    }
    container.innerHTML = renderMatchCards(matches);
}

function openTournamentMatchSetup() {
    if (!isAdmin) return alert('Admin only.');
    if (!currentTournamentId) return alert('Open a tournament first.');
    const t = tournamentsCache[currentTournamentId];
    if (!t) return;
    if (t.status === 'archived') return alert('This tournament is archived. Unarchive it from Manage before scheduling new matches.');

    const teams = teamsInTournament(currentTournamentId);
    if (teams.length < 2) return alert('Register at least 2 teams in this tournament first (Manage → Register Team).');

    populateTeamA();
    document.getElementById('match-overs').value = t.oversDefault || 10;
    document.getElementById('match-pin').value = '';
    document.getElementById('toss-choice').value = 'bat';
    document.getElementById('toss-bat-btn').classList.add('active');
    document.getElementById('toss-bowl-btn').classList.remove('active');
    updateMatchSetupUI();

    document.getElementById('modal-tournament-match').style.display = 'flex';
}

// =====================================================================
// TOURNAMENT — TOP PLAYERS (best batter / bowler scoped to tournament)
// =====================================================================
function renderTournamentTopPlayers() {
    if (!currentTournamentId) return;
    const teams = teamsInTournament(currentTournamentId);
    const allPlayers = [];

    teams.forEach(([, team]) => {
        if (team.players) {
            Object.entries(team.players).forEach(([pid, p]) => {
                const s = p.stats || {};
                if ((s.matches || 0) >= 1) {
                    allPlayers.push({
                        pid, name: p.name, teamName: team.name,
                        matches: s.matches || 0,
                        runs: s.runs || 0,
                        wickets: s.wickets || 0
                    });
                }
            });
        }
    });

    const topBatters = [...allPlayers].sort((a, b) => b.runs - a.runs).slice(0, 5);
    const battersTable = document.getElementById('top-batters-table');
    if (battersTable) {
        battersTable.innerHTML = topBatters.length > 0 ? topBatters.map(p => `
            <tr>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td><small style="color:#666;">${escapeHtml(p.teamName)}</small></td>
                <td>${p.matches}</td>
                <td class="bold-stat" style="color:var(--uwb-purple);">${p.runs}</td>
            </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color:#888;">No player data yet</td></tr>`;
    }

    const topBowlers = [...allPlayers].sort((a, b) => b.wickets - a.wickets).slice(0, 5);
    const bowlersTable = document.getElementById('top-bowlers-table');
    if (bowlersTable) {
        bowlersTable.innerHTML = topBowlers.length > 0 ? topBowlers.map(p => `
            <tr>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td><small style="color:#666;">${escapeHtml(p.teamName)}</small></td>
                <td>${p.matches}</td>
                <td class="bold-stat" style="color:var(--uwb-purple);">${p.wickets}</td>
            </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color:#888;">No player data yet</td></tr>`;
    }
}

// =====================================================================
// TOURNAMENT — SQUAD (teams roster overview)
// =====================================================================
function renderTournamentSquad() {
    const container = document.getElementById('tournament-teams-list');
    if (!container) return;
    if (!currentTournamentId) return;

    const teams = teamsInTournament(currentTournamentId);
    if (teams.length === 0) {
        container.innerHTML = `<div class="empty-state"><strong>No teams yet</strong>${isAdmin ? 'Use Manage to register teams.' : 'Waiting on the admin to register teams.'}</div>`;
        return;
    }

    teams.sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''));
    container.innerHTML = teams.map(([tid, t]) => {
        const playerCount = t.players ? Object.keys(t.players).length : 0;
        const captName = t.players && t.captain && t.players[t.captain] ? t.players[t.captain].name : '';
        return `
            <div class="tournament-card" onclick="viewTeamDetails('${tid}')">
                <div style="flex:1; min-width:0;">
                    <div class="tc-name">${escapeHtml(t.name)} <span style="font-size:0.7rem; color:#999; font-weight:600; margin-left:6px;">Group ${escapeHtml((t.group || 'A').toUpperCase())}</span></div>
                    <div class="tc-meta">${playerCount} player${playerCount !== 1 ? 's' : ''}${captName ? ` · 👑 ${escapeHtml(captName)}` : ''}</div>
                </div>
                <div class="tc-arrow">›</div>
            </div>`;
    }).join('');
}

// =====================================================================
// TOURNAMENT — MANAGE (admin only)
// =====================================================================
function renderTournamentManage() {
    if (!currentTournamentId || !isAdmin) return;
    const t = tournamentsCache[currentTournamentId];
    if (!t) return;

    document.getElementById('tournament-rename-input').value = t.name || '';
    document.getElementById('tournament-overs-default').value = t.oversDefault || 10;

    const archiveBtn = document.getElementById('archive-tournament-btn');
    archiveBtn.innerText = t.status === 'archived' ? 'Reactivate' : 'Archive';

    renderAdminGroupSetup();
    renderAdminPlayoffSetup();
}

function saveTournamentName() {
    if (!isAdmin || !currentTournamentId) return;
    const name = document.getElementById('tournament-rename-input').value.trim();
    if (!name) return alert("Tournament name required.");
    db.ref(`tournaments/${currentTournamentId}/name`).set(name, () => alert("Tournament renamed."));
}

function saveTournamentOvers() {
    if (!isAdmin || !currentTournamentId) return;
    const overs = parseInt(document.getElementById('tournament-overs-default').value) || 10;
    db.ref(`tournaments/${currentTournamentId}/oversDefault`).set(overs, () => alert("Default overs saved."));
}

function toggleArchiveTournament() {
    if (!isAdmin || !currentTournamentId) return;
    const current = tournamentsCache[currentTournamentId];
    if (!current) return;
    const newStatus = current.status === 'archived' ? 'active' : 'archived';
    db.ref(`tournaments/${currentTournamentId}/status`).set(newStatus, () => {
        alert(`Tournament ${newStatus === 'archived' ? 'archived' : 'reactivated'}.`);
    });
}

function deleteTournament() {
    if (!isAdmin || !currentTournamentId) return;
    if (!confirm("Delete this tournament along with all its teams and matches? This cannot be undone.")) return;
    if (!confirm("REALLY delete? All scorecards belonging to this tournament will also be removed.")) return;

    const tid = currentTournamentId;
    teamsInTournament(tid).forEach(([teamId]) => db.ref(`teams/${teamId}`).remove());
    Object.entries(matchesCache).forEach(([mid, m]) => {
        if (m.tournamentId === tid) {
            db.ref().update({
                [`matches/${mid}`]: null,
                [`matchPins/${mid}`]: null
            });
        }
    });
    db.ref(`tournaments/${tid}`).remove(() => {
        currentTournamentId = null;
        switchTab('view-tournaments');
    });
}

function resetTournamentStats() {
    if (!isAdmin || !currentTournamentId) return;
    if (!confirm("Reset all points, NRR, and player stats for this tournament? Match scorecards stay intact.")) return;
    teamsInTournament(currentTournamentId).forEach(([teamId, team]) => {
        db.ref(`teams/${teamId}/stats`).set({played:0, won:0, lost:0, points:0, nrr_runsScored:0, nrr_ballsFaced:0, nrr_runsConceded:0, nrr_ballsBowled:0});
        const players = team.players || {};
        Object.keys(players).forEach(pid => {
            db.ref(`teams/${teamId}/players/${pid}/stats`).set({matches:0, runs:0, wickets:0});
        });
    });
    alert("Tournament stats reset.");
}

// =====================================================================
// GLOBAL ADMIN (Setup view)
// =====================================================================
function createTournament() {
    if (!isAdmin) return;
    const name = document.getElementById('new-tournament-name').value.trim();
    const overs = parseInt(document.getElementById('new-tournament-overs').value) || 10;
    if (!name) return alert("Enter a tournament name.");
    const ref = db.ref('tournaments').push();
    ref.set({
        name, oversDefault: overs, createdAt: Date.now(),
        status: 'active', playoffs: null
    }, err => {
        if (err) return alert("Could not create tournament: " + err.message);
        document.getElementById('new-tournament-name').value = '';
        document.getElementById('new-tournament-overs').value = '10';
        viewTournament(ref.key);
    });
}

function openNewTournamentModal() {
    document.getElementById('modal-tournament-name').value = '';
    document.getElementById('modal-tournament-overs').value = '10';
    document.getElementById('modal-new-tournament').style.display = 'flex';
}

function createTournamentFromModal() {
    if (!isAdmin) return;
    const name = document.getElementById('modal-tournament-name').value.trim();
    const overs = parseInt(document.getElementById('modal-tournament-overs').value) || 10;
    if (!name) return alert("Enter a tournament name.");
    const ref = db.ref('tournaments').push();
    ref.set({
        name, oversDefault: overs, createdAt: Date.now(),
        status: 'active', playoffs: null
    }, err => {
        if (err) return alert("Could not create tournament: " + err.message);
        closeModal('modal-new-tournament');
        viewTournament(ref.key);
    });
}

function renderAdminTournamentsList() {
    const container = document.getElementById('admin-tournaments-list');
    if (!container) return;
    const all = Object.entries(tournamentsCache);
    if (all.length === 0) {
        container.innerHTML = `<div class="empty-state"><strong>No tournaments yet</strong>Use the form above to create one.</div>`;
        return;
    }
    all.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
    container.innerHTML = all.map(([tid, t]) => {
        const teamCount = teamsInTournament(tid).length;
        const isArchived = t.status === 'archived';
        return `
            <div class="admin-tournament-row" onclick="viewTournament('${tid}')">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:var(--uwb-purple);">${escapeHtml(t.name)}</div>
                    <div style="font-size:0.75rem; color:#666;">${teamCount} team${teamCount !== 1 ? 's' : ''} · ${isArchived ? 'Archived' : 'Active'}</div>
                </div>
                <div style="color:#ccc; font-size:1.3rem;">›</div>
            </div>`;
    }).join('');
}

function wipeEverything() {
    if (!isAdmin) return;
    if (!confirm("WARNING: Permanently delete ALL tournaments, teams, matches, and stats?")) return;
    if (!confirm("Are you ABSOLUTELY sure? This cannot be undone.")) return;
    Promise.all([
        db.ref('tournaments').remove(),
        db.ref('teams').remove(),
        db.ref('matches').remove(),
        db.ref('matchPins').remove(),
        db.ref('playoffs').remove()
    ]).then(() => alert("All data wiped."));
}

// =====================================================================
// TEAM REGISTRATION (tournament-scoped)
// =====================================================================
function registerTeam() {
    if (!isAdmin || !currentTournamentId) return alert("Open a tournament first.");
    const name = document.getElementById('reg-team-name').value.trim();
    const cap = document.getElementById('reg-captain').value.trim();
    const pStr = document.getElementById('reg-players').value;
    if (!name || !pStr) return alert("Fill all fields");

    const pObj = {};
    let captainPid = null;
    [cap, ...pStr.split(',')].forEach((n, idx) => {
        if (n && n.trim()) {
            const pid = db.ref().push().key;
            pObj[pid] = { name: n.trim(), stats: { matches: 0, runs: 0, wickets: 0 } };
            if (idx === 0) captainPid = pid;
        }
    });

    db.ref('teams').push({
        name, captain: captainPid, players: pObj,
        tournamentId: currentTournamentId,
        group: 'A',
        stats: { played: 0, won: 0, lost: 0, points: 0 }
    }, () => {
        alert("Team Registered.");
        document.getElementById('reg-team-name').value = '';
        document.getElementById('reg-captain').value = '';
        document.getElementById('reg-players').value = '';
    });
}

// =====================================================================
// GROUPS + PLAYOFFS SETUP (tournament-scoped)
// =====================================================================
function renderAdminGroupSetup() {
    const container = document.getElementById('admin-group-assignments');
    if (!container || !currentTournamentId) return;
    const teams = teamsInTournament(currentTournamentId);
    if (teams.length === 0) {
        container.innerHTML = `<div class="empty-state"><strong>No teams yet</strong>Register teams above first.</div>`;
        return;
    }
    container.innerHTML = teams.map(([tid, t]) => {
        const groupVal = t.group || 'A';
        return `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; background:#f9f9f9; padding:6px 10px; border-radius:6px; border:1px solid #eee;">
                <span style="font-size:0.9rem; font-weight:bold; color:var(--uwb-purple);">${escapeHtml(t.name)}</span>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:0.75rem; color:#666;">Group</span>
                    <input type="text" id="group-assign-${tid}" value="${escapeHtml(groupVal)}" style="width:40px; padding:4px; margin:0; text-align:center; font-weight:bold; text-transform:uppercase;" maxlength="1">
                </div>
            </div>`;
    }).join('');
}

function saveGroupAssignments() {
    if (!currentTournamentId) return;
    teamsInTournament(currentTournamentId).forEach(([tid]) => {
        const input = document.getElementById(`group-assign-${tid}`);
        if (input) {
            const grp = input.value.toUpperCase() || 'A';
            db.ref(`teams/${tid}/group`).set(grp);
        }
    });
    alert("Group assignments saved.");
}

function renderAdminPlayoffSetup() {
    if (!currentTournamentId) return;
    const t = tournamentsCache[currentTournamentId] || {};
    const playoffConfig = t.playoffs || {};
    const teams = teamsInTournament(currentTournamentId);

    const selects = ['po-1-a', 'po-1-b', 'po-1-w', 'po-2-a', 'po-2-b', 'po-2-w', 'po-3-a', 'po-3-b', 'po-3-w', 'po-f-a', 'po-f-b', 'po-f-w'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const defaultText = id.endsWith('-w') ? 'Winner...' : 'TBD';
        el.innerHTML = `<option value="">${defaultText}</option>`;
        teams.forEach(([tid, tm]) => {
            el.innerHTML += `<option value="${tid}">${escapeHtml(tm.name)}</option>`;
        });
    });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('po-1-a', playoffConfig.p1?.a); setVal('po-1-b', playoffConfig.p1?.b); setVal('po-1-w', playoffConfig.p1?.w);
    setVal('po-2-a', playoffConfig.p2?.a); setVal('po-2-b', playoffConfig.p2?.b); setVal('po-2-w', playoffConfig.p2?.w);
    setVal('po-3-a', playoffConfig.p3?.a); setVal('po-3-b', playoffConfig.p3?.b); setVal('po-3-w', playoffConfig.p3?.w);
    setVal('po-f-a', playoffConfig.pf?.a); setVal('po-f-b', playoffConfig.pf?.b); setVal('po-f-w', playoffConfig.pf?.w);
}

function autoFillPlayoffs() {
    if (!currentTournamentId) return;
    const list = teamsInTournament(currentTournamentId).map(([id, t]) => ({
        id, group: (t.group || 'A').toUpperCase(),
        points: t.stats?.points || 0,
        nrr: parseFloat(calculateNRR(t.stats || {}))
    }));
    const grpA = list.filter(t => t.group === 'A').sort((a, b) => (b.points - a.points) || (b.nrr - a.nrr));
    const grpB = list.filter(t => t.group === 'B').sort((a, b) => (b.points - a.points) || (b.nrr - a.nrr));

    document.getElementById('po-1-a').value = grpA.length > 0 ? grpA[0].id : '';
    document.getElementById('po-1-b').value = grpB.length > 1 ? grpB[1].id : '';
    document.getElementById('po-2-a').value = grpB.length > 0 ? grpB[0].id : '';
    document.getElementById('po-2-b').value = grpA.length > 1 ? grpA[1].id : '';
    alert("Auto-filled Playoff 1 & 2 from current standings. Click Save Bracket when ready.");
}

function savePlayoffs() {
    if (!currentTournamentId) return;
    const payload = {
        p1: { a: document.getElementById('po-1-a').value, b: document.getElementById('po-1-b').value, w: document.getElementById('po-1-w').value },
        p2: { a: document.getElementById('po-2-a').value, b: document.getElementById('po-2-b').value, w: document.getElementById('po-2-w').value },
        p3: { a: document.getElementById('po-3-a').value, b: document.getElementById('po-3-b').value, w: document.getElementById('po-3-w').value },
        pf: { a: document.getElementById('po-f-a').value, b: document.getElementById('po-f-b').value, w: document.getElementById('po-f-w').value }
    };
    db.ref(`tournaments/${currentTournamentId}/playoffs`).set(payload, err => {
        if (!err) alert("Playoff Bracket & Winners Saved.");
    });
}

// =====================================================================
// MATCH SETUP (tournament-scoped)
// =====================================================================
function populateTeamA() {
    const a = document.getElementById('match-teamA');
    if (!a || !currentTournamentId) return;
    const previousValue = a.value;
    a.innerHTML = '<option value="">Select Team A</option>';
    teamsInTournament(currentTournamentId).forEach(([id, t]) => {
        const sel = id === previousValue ? 'selected' : '';
        a.innerHTML += `<option value="${id}" ${sel}>${escapeHtml(t.name)}</option>`;
    });
}

function updateMatchSetupUI() {
    if (!currentTournamentId) return;
    const aSelect = document.getElementById('match-teamA');
    if (!aSelect) return;
    if (aSelect.options.length <= 1) populateTeamA();

    const aVal = aSelect.value;
    const bSelect = document.getElementById('match-teamB');
    const bVal = bSelect.value;
    const tossSelect = document.getElementById('toss-winner');

    bSelect.innerHTML = '<option value="">Select Team B</option>';
    teamsInTournament(currentTournamentId).forEach(([id, t]) => {
        if (id !== aVal) {
            const selected = (id === bVal) ? 'selected' : '';
            bSelect.innerHTML += `<option value="${id}" ${selected}>${escapeHtml(t.name)}</option>`;
        }
    });
    tossSelect.innerHTML = '<option value="">Who won toss?</option>';
    if (aVal && teamsCache[aVal]) tossSelect.innerHTML += `<option value="${aVal}">${escapeHtml(teamsCache[aVal].name)}</option>`;
    if (bSelect.value && teamsCache[bSelect.value]) tossSelect.innerHTML += `<option value="${bSelect.value}">${escapeHtml(teamsCache[bSelect.value].name)}</option>`;
}

function selectTossChoice(choice) {
    document.getElementById('toss-choice').value = choice;
    document.getElementById('toss-bat-btn').classList.remove('active');
    document.getElementById('toss-bowl-btn').classList.remove('active');
    if (choice === 'bat') document.getElementById('toss-bat-btn').classList.add('active');
    else document.getElementById('toss-bowl-btn').classList.add('active');
}

function startMatch() {
    if (!isAdmin) return alert("Admin only.");
    if (!currentTournamentId) return alert("Open a tournament first.");
    const tA = document.getElementById('match-teamA').value;
    const tB = document.getElementById('match-teamB').value;
    const overs = document.getElementById('match-overs').value;
    const pin = document.getElementById('match-pin').value;
    const tossWinner = document.getElementById('toss-winner').value;
    const tossChoice = document.getElementById('toss-choice').value;

    if (!tA || !tB || !tossWinner || !pin) return alert("Please complete all fields, including the Scoring PIN.");
    if (tA === tB) return alert("Team A and Team B must be different.");

    const battingFirst = tossChoice === 'bat' ? tossWinner : (tossWinner === tA ? tB : tA);
    const bowlingFirst = battingFirst === tA ? tB : tA;
    const matchRef = db.ref('matches').push();
    const mid = matchRef.key;
    // Write match record + PIN as one atomic multi-path update so we never end
    // up with a match that has no scorer PIN if the network drops mid-write.
    const updates = {};
    updates[`matches/${mid}`] = {
        timestamp: Date.now(),
        tournamentId: currentTournamentId,
        isQuickMatch: false,
        teamA: tA, teamB: tB, oversLimit: parseInt(overs) || 10,
        status: 'live',
        toss: { winner: tossWinner, choice: tossChoice },
        currentInnings: 1,
        state: {
            battingTeam: battingFirst, bowlingTeam: bowlingFirst,
            striker: null, nonStriker: null, bowler: null, lastBowler: null,
            runs: 0, wickets: 0, balls: 0, overs: "0.0",
            timeline: [], outPlayers: [], playerStats: {}, historyStack: []
        },
        innings1: null, innings2: null
    };
    updates[`matchPins/${mid}/pin`] = String(pin);
    db.ref().update(updates).catch(err => {
        console.error('Failed to start match:', err);
        alert('Failed to start match. ' + (err && err.message ? err.message : ''));
    });

    document.getElementById('match-pin').value = '';
    closeModal('modal-tournament-match');
    openScoring(mid);
}

// =====================================================================
// QUICK MATCH
//
// Quick matches use ad-hoc teams entered by the scorer. The team data
// (name + players) is stored INSIDE the match record at
// matches/{mid}/quickTeams, so it never persists as a reusable squad
// at /teams/. The matches listener merges these into teamsCache at
// runtime so the scoring engine reads them the same way as any other team.
// =====================================================================
function openQuickMatchSetup() {
    if (!isAdmin) return alert("Admin only.");

    document.getElementById('qm-teamA-name').value = '';
    document.getElementById('qm-teamB-name').value = '';
    document.getElementById('qm-teamA-players').value = '';
    document.getElementById('qm-teamB-players').value = '';
    document.getElementById('qm-overs').value = 10;
    document.getElementById('qm-pin').value = '';

    document.getElementById('qm-toss-choice').value = 'bat';
    document.getElementById('qm-toss-bat-btn').classList.add('active');
    document.getElementById('qm-toss-bowl-btn').classList.remove('active');

    document.getElementById('qm-toss-winner').value = 'A';
    document.getElementById('qm-toss-winner-A').classList.add('active');
    document.getElementById('qm-toss-winner-B').classList.remove('active');

    updateQuickTossOptions();

    document.getElementById('modal-quick-match').style.display = 'flex';
}

function updateQuickTossOptions() {
    // Keep the toss-winner toggle labels in sync with the team names the
    // scorer is typing. Pure cosmetic — value stays "A"/"B".
    const aName = (document.getElementById('qm-teamA-name')?.value || '').trim() || 'Team A';
    const bName = (document.getElementById('qm-teamB-name')?.value || '').trim() || 'Team B';
    const aBtn = document.getElementById('qm-toss-winner-A');
    const bBtn = document.getElementById('qm-toss-winner-B');
    if (aBtn) aBtn.innerText = aName;
    if (bBtn) bBtn.innerText = bName;
}

function selectQuickTossWinner(choice) {
    document.getElementById('qm-toss-winner').value = choice;
    document.getElementById('qm-toss-winner-A').classList.remove('active');
    document.getElementById('qm-toss-winner-B').classList.remove('active');
    document.getElementById(`qm-toss-winner-${choice}`).classList.add('active');
}

function selectQuickTossChoice(choice) {
    document.getElementById('qm-toss-choice').value = choice;
    document.getElementById('qm-toss-bat-btn').classList.remove('active');
    document.getElementById('qm-toss-bowl-btn').classList.remove('active');
    if (choice === 'bat') document.getElementById('qm-toss-bat-btn').classList.add('active');
    else document.getElementById('qm-toss-bowl-btn').classList.add('active');
}

function parsePlayerNamesInput(str) {
    if (!str) return [];
    return str.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
}

function buildQuickTeam(name, playerNames) {
    const players = {};
    playerNames.forEach(n => {
        const pid = db.ref().push().key;
        players[pid] = { name: n, stats: { matches: 0, runs: 0, wickets: 0 } };
    });
    return {
        name,
        players,
        captain: Object.keys(players)[0] || null
    };
}

function startQuickMatch() {
    if (!isAdmin) return alert("Admin only.");
    const aName = document.getElementById('qm-teamA-name').value.trim();
    const bName = document.getElementById('qm-teamB-name').value.trim();
    const aPlayers = parsePlayerNamesInput(document.getElementById('qm-teamA-players').value);
    const bPlayers = parsePlayerNamesInput(document.getElementById('qm-teamB-players').value);
    const overs = parseInt(document.getElementById('qm-overs').value) || 10;
    const pin = document.getElementById('qm-pin').value;
    const tossWinnerSide = document.getElementById('qm-toss-winner').value; // 'A' or 'B'
    const tossChoice = document.getElementById('qm-toss-choice').value;

    if (!aName || !bName) return alert("Both teams need a name.");
    if (aName.toLowerCase() === bName.toLowerCase()) return alert("Team A and Team B can't have the same name.");
    if (aPlayers.length < 2 || bPlayers.length < 2) return alert("Each team needs at least 2 players (a striker and non-striker).");
    if (!pin) return alert("Please set a Scoring PIN.");
    if (!tossWinnerSide) return alert("Pick who won the toss.");

    const teamARef = db.ref().push().key;
    const teamBRef = db.ref().push().key;
    const quickTeams = {
        [teamARef]: buildQuickTeam(aName, aPlayers),
        [teamBRef]: buildQuickTeam(bName, bPlayers)
    };

    const tossWinnerId = tossWinnerSide === 'A' ? teamARef : teamBRef;
    const battingFirst = tossChoice === 'bat' ? tossWinnerId : (tossWinnerId === teamARef ? teamBRef : teamARef);
    const bowlingFirst = battingFirst === teamARef ? teamBRef : teamARef;

    const matchRef = db.ref('matches').push();
    const mid = matchRef.key;
    const updates = {};
    updates[`matches/${mid}`] = {
        timestamp: Date.now(),
        tournamentId: null,
        isQuickMatch: true,
        quickTeams,
        teamA: teamARef, teamB: teamBRef, oversLimit: overs,
        status: 'live',
        toss: { winner: tossWinnerId, choice: tossChoice },
        currentInnings: 1,
        state: {
            battingTeam: battingFirst, bowlingTeam: bowlingFirst,
            striker: null, nonStriker: null, bowler: null, lastBowler: null,
            runs: 0, wickets: 0, balls: 0, overs: "0.0",
            timeline: [], outPlayers: [], playerStats: {}, historyStack: []
        },
        innings1: null, innings2: null
    };
    updates[`matchPins/${mid}/pin`] = String(pin);
    db.ref().update(updates).catch(err => {
        console.error('Failed to start quick match:', err);
        alert('Failed to start quick match. ' + (err && err.message ? err.message : ''));
    });

    // Pre-warm teamsCache so the scoring view (which can attach its own
    // listener before the global matches listener fires) can resolve names
    // immediately without a flash of "unknown team".
    Object.entries(quickTeams).forEach(([id, t]) => {
        teamsCache[id] = Object.assign({}, t, { _ephemeral: true, _matchId: mid });
    });

    closeModal('modal-quick-match');
    openScoring(mid);
}

// =====================================================================
// MATCH LIST + FILTER
// =====================================================================
function setMatchFilter(value) {
    currentMatchFilter = value;
    renderMatchList();
}

function populateMatchFilterOptions() {
    const sel = document.getElementById('match-filter');
    if (!sel) return;
    const previous = currentMatchFilter;
    sel.innerHTML = `<option value="all">All Matches</option><option value="quick">⚡ Quick Matches</option>`;
    Object.entries(tournamentsCache).forEach(([tid, t]) => {
        sel.innerHTML += `<option value="${tid}">🏆 ${escapeHtml(t.name)}</option>`;
    });
    sel.value = previous;
    if (sel.value !== previous) { currentMatchFilter = 'all'; sel.value = 'all'; }
}

function renderMatchList() {
    const container = document.getElementById('matches-list');
    if (!container) return;

    let entries = Object.entries(matchesCache);
    if (currentMatchFilter === 'quick') {
        entries = entries.filter(([, m]) => m.isQuickMatch);
    } else if (currentMatchFilter !== 'all') {
        entries = entries.filter(([, m]) => m.tournamentId === currentMatchFilter);
    }

    if (entries.length === 0) {
        container.innerHTML = `<div class="empty-state"><strong>No matches yet</strong>Matches will appear here once started.</div>`;
        return;
    }
    container.innerHTML = renderMatchCards(entries);
}

function renderMatchCards(entries) {
    entries.sort((a, b) => {
        if (a[1].status === 'live' && b[1].status !== 'live') return -1;
        if (b[1].status === 'live' && a[1].status !== 'live') return 1;
        return (b[1].timestamp || 0) - (a[1].timestamp || 0);
    });

    return entries.map(([mid, m]) => {
        if (!teamsCache[m.teamA] || !teamsCache[m.teamB]) return '';

        const tA = teamsCache[m.teamA], tB = teamsCache[m.teamB];
        let inn1 = m.innings1 || { runs: 0, wickets: 0, overs: '0.0' };
        let inn2 = m.innings2 || { runs: 0, wickets: 0, overs: '0.0' };

        if (m.status === 'live') {
            if (m.currentInnings === 1) inn1 = { runs: m.state.runs, wickets: m.state.wickets, overs: m.state.overs };
            else inn2 = { runs: m.state.runs, wickets: m.state.wickets, overs: m.state.overs };
        }

        const bat1Name = m.toss.choice === 'bat' ? (m.toss.winner === m.teamA ? tA.name : tB.name) : (m.toss.winner === m.teamA ? tB.name : tA.name);
        const bat2Name = bat1Name === tA.name ? tB.name : tA.name;

        const statusBadge = m.status === 'live'
            ? `<div class="match-status status-live">● LIVE</div>`
            : `<div class="match-status status-completed">COMPLETED</div>`;

        let stageClass = '', stageLabel = '';
        if (m.isQuickMatch) {
            stageClass = 'stage-quick';
            stageLabel = '<span class="stage-badge badge-quick">⚡ Quick Match</span>';
        } else if (m.stage === 'semi') {
            stageClass = 'stage-semi';
            stageLabel = '<span class="stage-badge badge-semi">Semi-Final</span>';
        } else if (m.stage === 'third') {
            stageClass = 'stage-third';
            stageLabel = '<span class="stage-badge badge-third">3rd Place</span>';
        } else if (m.stage === 'final') {
            stageClass = 'stage-final';
            stageLabel = '<span class="stage-badge badge-final">🏆 Final</span>';
        }

        // Tournament name tag (for All-matches view)
        let tournamentTag = '';
        if (!m.isQuickMatch && m.tournamentId && tournamentsCache[m.tournamentId]) {
            tournamentTag = `<span style="font-size:0.7rem; color:#888; font-weight:600;">${escapeHtml(tournamentsCache[m.tournamentId].name)}</span>`;
        } else if (m.isQuickMatch) {
            tournamentTag = `<span style="font-size:0.7rem; color:#1d4e89; font-weight:600;">Quick Match</span>`;
        }

        let stageSelect = '';
        if (!m.isQuickMatch && isAdmin) {
            stageSelect = `
                <select class="admin-stage-select" onclick="event.stopPropagation();" onchange="event.stopPropagation(); updateMatchStage('${mid}', this.value)">
                    <option value="group" ${!m.stage || m.stage === 'group' ? 'selected' : ''}>Group</option>
                    <option value="semi" ${m.stage === 'semi' ? 'selected' : ''}>Semi-Final</option>
                    <option value="third" ${m.stage === 'third' ? 'selected' : ''}>3rd Place</option>
                    <option value="final" ${m.stage === 'final' ? 'selected' : ''}>Final</option>
                </select>`;
        }

        const shareBtn = `<button class="card-share-btn" onclick="event.stopPropagation(); shareMatch('${mid}')" aria-label="Share match">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
        </button>`;

        const adminControls = isAdmin ? `
            <div style="display:flex; gap:5px; align-items:center;">
                ${stageSelect}
                ${shareBtn}
                <button class="delete-match-btn" onclick="event.stopPropagation(); deleteMatch('${mid}')">🗑️ Delete</button>
            </div>` : `<div style="display:flex; gap:5px; align-items:center;">${shareBtn}</div>`;

        return `
            <div class="match-card ${stageClass}" onclick="openScoring('${mid}')">
                <div class="match-card-header">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${statusBadge}
                        ${stageLabel}
                        ${tournamentTag}
                    </div>
                    <div class="match-date-wrap">
                        <span class="match-date">${new Date(m.timestamp).toLocaleDateString()}</span>
                        ${adminControls}
                    </div>
                </div>
                <div class="match-teams-row">
                    <div class="match-team-col">
                        <div class="match-team-name">${escapeHtml(bat1Name)}</div>
                        <div class="match-team-score">${inn1.runs}<span class="match-team-wickets">/${inn1.wickets}</span> <span class="match-team-overs">(${inn1.overs})</span></div>
                    </div>
                    <div class="match-vs">VS</div>
                    <div class="match-team-col right-align">
                        <div class="match-team-name">${escapeHtml(bat2Name)}</div>
                        <div class="match-team-score">${inn2.runs}<span class="match-team-wickets">/${inn2.wickets}</span> <span class="match-team-overs">(${inn2.overs})</span></div>
                    </div>
                </div>
                <div class="match-result-bar">${escapeHtml(m.result || "Tap to View Details")}</div>
            </div>`;
    }).join('');
}

function updateMatchStage(mid, stage) {
    if (!isAdmin) return;
    db.ref(`matches/${mid}/stage`).set(stage);
}

// =====================================================================
// SCORING ENGINE (preserved + tournament-aware)
// =====================================================================
function openScoring(mid) {
    currentMatchId = mid;
    isScoringUnlocked = false;
    const loginContainerInit = document.getElementById('scorer-login-container');
    // Only show the "Unlock Scoring" entry to signed-in admins. Visitors
    // who arrive via a shared link just see the scorecard read-only.
    if (isAdmin) loginContainerInit.classList.remove('hidden');
    else loginContainerInit.classList.add('hidden');
    document.getElementById('scoring-pad').classList.add('hidden');
    document.getElementById('scorer-pin-input').value = '';
    switchTab('view-scoring');
    setMatchInUrl(mid);

    db.ref(`matches/${mid}`).once('value', snap => {
        const m = snap.val();
        if (m && m.status === 'completed') switchMatchTab('summary');
        else switchMatchTab('scorecard');
    });

    db.ref(`matches/${mid}`).off();
    db.ref(`matches/${mid}`).on('value', snap => {
        currentMatch = snap.val();
        if (!currentMatch) return switchTab('view-matches');
        const loginContainer = document.getElementById('scorer-login-container');
        const scoringPad = document.getElementById('scoring-pad');
        if (currentMatch.status === 'completed') {
            // Keep the "🔒 Scorer Access" entry available on completed matches
            // so signed-in admins can re-authenticate (e.g. after refresh) to
            // undo a match end or change the Player of the Match. Visitors
            // (no admin session) just see the scorecard read-only.
            if (isScoringUnlocked || !isAdmin) loginContainer.classList.add('hidden');
            else loginContainer.classList.remove('hidden');
            scoringPad.classList.add('hidden');
        } else if (isScoringUnlocked) {
            // Live match and the scorer was already unlocked (e.g. they were
            // scoring before an "Undo Match End" flipped status back to live).
            loginContainer.classList.add('hidden');
            scoringPad.classList.remove('hidden');
        }
        updateScoringUI();
    });
}

function openScorerModal() {
    document.getElementById('modal-scorer-login').style.display = 'flex';
    if (isAdmin) document.getElementById('admin-delete-match-div').classList.remove('hidden');
    else document.getElementById('admin-delete-match-div').classList.add('hidden');
}

function unlockScoring() {
    const input = (document.getElementById('scorer-pin-input').value || '').trim();
    if (!isAdmin) {
        return alert("Please sign in as an admin first (top-right Sign In button). Scoring writes are restricted to authenticated admins.");
    }
    const expected = getMatchPin(currentMatchId);
    if (!expected) {
        return alert("No PIN is set for this match yet. Refresh and try again.");
    }
    if (input === String(expected)) {
        isScoringUnlocked = true;
        document.getElementById('scorer-login-container').classList.add('hidden');
        if (currentMatch.status !== 'completed') {
            document.getElementById('scoring-pad').classList.remove('hidden');
        }
        closeModal('modal-scorer-login');
        updateScoringUI();
        renderSummary();
    } else alert("Wrong PIN");
}

function updateScoringUI() {
    if (!currentMatch || !currentMatch.state) return;
    const s = currentMatch.state;
    const getTeamName = (tid) => (teamsCache[tid] ? teamsCache[tid].name : "Loading...");
    const getName = (tid, pid) => (teamsCache[tid]?.players?.[pid]) ? teamsCache[tid].players[pid].name : "Select Player";

    const metaInfo = document.getElementById('match-meta-info');
    if (metaInfo && currentMatch.toss) {
        const tossWinnerName = teamsCache[currentMatch.toss.winner] ? teamsCache[currentMatch.toss.winner].name : "Team";
        const tossChoiceText = currentMatch.toss.choice === 'bat' ? 'Bat' : 'Bowl';
        const quickPrefix = currentMatch.isQuickMatch
            ? `<span style="background:rgba(255,255,255,0.18); padding:1px 6px; border-radius:4px; margin-right:6px; font-weight:700;">⚡ QUICK MATCH</span>`
            : '';
        metaInfo.innerHTML = `${quickPrefix}${currentMatch.oversLimit} Overs &bull; Toss: ${escapeHtml(tossWinnerName)} (${tossChoiceText})`;
    }

    const t1Name = document.getElementById('head-team1-name');
    const t1Score = document.getElementById('head-team1-score');
    const t1Overs = document.getElementById('head-team1-overs');
    const t2Name = document.getElementById('head-team2-name');
    const t2Score = document.getElementById('head-team2-score');
    const t2Overs = document.getElementById('head-team2-overs');

    if (t1Name && t2Name) {
        if (currentMatch.currentInnings === 1) {
            t1Name.innerText = getTeamName(s.battingTeam);
            t1Score.innerText = `${s.runs}/${s.wickets}`;
            t1Overs.innerText = `(${s.overs})`;
            t2Name.innerText = getTeamName(s.bowlingTeam);
            t2Score.innerText = "";
            t2Overs.innerText = "Yet to Bat";
        } else {
            const inn1 = currentMatch.innings1 || { runs: 0, wickets: 0, overs: '0.0', teamId: s.bowlingTeam };
            t1Name.innerText = getTeamName(inn1.teamId);
            t1Score.innerText = `${inn1.runs}/${inn1.wickets}`;
            t1Overs.innerText = `(${inn1.overs})`;
            t2Name.innerText = getTeamName(s.battingTeam);
            t2Score.innerText = `${s.runs}/${s.wickets}`;
            t2Overs.innerText = `(${s.overs})`;
        }
    }

    const balls = ballsFromOvers(s.overs);
    const crrElement = document.getElementById('display-crr');
    if (crrElement) crrElement.innerText = balls > 0 ? (s.runs / (balls / 6)).toFixed(2) : "0.00";

    const statusText = document.getElementById('match-status-text');
    if (statusText) statusText.innerText = currentMatch.status === 'completed' ? 'Completed' : 'Live';

    const oversBtn = document.getElementById('overs-limit-btn');
    if (oversBtn) oversBtn.innerText = `⏱ Overs: ${currentMatch.oversLimit || '-'}`;

    const targetMsg = document.getElementById('target-msg');
    const liveScoringInfo = document.getElementById('live-scoring-info');

    if (currentMatch.status === 'completed') {
        targetMsg.innerText = currentMatch.result || "Match Ended";
        targetMsg.style.background = "var(--uwb-gold)";
        targetMsg.style.color = "var(--uwb-purple)";
        targetMsg.style.display = 'inline-block';
        if (liveScoringInfo) liveScoringInfo.style.display = 'none';
    } else if (currentMatch.currentInnings === 2 && currentMatch.innings1) {
        if (liveScoringInfo) liveScoringInfo.style.display = 'block';
        const target = currentMatch.innings1.runs + 1;
        const runsNeed = target - s.runs;
        const ballsLeft = (currentMatch.oversLimit * 6) - ballsFromOvers(s.overs);

        if (s.runs >= target) {
            targetMsg.innerText = "Target Reached!";
            targetMsg.style.background = "#2e7d32";
            targetMsg.style.color = "white";
        } else if (s.wickets >= maxWicketsFor(s.battingTeam) || ballsLeft <= 0) {
            targetMsg.innerText = (runsNeed > 0) ? "Match Ended" : "Match Tied";
            targetMsg.style.background = (runsNeed > 0) ? "#d32f2f" : "#555";
            targetMsg.style.color = "white";
        } else {
            targetMsg.innerText = `Need ${runsNeed} off ${ballsLeft}`;
            targetMsg.style.background = "var(--uwb-gold)";
            targetMsg.style.color = "black";
        }
        targetMsg.style.display = 'inline-block';
    } else {
        if (liveScoringInfo) liveScoringInfo.style.display = 'block';
        targetMsg.style.display = 'none';
    }

    const pStats = s.playerStats || {};
    const st = pStats[s.striker] || { runs: 0, balls: 0 };
    document.getElementById('striker-name').innerText = `${getName(s.battingTeam, s.striker)} * ${st.runs}(${st.balls})`;
    const nst = pStats[s.nonStriker] || { runs: 0, balls: 0 };
    document.getElementById('non-striker-name').innerText = `${getName(s.battingTeam, s.nonStriker)} ${nst.runs}(${nst.balls})`;

    const btns = document.querySelectorAll('.control-btn');
    const bowlerNameElem = document.getElementById('bowler-name');
    const bowlerFigsElem = document.getElementById('bowler-figs');

    if (!s.bowler) {
        btns.forEach(b => { b.disabled = true; b.style.opacity = 0.5; });
        bowlerNameElem.style.border = "2px solid red";
        bowlerNameElem.innerText = "Select Bowler";
        bowlerFigsElem.innerText = "";
    } else {
        btns.forEach(b => { b.disabled = false; b.style.opacity = 1; });
        bowlerNameElem.style.border = "none";
        const bst = pStats[s.bowler] || { wickets: 0, runsConceded: 0, ballsBowled: 0 };
        const bovers = Math.floor(bst.ballsBowled / 6) + '.' + (bst.ballsBowled % 6);
        bowlerNameElem.innerText = getName(s.bowlingTeam, s.bowler);
        bowlerFigsElem.innerText = `(${bst.wickets}-${bst.runsConceded} in ${bovers})`;
    }

    const historyContainer = document.getElementById('ball-history');
    if (historyContainer) {
        const fullHtml = [];
        const timeline = s.timeline || [];
        if (timeline.length === 0) {
            fullHtml.push('<span style="color:#aaa; font-style:italic;">No balls bowled yet</span>');
        } else {
            timeline.forEach(event => {
                let style = 'flex-shrink:0; font-size:1.1rem; ';
                if (String(event).includes('W')) style += 'color:#d32f2f; font-weight:bold;';
                else if (event === '4' || event === '6' || event === 4 || event === 6) style += 'color:#2e7d32; font-weight:bold;';
                else if (event === '|') style += 'color:#aaa; font-weight:normal; margin:0 4px; font-size:1.2em;';
                else style += 'color:var(--uwb-black); font-weight:600;';
                fullHtml.push(`<span style="${style}">${event}</span>`);
            });
        }
        historyContainer.innerHTML = fullHtml.join('');
        setTimeout(() => { historyContainer.scrollLeft = historyContainer.scrollWidth; }, 10);
    }

    const pinBadge = document.getElementById('admin-show-pin');
    if (pinBadge) {
        const visiblePin = isAdmin ? getMatchPin(currentMatchId) : null;
        if (visiblePin) {
            pinBadge.innerText = `🔑 PIN: ${visiblePin}`;
            pinBadge.classList.remove('hidden');
        } else {
            pinBadge.classList.add('hidden');
        }
    }

    const summaryBtn = document.getElementById('mtab-summary');
    if (summaryBtn) summaryBtn.style.display = (currentMatch.status === 'completed') ? '' : 'none';

    document.getElementById('match-tabs').classList.remove('hidden');
    if (currentMatchTab === 'scorecard') renderScorecard();
    else if (currentMatchTab === 'summary') renderSummary();
    else if (currentMatchTab === 'commentary') renderCommentary();
}

// =====================================================================
// COMMENTARY / SCORECARD / SUMMARY
// =====================================================================
function renderCommentary() {
    const container = document.getElementById('tab-commentary');
    if (!container) return;
    let log = [];
    const getArray = (obj) => obj ? (Array.isArray(obj) ? obj.filter(Boolean) : Object.values(obj).filter(Boolean)) : [];

    if (currentMatch.status === 'live') {
        log = getArray(currentMatch.state.commentaryLog);
        if (currentMatch.currentInnings === 2 && currentMatch.innings1?.commentaryLog) {
            log = [...getArray(currentMatch.innings1.commentaryLog), ...log];
        }
    } else {
        const log1 = (currentMatch.innings1) ? getArray(currentMatch.innings1.commentaryLog) : [];
        const log2 = (currentMatch.innings2) ? getArray(currentMatch.innings2.commentaryLog) : [];
        log = [...log1, ...log2];
    }

    if (log.length === 0) {
        container.innerHTML = "<div class='card' style='text-align:center; padding: 20px; color:#666;'>No commentary available yet. Play a ball to start.</div>";
        return;
    }

    let html = `<div class="comm-list">`;
    for (let i = log.length - 1; i >= 0; i--) {
        const item = log[i];
        if (!item) continue;
        if (item.type === 'ball') {
            let label = item.label;
            if (!label) {
                if (item.text.includes("OUT!")) label = 'W';
                else if (item.text.includes("RUN OUT!")) label = 'W';
                else if (item.text.includes("Wide")) {
                    const m = item.text.match(/(\d+) extra/); label = m ? `WD+${m[1]}` : 'WD';
                } else if (item.text.includes("No ball")) {
                    const m = item.text.match(/(\d+) run/); label = m ? `NB+${m[1]}` : 'NB';
                } else if (item.text.includes("Bye!")) {
                    const m = item.text.match(/(\d+) run/); label = m ? `B${m[1]}` : 'B1';
                } else {
                    const m = item.text.match(/(\d+) run/); label = m ? m[1] : '0';
                }
            }
            let circleClass = 'run-circle';
            const strLabel = String(label);
            if (strLabel === 'W' || strLabel.includes('W ')) circleClass += ' rc-w';
            else if (strLabel === '4') circleClass += ' rc-4';
            else if (strLabel === '6') circleClass += ' rc-6';
            else if (strLabel === '0') circleClass += ' rc-0';
            else if (strLabel.includes('NB') || strLabel.includes('WD') || strLabel.startsWith('B')) circleClass += ' rc-extra';

            html += `<div class="comm-ball">
                        <div class="${circleClass}">${label}</div>
                        <div class="comm-text"><strong>${item.over}</strong>: ${item.text}</div>
                     </div>`;
        } else if (item.type === 'eoo') {
            if (item.striker) {
                html += `<div class="comm-eoo">
                            <div class="comm-eoo-header">
                                <span>End of over ${item.overNum}</span>
                                <div style="text-align:right;">
                                    <span style="color:var(--uwb-purple);">${escapeHtml(item.teamName)} ${item.score}</span>
                                    ${item.targetHtml ? `<div style="font-size:0.75rem; color:#888; font-weight:normal; margin-top:2px;">${item.targetHtml}</div>` : ''}
                                </div>
                            </div>
                            <div class="comm-eoo-runs">${item.runsThisOver} Runs • <strong style="font-family:monospace; font-size:1.1em; letter-spacing:1px;">${item.timelineThisOver}</strong></div>
                            <div class="comm-eoo-grid">
                                <div class="comm-eoo-batters">
                                    <div class="comm-eoo-player"><span>${escapeHtml(item.striker.name)} *</span> <span>${item.striker.runs} <span style="color:#888;font-size:0.8em">(${item.striker.balls})</span></span></div>
                                    <div class="comm-eoo-player"><span>${escapeHtml(item.nonStriker?.name || '-')}</span> <span>${item.nonStriker?.runs || 0} <span style="color:#888;font-size:0.8em">(${item.nonStriker?.balls || 0})</span></span></div>
                                </div>
                                <div class="comm-eoo-bowler">
                                    <div class="comm-eoo-player" style="justify-content: flex-end; font-weight:bold; color:var(--uwb-purple);"><span>${escapeHtml(item.bowler.name)}</span></div>
                                    <div class="comm-eoo-player" style="justify-content: flex-end;"><span>${item.bowler.wickets}/${item.bowler.runs} <span style="color:#888;font-size:0.8em">(${item.bowler.overs})</span></span></div>
                                </div>
                            </div>
                         </div>`;
            } else {
                html += `<div class="comm-eoo">
                            <div class="comm-eoo-header"><span>End of over ${item.overNum}</span><span>Score: ${item.score}</span></div>
                            <div class="comm-eoo-runs" style="color:var(--uwb-purple); font-weight:bold;">${escapeHtml(item.bowler)}</div>
                         </div>`;
            }
        } else if (item.type === 'eoi') {
            const tgtHtml = item.targetMsg ? `<div class="target">${item.targetMsg}</div>` : '';
            html += `<div class="comm-eoi"><div>${item.text}</div>${tgtHtml}</div>`;
        }
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderSummary() {
    const container = document.getElementById('tab-summary');
    let html = ``;

    if (currentMatch.status === 'completed') {
        const hasPOTM = currentMatch.potm != null;
        const canEdit = (isAdmin || isScoringUnlocked);

        // Surface an "Undo Match End" affordance for the scorer / admin
        // in case the match was finished by accident.
        if (canEdit && currentMatch.preInningsEnd && currentMatch.preInningsEnd.inningsThatJustEnded === 2) {
            html += `<div class="card" style="text-align:center; padding:12px; margin-bottom:15px; border:1px dashed #d4c8eb; background:#faf7ff;">
                        <div style="font-size:0.78rem; color:#666; margin-bottom:8px;">Finished the match by mistake?</div>
                        <button class="secondary small-btn" onclick="undoInningsEnd()">↩ Undo Match End</button>
                     </div>`;
        }

        if (hasPOTM) {
            html += `<div class="summary-potm-box">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:#444;">Player of the Match</div>
                        <div style="font-size:1.3rem;">🏆 ${escapeHtml(currentMatch.potm.name)}</div>
                        ${canEdit ? `<button class="secondary small-btn" style="margin-top:10px;" onclick="openPOTMModal()">Change</button>` : ''}
                     </div>`;
        } else if (canEdit) {
            html += `<div class="summary-potm-box">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:#444;">Player of the Match</div>
                        <button class="gold small-btn" style="margin-top:10px;" onclick="openPOTMModal()">Assign Player of the Match</button>
                     </div>`;
        } else {
            html += `<div class="summary-potm-box" style="background:transparent; border: 1px dashed #ccc; cursor:pointer;" onclick="promptScorerPin()">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:#888;">Player of the Match 🔒</div>
                        <div style="font-size:0.9rem; color:#666; margin-top:5px; font-style:italic;">Pending</div>
                     </div>`;
        }
    }

    const getTop = (statsObj, isBat) => {
        if (!statsObj) return [];
        const arr = Object.keys(statsObj).map(pid => ({ pid, ...statsObj[pid] }));
        if (isBat) return arr.filter(p => p.runs !== undefined).sort((a, b) => b.runs - a.runs).slice(0, 3);
        return arr.filter(p => p.ballsBowled > 0).sort((a, b) => {
            const wA = a.wickets || 0, wB = b.wickets || 0;
            if (wB !== wA) return wB - wA;
            const ecoA = a.runsConceded / (a.ballsBowled || 1);
            const ecoB = b.runsConceded / (b.ballsBowled || 1);
            return ecoA - ecoB;
        }).slice(0, 3);
    };

    const i1Stats = (currentMatch.status === 'completed') ? currentMatch.innings1?.playerStats : currentMatch.state?.playerStats;
    const i1BatId = (currentMatch.status === 'completed') ? currentMatch.innings1?.teamId : currentMatch.state?.battingTeam;
    const i1BowlId = (i1BatId === currentMatch.teamA) ? currentMatch.teamB : currentMatch.teamA;

    if (i1Stats && i1BatId && teamsCache[i1BatId]) {
        const topBats = getTop(i1Stats, true);
        const topBowls = getTop(i1Stats, false);
        html += `<div class="summary-team-header">${escapeHtml(teamsCache[i1BatId].name)} Innings</div><div class="summary-grid">
                    <div class="summary-card"><div class="summary-card-title">Top Batters</div>`;
        topBats.forEach(p => { const nm = teamsCache[i1BatId]?.players?.[p.pid]?.name || '-'; html += `<div class="summary-row"><span class="summary-name">${escapeHtml(nm)}</span> <strong>${p.runs} <span style="color:#888; font-size:0.8em; font-weight:normal;">(${p.balls})</span></strong></div>`; });
        html += `</div><div class="summary-card"><div class="summary-card-title">Top Bowlers</div>`;
        topBowls.forEach(p => { const nm = teamsCache[i1BowlId]?.players?.[p.pid]?.name || '-'; const ov = Math.floor(p.ballsBowled / 6) + '.' + (p.ballsBowled % 6); html += `<div class="summary-row"><span class="summary-name">${escapeHtml(nm)}</span> <strong>${p.wickets}/${p.runsConceded} <span style="color:#888; font-size:0.8em; font-weight:normal;">(${ov})</span></strong></div>`; });
        html += `</div></div>`;
    }

    if (currentMatch.currentInnings === 2 || currentMatch.status === 'completed') {
        const i2Stats = (currentMatch.status === 'completed') ? currentMatch.innings2?.playerStats : currentMatch.state?.playerStats;
        const i2BatId = (currentMatch.status === 'completed') ? currentMatch.innings2?.teamId : currentMatch.state?.battingTeam;
        const i2BowlId = (i2BatId === currentMatch.teamA) ? currentMatch.teamB : currentMatch.teamA;
        if (i2Stats && i2BatId && teamsCache[i2BatId]) {
            const topBats2 = getTop(i2Stats, true);
            const topBowls2 = getTop(i2Stats, false);
            html += `<div class="summary-team-header">${escapeHtml(teamsCache[i2BatId].name)} Innings</div><div class="summary-grid">
                        <div class="summary-card"><div class="summary-card-title">Top Batters</div>`;
            topBats2.forEach(p => { const nm = teamsCache[i2BatId]?.players?.[p.pid]?.name || '-'; html += `<div class="summary-row"><span class="summary-name">${escapeHtml(nm)}</span> <strong>${p.runs} <span style="color:#888; font-size:0.8em; font-weight:normal;">(${p.balls})</span></strong></div>`; });
            html += `</div><div class="summary-card"><div class="summary-card-title">Top Bowlers</div>`;
            topBowls2.forEach(p => { const nm = teamsCache[i2BowlId]?.players?.[p.pid]?.name || '-'; const ov = Math.floor(p.ballsBowled / 6) + '.' + (p.ballsBowled % 6); html += `<div class="summary-row"><span class="summary-name">${escapeHtml(nm)}</span> <strong>${p.wickets}/${p.runsConceded} <span style="color:#888; font-size:0.8em; font-weight:normal;">(${ov})</span></strong></div>`; });
            html += `</div></div>`;
        }
    }
    container.innerHTML = html;
}

function renderScorecard() {
    const container = document.getElementById('scorecard-container');
    container.innerHTML = '';

    const getSafeName = (tid, pid) => (teamsCache[tid]?.players?.[pid]) ? teamsCache[tid].players[pid].name : "Loading...";
    const safeArray = (obj) => obj ? (Array.isArray(obj) ? obj : Object.values(obj)) : [];

    let targetStats = null, batTeamId = null, bowlTeamId = null, outArray = [];
    let totalInningsRuns = 0;

    if (currentInningTab === 1) {
        if (currentMatch.innings1?.playerStats) {
            targetStats = currentMatch.innings1.playerStats; batTeamId = currentMatch.innings1.teamId;
            outArray = safeArray(currentMatch.innings1.outPlayers);
            totalInningsRuns = currentMatch.innings1.runs || 0;
        } else if (currentMatch.status === 'live' && currentMatch.currentInnings === 1) {
            targetStats = currentMatch.state.playerStats; batTeamId = currentMatch.state.battingTeam;
            outArray = safeArray(currentMatch.state.outPlayers);
            totalInningsRuns = currentMatch.state.runs || 0;
        }
    } else {
        if (currentMatch.innings2?.playerStats) {
            targetStats = currentMatch.innings2.playerStats; batTeamId = currentMatch.innings2.teamId;
            outArray = safeArray(currentMatch.innings2.outPlayers);
            totalInningsRuns = currentMatch.innings2.runs || 0;
        } else if (currentMatch.status === 'live' && currentMatch.currentInnings === 2) {
            targetStats = currentMatch.state.playerStats; batTeamId = currentMatch.state.battingTeam;
            outArray = safeArray(currentMatch.state.outPlayers);
            totalInningsRuns = currentMatch.state.runs || 0;
        } else {
            const inn1BatId = currentMatch.innings1?.teamId || currentMatch.state?.battingTeam;
            if (inn1BatId) batTeamId = (inn1BatId === currentMatch.teamA) ? currentMatch.teamB : currentMatch.teamA;
        }
    }

    if (!targetStats) {
        if (batTeamId && teamsCache[batTeamId]) {
            const batCaptId = teamsCache[batTeamId].captain;
            const allPlayers = Object.keys(teamsCache[batTeamId].players || {});
            let html = `<div class="scorecard-block"><table class="scorecard-table"><thead><tr><th>BATTERS</th></tr></thead><tbody>`;
            allPlayers.forEach(pid => {
                let name = getSafeName(batTeamId, pid);
                if (pid === batCaptId) name += ' (c)';
                html += `<tr><td class="batter-name-cell"><span class="p-name">${escapeHtml(name)}</span></td></tr>`;
            });
            html += `</tbody></table></div>`;
            container.innerHTML = html;
            return;
        }
        container.innerHTML = `<div class="card" style="text-align:center;">Innings ${currentInningTab} has not started yet.</div>`;
        return;
    }

    bowlTeamId = (batTeamId === currentMatch.teamA) ? currentMatch.teamB : currentMatch.teamA;
    const sState = (currentMatch.status === 'live' && currentMatch.currentInnings === currentInningTab) ? currentMatch.state : null;
    const batCaptId = teamsCache[batTeamId] ? teamsCache[batTeamId].captain : null;
    const bowlCaptId = teamsCache[bowlTeamId] ? teamsCache[bowlTeamId].captain : null;

    const batArr = [], bowlArr = [];
    let bIdx = 0, boIdx = 0, totalBatRuns = 0;

    Object.keys(targetStats).forEach(pid => {
        const st = targetStats[pid];
        if (st.runs !== undefined || st.balls !== undefined) { batArr.push({ pid, idx: bIdx++, ...st }); totalBatRuns += (st.runs || 0); }
        if (st.ballsBowled !== undefined && st.ballsBowled > 0) bowlArr.push({ pid, idx: boIdx++, ...st });
    });

    let extraRuns = totalInningsRuns - totalBatRuns;
    if (extraRuns < 0) extraRuns = 0;

    batArr.sort((a, b) => (a.batOrder !== undefined ? a.batOrder : a.idx + 99) - (b.batOrder !== undefined ? b.batOrder : b.idx + 99));
    bowlArr.sort((a, b) => (a.bowlOrder !== undefined ? a.bowlOrder : a.idx + 99) - (b.bowlOrder !== undefined ? b.bowlOrder : b.idx + 99));

    let html = `<div class="scorecard-block"><table class="scorecard-table"><thead><tr><th>BATTERS</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>`;
    const battedPlayerIds = batArr.map(p => p.pid);

    batArr.forEach(st => {
        const pid = st.pid;
        const sr = st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(2) : "0.00";
        let disText = "not out";
        if (st.dismissal) disText = st.dismissal;
        else if (outArray.includes(pid)) disText = "out";
        const star = (sState && (pid === sState.striker || pid === sState.nonStriker)) ? '<span style="color:var(--danger); font-weight:bold;">*</span>' : '';
        const captTag = (pid === batCaptId) ? ' (c)' : '';

        html += `<tr><td class="batter-name-cell"><span class="p-name">${escapeHtml(getSafeName(batTeamId, pid))}${captTag} ${star} <span class="dismissal-text">${escapeHtml(disText)}</span></span></td>
            <td class="bold-stat">${st.runs || 0}</td><td>${st.balls || 0}</td><td>${st.fours || 0}</td><td>${st.sixes || 0}</td><td>${sr}</td></tr>`;
    });

    const allPlayers = Object.keys(teamsCache[batTeamId].players || {});
    const yetToBatNames = allPlayers.filter(pid => !battedPlayerIds.includes(pid)).map(pid => {
        let name = getSafeName(batTeamId, pid);
        if (pid === batCaptId) name += ' (c)';
        return escapeHtml(name);
    });

    if (yetToBatNames.length > 0) {
        html += `<tr><td colspan="6" style="text-align:left; font-size:0.8rem; color:#666;"><strong>Yet to bat:</strong> ${yetToBatNames.join(', ')}</td></tr>`;
    }
    html += `<tr><td class="batter-name-cell"><strong>Extra Runs</strong> <span style="font-size:0.75rem; color:#888; font-weight:normal;">(WD, NB, B)</span></td><td class="bold-stat">${extraRuns}</td><td colspan="4"></td></tr>`;
    html += `</tbody></table></div>`;

    html += `<div class="scorecard-block"><table class="scorecard-table"><thead><tr><th>BOWLERS</th><th>O</th><th>R</th><th>W</th><th>EX</th><th>ECON</th></tr></thead><tbody>`;
    let totalExtras = 0;
    bowlArr.forEach(st => {
        const pid = st.pid;
        totalExtras += (st.extras || 0);
        const star = (sState && pid === sState.bowler) ? '<span style="color:var(--danger); font-weight:bold;">*</span>' : '';
        const captTag = (pid === bowlCaptId) ? ' (c)' : '';
        const overs = Math.floor(st.ballsBowled / 6) + '.' + (st.ballsBowled % 6);
        const eco = (st.runsConceded / (st.ballsBowled / 6 || 1)).toFixed(2);
        html += `<tr><td class="batter-name-cell"><span class="p-name">${escapeHtml(getSafeName(bowlTeamId, pid))}${captTag} ${star}</span></td>
            <td>${overs}</td><td>${st.runsConceded}</td><td class="bold-stat">${st.wickets}</td><td>${st.extras || 0}</td><td>${eco}</td></tr>`;
    });
    html += `<tr><td colspan="4" style="text-align:left;"><strong>Extras</strong></td><td colspan="2" style="text-align:center;"><strong>${totalExtras}</strong></td></tr>`;
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// =====================================================================
// POTM
// =====================================================================
function openPOTMModal() {
    const select = document.getElementById('potm-select');
    select.innerHTML = '<option value="">Select Player...</option>';
    let winnerId = null;
    const i1 = currentMatch.innings1, i2 = currentMatch.innings2;
    if (i1 && i2) {
        if ((i2.runs || 0) > (i1.runs || 0)) winnerId = i2.teamId;
        else if ((i1.runs || 0) > (i2.runs || 0)) winnerId = i1.teamId;
    }
    const teamsToShow = winnerId ? [winnerId] : [currentMatch.teamA, currentMatch.teamB];

    // If a POTM is already set but they're from a team we wouldn't normally
    // list (e.g. the loser, in an edge case), include their team too so the
    // current selection actually appears in the dropdown.
    if (currentMatch.potm && currentMatch.potm.teamId && !teamsToShow.includes(currentMatch.potm.teamId)) {
        teamsToShow.push(currentMatch.potm.teamId);
    }

    teamsToShow.forEach(tid => {
        if (!teamsCache[tid]) return;
        const group = document.createElement('optgroup');
        group.label = teamsCache[tid].name;
        const players = teamsCache[tid].players || {};
        Object.entries(players).forEach(([pid, p]) => {
            const opt = document.createElement('option');
            opt.value = `${tid}|${pid}|${p.name}`;
            opt.text = p.name;
            group.appendChild(opt);
        });
        select.appendChild(group);
    });

    // Preselect the current POTM so the modal acts like an Edit dialog.
    if (currentMatch.potm && currentMatch.potm.playerId) {
        const target = `${currentMatch.potm.teamId}|${currentMatch.potm.playerId}|${currentMatch.potm.name}`;
        select.value = target;
    }

    document.getElementById('modal-potm').style.display = 'flex';
}

function savePOTM() {
    const val = document.getElementById('potm-select').value;
    if (!val) return alert("Select a player");
    const [tid, pid, name] = val.split('|');
    db.ref(`matches/${currentMatchId}/potm`).set({ teamId: tid, playerId: pid, name }, err => {
        if (!err) {
            closeModal('modal-potm');
            currentMatch.potm = { teamId: tid, playerId: pid, name };
            renderSummary();
        }
    });
}

function promptScorerPin() {
    if (!isAdmin) {
        return alert("Please sign in as an admin first (top-right Sign In button). Scorer actions are restricted to authenticated admins.");
    }
    const pin = prompt("Enter Match PIN to unlock Scorer features:");
    if (pin == null) return;
    const expected = getMatchPin(currentMatchId);
    if (expected && pin === String(expected)) {
        isScoringUnlocked = true;
        renderSummary();
    } else if (pin) alert("Incorrect PIN");
}

// =====================================================================
// GAME STATE OPS (undo, swap, wicket, score)
// =====================================================================
function saveState() {
    const stateCopy = JSON.parse(JSON.stringify(currentMatch.state));
    delete stateCopy.historyStack;
    const stack = currentMatch.state.historyStack ? [...currentMatch.state.historyStack] : [];
    if (stack.length > 18) stack.shift();
    stack.push(stateCopy);
    return stack;
}

function undoLastBall() {
    if (!currentMatch) return;
    const s = currentMatch.state || {};

    // 1) Normal ball-by-ball undo within the current innings
    if (s.historyStack && s.historyStack.length > 0) {
        const currentStack = [...s.historyStack];
        const previousState = currentStack.pop();
        previousState.historyStack = currentStack;
        db.ref(`matches/${currentMatchId}/state`).set(previousState);
        return;
    }

    // 2) Nothing left to undo within this innings — see if we can step back
    //    across the most recent innings/match end.
    if (currentMatch.preInningsEnd) {
        undoInningsEnd();
        return;
    }

    alert("Nothing to undo.");
}

function generateEOOBlock(matchState, runsSum, wktsSum, newBalls, timelineArr, pStatsMap, overNum, newStrikerId, newNonStrikerId) {
    const overEvents = [];
    for (let i = timelineArr.length - 1; i >= 0; i--) {
        if (timelineArr[i] === '|') { if (i === timelineArr.length - 1) continue; break; }
        overEvents.unshift(timelineArr[i]);
    }
    let runsThisOver = overEvents.reduce((sum, item) => {
        const str = String(item);
        if (str.startsWith('W') && !str.startsWith('WD')) return sum;
        if (str === 'WD' || str === 'NB') return sum + 1;
        if (str.includes('+')) return sum + 1 + (parseInt(str.split('+')[1]) || 0);
        if (str.startsWith('B')) return sum + (parseInt(str.replace('B', '')) || 0);
        return sum + (parseInt(str) || 0);
    }, 0);
    runsThisOver = runsThisOver || 0;

    const getName = (tid, pid) => (pid && teamsCache[tid]?.players?.[pid]) ? teamsCache[tid].players[pid].name : "-";
    const eooSt = pStatsMap[matchState.bowler] || { wickets: 0, runsConceded: 0, ballsBowled: 0 };
    const bOvers = Math.floor(eooSt.ballsBowled / 6) + '.' + (eooSt.ballsBowled % 6);

    let targetHtml = "";
    if (currentMatch.currentInnings === 2 && currentMatch.innings1) {
        const target = currentMatch.innings1.runs + 1;
        const runsNeeded = target - runsSum;
        const ballsLeft = (currentMatch.oversLimit * 6) - newBalls;
        if (runsNeeded > 0 && ballsLeft > 0) targetHtml = `${runsNeeded} of ${ballsLeft} left`;
        else if (runsNeeded <= 0) targetHtml = `Target reached`;
    }

    return {
        type: 'eoo', overNum,
        runsThisOver, timelineThisOver: overEvents.join(' '),
        teamName: teamsCache[matchState.battingTeam]?.name || "Team",
        score: `${runsSum}/${wktsSum}`,
        striker: { name: getName(matchState.battingTeam, newStrikerId), runs: pStatsMap[newStrikerId]?.runs || 0, balls: pStatsMap[newStrikerId]?.balls || 0 },
        nonStriker: { name: getName(matchState.battingTeam, newNonStrikerId), runs: pStatsMap[newNonStrikerId]?.runs || 0, balls: pStatsMap[newNonStrikerId]?.balls || 0 },
        bowler: { name: getName(matchState.bowlingTeam, matchState.bowler), wickets: eooSt.wickets, runs: eooSt.runsConceded, overs: bOvers },
        targetHtml
    };
}

function addScore(runsInput) {
    const s = currentMatch.state;
    if (!s.bowler) return alert("Select a Bowler first!");
    if (!s.striker || !s.nonStriker) return alert("Select Strikers first!");

    const newStack = saveState();
    let runs = 0, extra = 0, isLegal = true, label = runsInput, physicalRuns = 0;

    if (typeof runsInput === 'number') { runs = runsInput; physicalRuns = runs; }
    else if (runsInput === 'NB') {
        const batRunsStr = prompt("Runs scored off the bat on this No Ball? (0-6)", "0");
        if (batRunsStr === null) return;
        const batRuns = parseInt(batRunsStr) || 0;
        runs = batRuns; extra = 1; isLegal = false; physicalRuns = batRuns;
        label = batRuns > 0 ? `NB+${batRuns}` : 'NB';
    } else if (runsInput === 'WD') {
        const extraRunsStr = prompt("Additional extra runs on this Wide? (0-6)", "0");
        if (extraRunsStr === null) return;
        const additionalExtras = parseInt(extraRunsStr) || 0;
        runs = 0; extra = 1 + additionalExtras; isLegal = false; physicalRuns = additionalExtras;
        label = additionalExtras > 0 ? `WD+${additionalExtras}` : 'WD';
    } else if (runsInput === 'BYE') {
        const byeRunsStr = prompt("Number of Byes? (1-6)", "1");
        if (byeRunsStr === null) return;
        const byeRuns = parseInt(byeRunsStr) || 0;
        runs = 0; extra = byeRuns; isLegal = true; physicalRuns = byeRuns;
        label = `B${byeRuns}`;
    }

    const newTotal = s.runs + runs + extra;
    let newBalls = s.balls;
    let swapNeeded = (physicalRuns % 2 !== 0);
    let forceBowlerChange = false;

    if (isLegal) {
        newBalls++;
        if (newBalls % 6 === 0) { swapNeeded = !swapNeeded; forceBowlerChange = true; }
    }

    const pStats = s.playerStats || {};
    let nextBat = Math.max(0, ...Object.values(pStats).map(p => p.batOrder || 0)) + 1;
    if (!pStats[s.striker]) { pStats[s.striker] = { runs: 0, balls: 0, fours: 0, sixes: 0, batOrder: nextBat++ }; }
    if (!pStats[s.nonStriker]) { pStats[s.nonStriker] = { runs: 0, balls: 0, fours: 0, sixes: 0, batOrder: nextBat++ }; }

    if (isLegal || runsInput === 'NB') pStats[s.striker].balls++;
    if (isLegal || runsInput === 'NB') {
        pStats[s.striker].runs += runs;
        if (runs === 4) pStats[s.striker].fours++;
        if (runs === 6) pStats[s.striker].sixes++;
    }

    let nextBowl = Math.max(0, ...Object.values(pStats).map(p => p.bowlOrder || 0)) + 1;
    if (!pStats[s.bowler]) pStats[s.bowler] = { ballsBowled: 0, runsConceded: 0, wickets: 0, extras: 0, bowlOrder: nextBowl++ };

    if (isLegal) pStats[s.bowler].ballsBowled++;
    if (runsInput !== 'BYE') pStats[s.bowler].runsConceded += (runs + extra);
    if (!isLegal) pStats[s.bowler].extras += 1;

    const newTimeline = [...(s.timeline || []), label];
    if (isLegal && newBalls % 6 === 0) newTimeline.push('|');

    const o = Math.floor(newBalls / 6), b = newBalls % 6;
    let commLog = [];
    if (s.commentaryLog) {
        commLog = Array.isArray(s.commentaryLog) ? [...s.commentaryLog] : Object.values(s.commentaryLog);
        commLog = commLog.filter(item => item != null);
    }
    let dispO = o, dispB = b;
    if (isLegal && b === 0 && newBalls > 0) { dispO = o - 1; dispB = 6; }

    const bowlerName = teamsCache[s.bowlingTeam]?.players?.[s.bowler]?.name || "Bowler";
    const strikerName = teamsCache[s.battingTeam]?.players?.[s.striker]?.name || "Batter";
    let commText = "";
    if (runsInput === 'WD') { commText = "Wide!"; if (physicalRuns > 0) commText += ` ${physicalRuns} extra run${physicalRuns > 1 ? 's' : ''}.`; }
    else if (runsInput === 'NB') { commText = "No ball!"; if (runs > 0) commText += ` ${runs} runs.`; }
    else if (runsInput === 'BYE') { commText = `Bye! ${physicalRuns} run${physicalRuns > 1 ? 's' : ''}.`; }
    else if (runs === 0) commText = "No runs.";
    else commText = `${runs} run${runs > 1 ? 's' : ''}.`;
    commLog.push({ type: 'ball', over: `${dispO}.${dispB}`, label, text: `${bowlerName} to ${strikerName}. ${commText}` });

    const nextStriker = swapNeeded ? s.nonStriker : s.striker;
    const nextNonStriker = swapNeeded ? s.striker : s.nonStriker;

    let isMatchEnding = false;
    if (currentMatch.currentInnings === 2 && newTotal >= (currentMatch.innings1?.runs + 1)) isMatchEnding = true;
    if (newBalls >= currentMatch.oversLimit * 6) isMatchEnding = true;

    if ((isLegal && newBalls > 0 && newBalls % 6 === 0) || isMatchEnding) {
        const eooOver = (isMatchEnding && newBalls % 6 !== 0) ? `${o}.${b}` : o;
        commLog.push(generateEOOBlock(s, newTotal, s.wickets, newBalls, newTimeline, pStats, eooOver, nextStriker, nextNonStriker));
    }

    const updates = {
        runs: newTotal, balls: newBalls, overs: `${o}.${b}`,
        striker: nextStriker, nonStriker: nextNonStriker,
        timeline: newTimeline, playerStats: pStats, historyStack: newStack,
        commentaryLog: commLog
    };
    if (forceBowlerChange) { updates.lastBowler = s.bowler; updates.bowler = null; }

    db.ref(`matches/${currentMatchId}/state`).update(updates, err => {
        if (!err && isMatchEnding) {
            currentMatch.state = { ...currentMatch.state, ...updates };
            endInnings(true);
        }
    });
}

function endInnings(auto = false) {
    if (!auto && !confirm("End Innings/Game?")) return;
    const s = currentMatch.state;
    let commLog = s.commentaryLog ? (Array.isArray(s.commentaryLog) ? [...s.commentaryLog] : Object.values(s.commentaryLog)) : [];
    const batTeam = teamsCache[s.battingTeam]?.name || "Team";

    // Snapshot the pre-mutation state for an undo. We grab this BEFORE we
    // mutate anything (commLog, summary, db) so the snapshot doesn't include
    // any "Innings Ended" / "Match Ended" commentary entries.
    const preInningsEnd = {
        inningsThatJustEnded: currentMatch.currentInnings,
        wasQuick: !!currentMatch.isQuickMatch,
        state: JSON.parse(JSON.stringify(currentMatch.state || {})),
        savedAt: Date.now()
    };

    if (currentMatch.currentInnings === 1) {
        const bowlTeam = teamsCache[s.bowlingTeam]?.name || "Team";
        const target = s.runs + 1;
        const balls = currentMatch.oversLimit * 6;
        commLog.push({
            type: 'eoi',
            text: `Innings Ended. ${batTeam} scored ${s.runs}/${s.wickets} (${s.overs}).`,
            targetMsg: `${bowlTeam} need ${target} runs to win in ${balls} balls.`
        });
    }

    const summary = {
        runs: s.runs, wickets: s.wickets, overs: s.overs,
        teamId: s.battingTeam, playerStats: s.playerStats,
        outPlayers: s.outPlayers || [],
        commentaryLog: commLog
    };

    const isQuick = !!currentMatch.isQuickMatch;

    if (currentMatch.currentInnings === 1) {
        const breakLabel = isQuick ? '🛑 INNINGS BREAK (Quick Match)' : '🛑 INNINGS BREAK!';
        alert(`${breakLabel}\n\nScore: ${s.runs}/${s.wickets}\nTarget to Win: ${s.runs + 1}`);
        db.ref(`matches/${currentMatchId}`).update({
            currentInnings: 2, innings1: summary,
            state: {
                battingTeam: s.bowlingTeam, bowlingTeam: s.battingTeam,
                striker: null, nonStriker: null, bowler: null,
                runs: 0, wickets: 0, balls: 0, overs: "0.0", timeline: [], outPlayers: [], playerStats: {}, historyStack: [],
                commentaryLog: []
            },
            preInningsEnd
        });
        if (!isQuick) commitStats(s.playerStats, s.battingTeam, s.bowlingTeam);
    } else {
        const inn1 = currentMatch.innings1, inn2 = s;
        const score1 = inn1.runs, score2 = inn2.runs;
        let winnerId = null, resultText = "Tie";
        if (score2 > score1) { winnerId = s.battingTeam; resultText = `${teamsCache[winnerId].name} won by ${maxWicketsFor(s.battingTeam) - s.wickets} wickets`; }
        else if (score1 > score2) { winnerId = inn1.teamId; resultText = `${teamsCache[winnerId].name} won by ${score1 - score2} runs`; }
        else { resultText = "Match Tied"; }

        commLog.push({ type: 'eoi', text: `Match Ended. ${resultText}` });
        summary.commentaryLog = commLog;

        if (!isQuick) {
            if (winnerId) {
                db.ref(`teams/${winnerId}/stats`).transaction(st => { if (!st) st = { played: 0, won: 0, lost: 0, points: 0 }; st.played++; st.won++; st.points += 2; return st; });
                const loserId = (winnerId === s.battingTeam) ? s.bowlingTeam : s.battingTeam;
                db.ref(`teams/${loserId}/stats`).transaction(st => { if (!st) st = { played: 0, won: 0, lost: 0, points: 0 }; st.played++; st.lost++; return st; });
            } else {
                const t1 = inn1.teamId, t2 = s.battingTeam;
                db.ref(`teams/${t1}/stats`).transaction(st => { if (!st) st = { played: 0, won: 0, lost: 0, points: 0 }; st.played++; st.points += 1; return st; });
                db.ref(`teams/${t2}/stats`).transaction(st => { if (!st) st = { played: 0, won: 0, lost: 0, points: 0 }; st.played++; st.points += 1; return st; });
            }

            const getNRRBalls = (wickets, oversStr, batTeamId) => (wickets >= maxWicketsFor(batTeamId)) ? (currentMatch.oversLimit * 6) : ballsFromOvers(oversStr);
            const ballsFaced1 = getNRRBalls(inn1.wickets, inn1.overs, inn1.teamId);
            const ballsFaced2 = getNRRBalls(inn2.wickets, inn2.overs, s.battingTeam);

            db.ref(`teams/${inn1.teamId}/stats`).transaction(st => { if (!st) st = {}; st.nrr_runsScored = (st.nrr_runsScored || 0) + score1; st.nrr_ballsFaced = (st.nrr_ballsFaced || 0) + ballsFaced1; st.nrr_runsConceded = (st.nrr_runsConceded || 0) + score2; st.nrr_ballsBowled = (st.nrr_ballsBowled || 0) + ballsFaced2; return st; });
            db.ref(`teams/${s.battingTeam}/stats`).transaction(st => { if (!st) st = {}; st.nrr_runsScored = (st.nrr_runsScored || 0) + score2; st.nrr_ballsFaced = (st.nrr_ballsFaced || 0) + ballsFaced2; st.nrr_runsConceded = (st.nrr_runsConceded || 0) + score1; st.nrr_ballsBowled = (st.nrr_ballsBowled || 0) + ballsFaced1; return st; });

            [currentMatch.teamA, currentMatch.teamB].forEach(tid => {
                if (teamsCache[tid] && teamsCache[tid].players) {
                    Object.keys(teamsCache[tid].players).forEach(pid => {
                        db.ref(`teams/${tid}/players/${pid}/stats/matches`).transaction(m => (m || 0) + 1);
                    });
                }
            });
        }

        db.ref(`matches/${currentMatchId}`).update({ status: 'completed', innings2: summary, result: resultText, preInningsEnd });
        if (!isQuick) commitStats(s.playerStats, s.battingTeam, s.bowlingTeam);
        switchTab('view-matches');
    }
}

function tryOpenSelector(mode) {
    if (!isScoringUnlocked && !isAdmin) { alert("Unlock Scoring first!"); return; }
    if (currentMatch.status === 'completed') return;
    openPlayerSelector(mode);
}

// =====================================================================
// MID-GAME OVERS CHANGE
// Lets the scorer shrink (time constraint) or grow (more players showed up)
// the overs limit while the match is in progress. The limit can't be reduced
// past the number of overs already bowled; if the new limit equals what's
// already been bowled, the innings auto-ends.
// =====================================================================
function changeOversLimit() {
    if (!currentMatch) return;
    if (currentMatch.status === 'completed') return alert("Match is already completed.");
    if (!isScoringUnlocked && !isAdmin) return alert("Unlock scoring first.");

    const current = currentMatch.oversLimit;
    const input = prompt(`Current overs limit: ${current}\n\nEnter the new overs limit (e.g. 15):`, current);
    if (input === null) return;

    const newLimit = parseInt(input);
    if (!newLimit || newLimit < 1) return alert("Please enter a positive whole number.");
    if (newLimit === current) return;

    const ballsBowled = (currentMatch.state && currentMatch.state.balls) || 0;
    const oversBowledFloor = Math.floor(ballsBowled / 6);
    const oversBowledCeil = Math.ceil(ballsBowled / 6);

    if (newLimit < oversBowledCeil) {
        return alert(`Can't reduce overs below what's already been bowled. The current innings is in over ${oversBowledFloor + (ballsBowled % 6 ? 1 : 0)}.`);
    }

    if (!confirm(`Change match length from ${current} overs to ${newLimit} overs?`)) return;

    db.ref(`matches/${currentMatchId}/oversLimit`).set(newLimit, err => {
        if (err) return alert("Couldn't update overs: " + err.message);
        showToast(`Overs limit set to ${newLimit}`);

        // If the new limit means this innings has already used its allotment,
        // end it now. Tiny delay so the local listener sees the new limit
        // before endInnings reads it for the inn1 break message / target.
        if (ballsBowled >= newLimit * 6) {
            setTimeout(() => endInnings(true), 200);
        }
    });
}

// =====================================================================
// ADD PLAYERS MID-GAME
// Adds a new player to the team currently being picked from (batting team
// for striker/non-striker, bowling team for bowler). Real teams write to
// /teams/{tid}/players; quick-match teams (the _ephemeral ones merged into
// teamsCache) write to matches/{mid}/quickTeams/{tid}/players instead, so
// nothing leaks out as a reusable squad.
// =====================================================================
function promptAddPlayerToCurrentTeam() {
    if (!isScoringUnlocked && !isAdmin) return alert("Unlock scoring first.");
    if (!currentMatch || !currentMatch.state) return;

    const teamId = (selectionMode === 'bowler')
        ? currentMatch.state.bowlingTeam
        : currentMatch.state.battingTeam;
    const team = teamsCache[teamId];
    if (!team) return alert("Team not loaded yet — try again in a moment.");

    const name = prompt(`Add a new player to ${team.name}:`);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();

    const playerObj = { name: trimmed, stats: { matches: 0, runs: 0, wickets: 0 } };
    const isQuickTeam = !!team._ephemeral;
    const path = isQuickTeam
        ? `matches/${currentMatchId}/quickTeams/${teamId}/players`
        : `teams/${teamId}/players`;

    const newRef = db.ref(path).push(playerObj, err => {
        if (err) return alert("Couldn't add player: " + err.message);

        // Optimistically merge into the local cache so the reopened selector
        // shows the new player immediately, without waiting for the listener.
        if (!teamsCache[teamId].players) teamsCache[teamId].players = {};
        teamsCache[teamId].players[newRef.key] = playerObj;

        showToast(`${trimmed} added to ${team.name}`);
        // Reopen the same selector mode so the scorer can pick the new player
        openPlayerSelector(selectionMode);
    });
}

function commitStats(matchStats, battingTeamId, bowlingTeamId) {
    if (!matchStats) return;
    Object.entries(matchStats).forEach(([pid, stats]) => {
        let teamId = null;
        if (teamsCache[battingTeamId]?.players?.[pid]) teamId = battingTeamId;
        else if (teamsCache[bowlingTeamId]?.players?.[pid]) teamId = bowlingTeamId;
        if (teamId) {
            db.ref(`teams/${teamId}/players/${pid}/stats`).transaction(career => {
                if (!career) career = { matches: 0, runs: 0, wickets: 0 };
                career.runs = (career.runs || 0) + (stats.runs || 0);
                career.wickets = (career.wickets || 0) + (stats.wickets || 0);
                return career;
            });
        }
    });
}

// Inverse of commitStats — subtracts an innings' player-stat contributions
// from career totals. Used by undoInningsEnd().
function revertStatCommits(matchStats, battingTeamId, bowlingTeamId) {
    if (!matchStats) return;
    Object.entries(matchStats).forEach(([pid, stats]) => {
        let teamId = null;
        if (teamsCache[battingTeamId]?.players?.[pid]) teamId = battingTeamId;
        else if (teamsCache[bowlingTeamId]?.players?.[pid]) teamId = bowlingTeamId;
        if (teamId) {
            db.ref(`teams/${teamId}/players/${pid}/stats`).transaction(career => {
                if (!career) return career;
                career.runs = Math.max(0, (career.runs || 0) - (stats.runs || 0));
                career.wickets = Math.max(0, (career.wickets || 0) - (stats.wickets || 0));
                return career;
            });
        }
    });
}

// Inverse of the team / player updates endInnings makes when innings 2 ends:
// reverses won / lost / points, NRR contributions, and the per-player matches
// counter. Mirrors the reversal logic already in deleteMatch().
function revertMatchEndStats(m) {
    if (!m || m.isQuickMatch) return;
    const i1 = m.innings1, i2 = m.innings2;
    if (!i1 || !i2) return;

    let winnerId = null, loserId = null, isTie = false;
    if (i2.runs > i1.runs) { winnerId = i2.teamId; loserId = i1.teamId; }
    else if (i1.runs > i2.runs) { winnerId = i1.teamId; loserId = i2.teamId; }
    else isTie = true;

    if (winnerId) {
        db.ref(`teams/${winnerId}/stats`).transaction(s => { if (s) { s.played = Math.max(0, (s.played || 0) - 1); s.won = Math.max(0, (s.won || 0) - 1); s.points = Math.max(0, (s.points || 0) - 2); } return s; });
        db.ref(`teams/${loserId}/stats`).transaction(s => { if (s) { s.played = Math.max(0, (s.played || 0) - 1); s.lost = Math.max(0, (s.lost || 0) - 1); } return s; });
    } else if (isTie) {
        [m.teamA, m.teamB].forEach(tid => db.ref(`teams/${tid}/stats`).transaction(s => { if (s) { s.played = Math.max(0, (s.played || 0) - 1); s.points = Math.max(0, (s.points || 0) - 1); } return s; }));
    }

    const maxBalls = m.oversLimit * 6;
    const balls1 = (i1.wickets >= maxWicketsFor(i1.teamId)) ? maxBalls : ballsFromOvers(i1.overs);
    const balls2 = (i2.wickets >= maxWicketsFor(i2.teamId)) ? maxBalls : ballsFromOvers(i2.overs);

    db.ref(`teams/${i1.teamId}/stats`).transaction(st => {
        if (!st) return st;
        st.nrr_runsScored = (st.nrr_runsScored || 0) - i1.runs;
        st.nrr_ballsFaced = (st.nrr_ballsFaced || 0) - balls1;
        st.nrr_runsConceded = (st.nrr_runsConceded || 0) - i2.runs;
        st.nrr_ballsBowled = (st.nrr_ballsBowled || 0) - balls2;
        return st;
    });
    db.ref(`teams/${i2.teamId}/stats`).transaction(st => {
        if (!st) return st;
        st.nrr_runsScored = (st.nrr_runsScored || 0) - i2.runs;
        st.nrr_ballsFaced = (st.nrr_ballsFaced || 0) - balls2;
        st.nrr_runsConceded = (st.nrr_runsConceded || 0) - i1.runs;
        st.nrr_ballsBowled = (st.nrr_ballsBowled || 0) - balls1;
        return st;
    });

    [m.teamA, m.teamB].forEach(tid => {
        if (teamsCache[tid] && teamsCache[tid].players) {
            Object.keys(teamsCache[tid].players).forEach(pid => {
                db.ref(`teams/${tid}/players/${pid}/stats/matches`).transaction(c => Math.max(0, (c || 1) - 1));
            });
        }
    });

    // Reverse the inn2 player-level career commits (commitStats was called for
    // innings 2 right at the end). Inn1 commits stay because innings 1 is
    // unchanged by a match-end undo — we only roll back the match-finishing
    // transition itself.
    const bowlTeamForInn2 = (i2.teamId === m.teamA) ? m.teamB : m.teamA;
    revertStatCommits(i2.playerStats, i2.teamId, bowlTeamForInn2);
}

function undoInningsEnd() {
    if (!currentMatch || !currentMatch.preInningsEnd) {
        alert("Nothing to undo.");
        return;
    }
    const m = currentMatch;
    const snap = m.preInningsEnd;
    const isMatchEndUndo = (snap.inningsThatJustEnded === 2);

    const label = isMatchEndUndo
        ? "Undo end of match? The result will be rolled back and you'll return to live scoring."
        : "Undo end of the first innings? The innings break will be cancelled and you'll return to mid-innings scoring.";
    if (!confirm(label)) return;

    if (isMatchEndUndo) {
        // Roll back career stats + team aggregates that were committed at match end
        revertMatchEndStats(m);
    } else if (!snap.wasQuick && m.innings1?.playerStats) {
        // Inn1 break — only the inn1 player career stats were committed
        const bowlTeamForInn1 = (m.innings1.teamId === m.teamA) ? m.teamB : m.teamA;
        revertStatCommits(m.innings1.playerStats, m.innings1.teamId, bowlTeamForInn1);
    }

    const updates = {
        currentInnings: snap.inningsThatJustEnded,
        state: snap.state,
        preInningsEnd: null
    };
    if (isMatchEndUndo) {
        updates.innings2 = null;
        updates.status = 'live';
        updates.result = null;
        updates.potm = null; // POTM only makes sense once the match is final
    } else {
        updates.innings1 = null;
    }

    db.ref(`matches/${currentMatchId}`).update(updates, err => {
        if (err) { alert("Couldn't undo: " + err.message); return; }
        if (isMatchEndUndo) {
            // Summary view is meaningless once the match is live again — flip
            // the user back to the scorecard so they can keep scoring.
            switchMatchTab('scorecard');
        }
        showToast(isMatchEndUndo ? 'Match end undone' : 'Innings break undone');
    });
}

function openPlayerSelector(mode) {
    selectionMode = mode;
    const modal = document.getElementById('modal-player-select');
    const list = document.getElementById('player-select-list');
    list.innerHTML = '';
    const teamId = (mode === 'bowler') ? currentMatch.state.bowlingTeam : currentMatch.state.battingTeam;
    const players = teamsCache[teamId].players;
    const outPlayers = currentMatch.state.outPlayers || [];
    const activePlayers = [currentMatch.state.striker, currentMatch.state.nonStriker];
    const isNewOver = currentMatch.state.overs.endsWith('.0') || currentMatch.state.bowler === null;
    const lastBowler = currentMatch.state.lastBowler;
    Object.entries(players).forEach(([pid, p]) => {
        if (mode !== 'bowler') {
            if (outPlayers.includes(pid) || activePlayers.includes(pid)) return;
        } else if (isNewOver && pid === lastBowler && pid !== currentMatch.state.bowler) {
            const btn = document.createElement('button');
            btn.className = 'player-select-btn';
            btn.innerText = `${p.name} (Just Bowled)`;
            btn.disabled = true; list.appendChild(btn); return;
        }
        const btn = document.createElement('button');
        btn.className = 'player-select-btn';
        btn.innerText = p.name;
        btn.onclick = () => { db.ref(`matches/${currentMatchId}/state/${selectionMode}`).set(pid); modal.style.display = 'none'; };
        list.appendChild(btn);
    });
    modal.style.display = 'flex';
}

function swapStrike() {
    const s = currentMatch.state;
    const newStack = saveState();
    db.ref(`matches/${currentMatchId}/state`).update({ striker: s.nonStriker, nonStriker: s.striker, historyStack: newStack });
}

function openWicketModal() {
    const s = currentMatch.state;
    if (!teamsCache[s.battingTeam] || !teamsCache[s.bowlingTeam]) return;

    const modal = document.getElementById('modal-wicket');
    const whoOutSelect = document.getElementById('wicket-who-out');
    const fielderSelect = document.getElementById('wicket-fielder');
    const newBatSelect = document.getElementById('wicket-new-batter');
    const runOutCheckbox = document.getElementById('wicket-is-runout');

    whoOutSelect.innerHTML = '';
    fielderSelect.innerHTML = '<option value="">(None / Bowled)</option>';
    newBatSelect.innerHTML = '<option value="">Select New Batter</option>';
    if (runOutCheckbox) runOutCheckbox.checked = false;

    const p1 = teamsCache[s.battingTeam].players[s.striker];
    const p2 = teamsCache[s.battingTeam].players[s.nonStriker];
    whoOutSelect.innerHTML += `<option value="striker">${p1 ? p1.name : 'Striker'}</option>`;
    whoOutSelect.innerHTML += `<option value="nonstriker">${p2 ? p2.name : 'Non-Striker'}</option>`;

    whoOutSelect.onchange = (e) => {
        if (runOutCheckbox && e.target.value === 'nonstriker') runOutCheckbox.checked = true;
    };

    Object.entries(teamsCache[s.bowlingTeam].players).forEach(([pid, p]) => {
        fielderSelect.innerHTML += `<option value="${pid}">${p.name}</option>`;
    });

    const outPlayers = s.outPlayers || [];
    const currentBatters = [s.striker, s.nonStriker];
    let availableCount = 0;
    Object.entries(teamsCache[s.battingTeam].players).forEach(([pid, p]) => {
        if (!outPlayers.includes(pid) && !currentBatters.includes(pid)) {
            newBatSelect.innerHTML += `<option value="${pid}">${p.name}</option>`;
            availableCount++;
        }
    });

    if (availableCount === 0) {
        newBatSelect.innerHTML = `<option value="ALL_OUT" selected>All Out (No batters left)</option>`;
    }
    modal.style.display = 'flex';
}

function confirmWicket(autoAllOut = false) {
    const s = currentMatch.state;
    const newStack = saveState();
    let whoOutRole = 'striker', newBatId = null, fielderId = null;
    let isRunOut = false;

    if (!autoAllOut) {
        whoOutRole = document.getElementById('wicket-who-out').value;
        newBatId = document.getElementById('wicket-new-batter').value;
        fielderId = document.getElementById('wicket-fielder').value;
        const roCheck = document.getElementById('wicket-is-runout');
        isRunOut = roCheck ? roCheck.checked : (whoOutRole === 'nonstriker');
        if (!newBatId) return alert("Please select the new batter.");
    }

    const outPlayerId = (whoOutRole === 'striker') ? s.striker : s.nonStriker;
    const pStats = s.playerStats || {};

    let nextBat = Math.max(0, ...Object.values(pStats).map(p => p.batOrder || 0)) + 1;
    if (!pStats[s.striker]) { pStats[s.striker] = { runs: 0, balls: 0, fours: 0, sixes: 0, batOrder: nextBat++ }; }
    if (!pStats[s.nonStriker]) { pStats[s.nonStriker] = { runs: 0, balls: 0, fours: 0, sixes: 0, batOrder: nextBat++ }; }

    let nextBowl = Math.max(0, ...Object.values(pStats).map(p => p.bowlOrder || 0)) + 1;
    if (!autoAllOut && s.bowler) {
        if (!pStats[s.bowler]) pStats[s.bowler] = { ballsBowled: 0, runsConceded: 0, wickets: 0, extras: 0, bowlOrder: nextBowl++ };
        pStats[s.bowler].ballsBowled++;
        if (!isRunOut) pStats[s.bowler].wickets++;
    }

    const fielderName = fielderId ? teamsCache[s.bowlingTeam]?.players?.[fielderId]?.name : "";
    const bowlerName = s.bowler ? teamsCache[s.bowlingTeam]?.players?.[s.bowler]?.name : "Unknown";

    let dismissalText = "";
    if (isRunOut) dismissalText = fielderName ? `run out (${fielderName})` : `run out`;
    else dismissalText = fielderName ? `c ${fielderName} b ${bowlerName}` : `b ${bowlerName}`;

    const batterFacing = s.striker;
    if (!autoAllOut) pStats[batterFacing].balls++;
    pStats[outPlayerId].dismissal = dismissalText;

    const newBalls = s.balls + 1;
    const o = Math.floor(newBalls / 6), b = newBalls % 6;
    const forceBowlerChange = (b === 0);

    const label = isRunOut ? 'W (RO)' : (fielderName ? 'W (C)' : 'W');
    const newTimeline = [...(s.timeline || []), label];
    if (newBalls % 6 === 0) newTimeline.push('|');

    let commLog = [];
    if (s.commentaryLog) {
        commLog = Array.isArray(s.commentaryLog) ? [...s.commentaryLog] : Object.values(s.commentaryLog);
        commLog = commLog.filter(item => item != null);
    }
    let dispO = o, dispB = b;
    if (b === 0 && newBalls > 0) { dispO = o - 1; dispB = 6; }

    const strikerName = teamsCache[s.battingTeam]?.players?.[s.striker]?.name || "Batter";
    const nonStrikerName = teamsCache[s.battingTeam]?.players?.[s.nonStriker]?.name || "Non-Striker";
    const newBatterName = (newBatId && newBatId !== 'ALL_OUT' && teamsCache[s.battingTeam]?.players?.[newBatId]) ? teamsCache[s.battingTeam].players[newBatId].name : "";

    const outRuns = pStats[outPlayerId]?.runs || 0;
    const nextText = newBatterName ? `${newBatterName} in next.` : "All out.";
    let commText = "";
    if (isRunOut) {
        const outName = (whoOutRole === 'striker') ? strikerName : nonStrikerName;
        const throwText = fielderName ? `Throw by ${fielderName}, ` : '';
        commText = `${throwText}<span style="color:var(--danger); font-weight:bold;">${outName} RUN OUT at ${outRuns}!</span> ${nextText}`;
    } else if (fielderName) {
        commText = `<span style="color:var(--danger); font-weight:bold;">Caught by ${fielderName}!</span> ${strikerName} out at ${outRuns}. ${nextText}`;
    } else {
        commText = `<span style="color:var(--danger); font-weight:bold;">Bowled!</span> ${strikerName} out at ${outRuns}. ${nextText}`;
    }
    commLog.push({ type: 'ball', over: `${dispO}.${dispB}`, label, text: `${bowlerName} to ${strikerName}. ${commText}` });

    const isAllOutMode = autoAllOut || newBatId === 'ALL_OUT';
    const nextStriker = isAllOutMode ? null : (whoOutRole === 'striker' ? newBatId : s.striker);
    const nextNonStriker = isAllOutMode ? null : (whoOutRole === 'striker' ? s.nonStriker : newBatId);

    const isMatchEnding = isAllOutMode || (s.wickets + 1) >= maxWicketsFor(s.battingTeam) || newBalls >= (currentMatch.oversLimit * 6);
    if ((newBalls > 0 && newBalls % 6 === 0) || isMatchEnding) {
        const eooOver = (isMatchEnding && newBalls % 6 !== 0) ? `${o}.${b}` : o;
        commLog.push(generateEOOBlock(s, s.runs, s.wickets + 1, newBalls, newTimeline, pStats, eooOver, nextStriker, nextNonStriker));
    }

    const updates = {
        wickets: s.wickets + 1, balls: newBalls, overs: `${o}.${b}`,
        striker: nextStriker, nonStriker: nextNonStriker,
        timeline: newTimeline, outPlayers: [...(s.outPlayers || []), outPlayerId],
        playerStats: pStats, historyStack: newStack, commentaryLog: commLog
    };
    if (forceBowlerChange) { updates.lastBowler = s.bowler; updates.bowler = null; }

    db.ref(`matches/${currentMatchId}/state`).update(updates, err => {
        if (!err) {
            closeModal('modal-wicket');
            if (isMatchEnding) {
                currentMatch.state = { ...currentMatch.state, ...updates };
                endInnings(true);
            }
        }
    });
}

// =====================================================================
// DELETE MATCH (tournament-aware reversal)
// =====================================================================
function deleteMatch(mid) {
    const targetId = mid || currentMatchId;
    if (!isAdmin) return;

    db.ref(`matches/${targetId}`).once('value', snapshot => {
        const m = snapshot.val();
        if (!m) return;

        if (m.isQuickMatch) {
            if (!confirm("Delete this Quick Match? The scorecard will be permanently removed (no tournament stats were affected).")) return;
            db.ref().update({
                [`matches/${targetId}`]: null,
                [`matchPins/${targetId}`]: null
            });
            if (currentMatchId === targetId) switchTab('view-matches');
            return;
        }

        if (!confirm("DELETE MATCH? This will revert ALL Points, NRR, and Player Stats for this tournament.")) return;

        if (m.status === 'completed') {
            const i1 = m.innings1, i2 = m.innings2;
            let winnerId = null, loserId = null, isTie = false;
            if (i2.runs > i1.runs) { winnerId = i2.teamId; loserId = i1.teamId; }
            else if (i1.runs > i2.runs) { winnerId = i1.teamId; loserId = i2.teamId; }
            else isTie = true;

            if (winnerId) {
                db.ref(`teams/${winnerId}/stats`).transaction(s => { if (s) { s.played--; s.won--; s.points -= 2; } return s; });
                db.ref(`teams/${loserId}/stats`).transaction(s => { if (s) { s.played--; s.lost--; } return s; });
            } else if (isTie) {
                [m.teamA, m.teamB].forEach(tid => db.ref(`teams/${tid}/stats`).transaction(s => { if (s) { s.played--; s.points--; } return s; }));
            }

            const maxBalls = m.oversLimit * 6;
            const balls1 = (i1.wickets >= maxWicketsFor(i1.teamId)) ? maxBalls : ballsFromOvers(i1.overs);
            const balls2 = (i2.wickets >= maxWicketsFor(i2.teamId)) ? maxBalls : ballsFromOvers(i2.overs);

            db.ref(`teams/${i1.teamId}/stats`).transaction(st => {
                if (!st) return st;
                st.nrr_runsScored = (st.nrr_runsScored || 0) - i1.runs;
                st.nrr_ballsFaced = (st.nrr_ballsFaced || 0) - balls1;
                st.nrr_runsConceded = (st.nrr_runsConceded || 0) - i2.runs;
                st.nrr_ballsBowled = (st.nrr_ballsBowled || 0) - balls2;
                return st;
            });
            db.ref(`teams/${i2.teamId}/stats`).transaction(st => {
                if (!st) return st;
                st.nrr_runsScored = (st.nrr_runsScored || 0) - i2.runs;
                st.nrr_ballsFaced = (st.nrr_ballsFaced || 0) - balls2;
                st.nrr_runsConceded = (st.nrr_runsConceded || 0) - i1.runs;
                st.nrr_ballsBowled = (st.nrr_ballsBowled || 0) - balls1;
                return st;
            });
        }

        [m.teamA, m.teamB].forEach(tid => {
            if (teamsCache[tid] && teamsCache[tid].players) {
                Object.keys(teamsCache[tid].players).forEach(pid => {
                    db.ref(`teams/${tid}/players/${pid}/stats/matches`).transaction(c => (c || 1) - 1);
                });
            }
        });

        const allStatsToRevert = [];
        const getBowlTeam = (batTeam) => (batTeam === m.teamA) ? m.teamB : m.teamA;
        if (m.innings1?.playerStats) allStatsToRevert.push({ stats: m.innings1.playerStats, batTeam: m.innings1.teamId, bowlTeam: getBowlTeam(m.innings1.teamId) });
        if (m.innings2?.playerStats) allStatsToRevert.push({ stats: m.innings2.playerStats, batTeam: m.innings2.teamId, bowlTeam: getBowlTeam(m.innings2.teamId) });
        if (m.status === 'live' && m.state?.playerStats) allStatsToRevert.push({ stats: m.state.playerStats, batTeam: m.state.battingTeam, bowlTeam: m.state.bowlingTeam });

        allStatsToRevert.forEach(item => {
            if (!item.stats) return;
            Object.entries(item.stats).forEach(([pid, stat]) => {
                let targetTeamId = null;
                if (teamsCache[item.batTeam]?.players?.[pid]) targetTeamId = item.batTeam;
                else if (teamsCache[item.bowlTeam]?.players?.[pid]) targetTeamId = item.bowlTeam;
                if (targetTeamId) {
                    db.ref(`teams/${targetTeamId}/players/${pid}/stats`).transaction(s => {
                        if (s) {
                            s.runs = (s.runs || 0) - (stat.runs || 0);
                            s.wickets = (s.wickets || 0) - (stat.wickets || 0);
                            if (s.runs < 0) s.runs = 0;
                            if (s.wickets < 0) s.wickets = 0;
                        }
                        return s;
                    });
                }
            });
        });

        db.ref().update({
            [`matches/${targetId}`]: null,
            [`matchPins/${targetId}`]: null
        });
        if (currentMatchId === targetId) switchTab('view-matches');
    });
}

// =====================================================================
// TEAM DETAILS (squad page)
// =====================================================================
function viewTeamDetails(tid, _silent) {
    currentViewingTeamId = tid;
    const teamObj = teamsCache[tid];
    if (!teamObj) return;

    if (!_silent) {
        if (document.getElementById('view-tournament-detail').classList.contains('active')) {
            lastViewBeforeTeam = 'view-tournament-detail';
        } else {
            lastViewBeforeTeam = 'view-tournaments';
        }
        switchTab('view-team-details');
    }

    document.getElementById('team-details-name').innerText = teamObj.name;
    const captName = teamObj.players && teamObj.players[teamObj.captain]
        ? `👑 Captain: ${teamObj.players[teamObj.captain].name}` : '';
    document.getElementById('team-details-captain').innerText = captName;

    const table = document.getElementById('team-players-table');
    table.innerHTML = '';
    const players = teamObj.players || {};

    const sortedPids = Object.keys(players).sort((a, b) => {
        if (a === teamObj.captain) return -1;
        if (b === teamObj.captain) return 1;
        return players[a].name.localeCompare(players[b].name);
    });

    sortedPids.forEach(pid => {
        const p = players[pid];
        const s = p.stats || { matches: 0, runs: 0, wickets: 0 };
        const isCapt = (pid === teamObj.captain) ? '👑' : '';
        let actionCell = '';
        if (isAdmin) {
            actionCell = `<td><button class="secondary small-btn" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditPlayerModal('${pid}')">Manage</button></td>`;
        }
        table.innerHTML += `
            <tr>
                <td class="team-name-cell" style="padding-left:0;">${isCapt} ${escapeHtml(p.name)}</td>
                <td>${s.matches || 0}</td>
                <td>${s.runs || 0}</td>
                <td>${s.wickets || 0}</td>
                ${actionCell}
            </tr>`;
    });

    if (isAdmin) {
        document.getElementById('admin-team-controls').classList.remove('hidden');
        document.getElementById('admin-add-player-div').classList.remove('hidden');
        document.getElementById('admin-th-actions').classList.remove('hidden');
        document.getElementById('admin-team-name-input').value = teamObj.name;
        const capSel = document.getElementById('admin-captain-select');
        capSel.innerHTML = '<option value="">Select Captain...</option>';
        Object.entries(players).forEach(([pid, p]) => {
            const selected = (pid === teamObj.captain) ? 'selected' : '';
            capSel.innerHTML += `<option value="${pid}" ${selected}>${escapeHtml(p.name)}</option>`;
        });
    } else {
        document.getElementById('admin-team-controls').classList.add('hidden');
        document.getElementById('admin-add-player-div').classList.add('hidden');
        document.getElementById('admin-th-actions').classList.add('hidden');
    }
}

function goBackFromTeam() {
    if (lastViewBeforeTeam === 'view-tournament-detail' && currentTournamentId) {
        switchTab('view-tournament-detail');
        renderTournamentDetail();
    } else {
        switchTab('view-tournaments');
    }
}

function addPlayerToTeam() {
    const name = document.getElementById('new-player-name').value.trim();
    if (!name || !currentViewingTeamId) return alert("Enter a name");
    db.ref(`teams/${currentViewingTeamId}/players`).push({
        name, stats: { matches: 0, runs: 0, wickets: 0 }
    }, err => {
        if (!err) {
            document.getElementById('new-player-name').value = '';
            viewTeamDetails(currentViewingTeamId, true);
        }
    });
}

function saveTeamName() {
    const newName = document.getElementById('admin-team-name-input').value.trim();
    if (!newName) return;
    db.ref(`teams/${currentViewingTeamId}`).update({ name: newName }, () => {
        alert("Team renamed.");
        viewTeamDetails(currentViewingTeamId, true);
    });
}

function saveTeamCaptain() {
    const pid = document.getElementById('admin-captain-select').value;
    db.ref(`teams/${currentViewingTeamId}`).update({ captain: pid }, () => {
        alert("Captain updated.");
        viewTeamDetails(currentViewingTeamId, true);
    });
}

function confirmDeleteTeam() {
    if (confirm("Delete this ENTIRE team and all its players? This cannot be undone.")) {
        db.ref(`teams/${currentViewingTeamId}`).remove(() => {
            alert("Team deleted.");
            goBackFromTeam();
        });
    }
}

function openEditPlayerModal(pid) {
    const p = teamsCache[currentViewingTeamId].players[pid];
    const s = p.stats || { matches: 0, runs: 0, wickets: 0 };
    document.getElementById('edit-player-id').value = pid;
    document.getElementById('edit-player-name').value = p.name;
    document.getElementById('edit-player-matches').value = s.matches;
    document.getElementById('edit-player-runs').value = s.runs;
    document.getElementById('edit-player-wickets').value = s.wickets;
    document.getElementById('modal-edit-player').style.display = 'flex';
}

function savePlayerEdits() {
    const pid = document.getElementById('edit-player-id').value;
    const name = document.getElementById('edit-player-name').value.trim();
    const matches = parseInt(document.getElementById('edit-player-matches').value) || 0;
    const runs = parseInt(document.getElementById('edit-player-runs').value) || 0;
    const wickets = parseInt(document.getElementById('edit-player-wickets').value) || 0;
    if (!name) return alert("Name is required");

    db.ref(`teams/${currentViewingTeamId}/players/${pid}`).update({
        name, stats: { matches, runs, wickets }
    }, () => {
        closeModal('modal-edit-player');
        viewTeamDetails(currentViewingTeamId, true);
    });
}

function deletePlayer() {
    if (confirm("Remove this player from the team?")) {
        const pid = document.getElementById('edit-player-id').value;
        db.ref(`teams/${currentViewingTeamId}/players/${pid}`).remove(() => {
            closeModal('modal-edit-player');
            viewTeamDetails(currentViewingTeamId, true);
        });
    }
}
