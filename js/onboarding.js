/* ===================================================
   TRADOCTORY — ONBOARDING  (onboarding.js)

   Shows a one-time welcome screen after first signup.
   Completion status is stored per-user in localStorage
   so it never shows again for that account.

   FIREBASE MIGRATION:
   - Replace guardRoute() with onAuthStateChanged()
   - Replace localStorage with Firestore:
       await setDoc(doc(db,'users',uid), { onboardingDone: true }, { merge:true })
       const snap = await getDoc(doc(db,'users',uid));
       if (snap.data()?.onboardingDone) { redirect... }
   =================================================== */

'use strict';

import { guardRoute } from './route-guard.js';


/* ── 1. Enforce authentication ───────────────────── */
const user = guardRoute('login.html');
if (!user) throw new Error('Unauthenticated — redirecting.');


/* ── 2. Onboarding storage helpers ──────────────── */

/**
 * localStorage key for this user's onboarding record.
 * Scoped to the user's id so each account has its own flag.
 */
const OB_KEY = `trdctr_ob_${user.id}`;

/**
 * @returns {boolean} Whether this user has already completed onboarding.
 */
function isOnboardingDone() {
  try {
    return !!localStorage.getItem(OB_KEY);
  } catch { return false; }
}

/**
 * Persist the onboarding completion record.
 * @param {'trade'|'dashboard'|'chart'|'skip'} action — which CTA the user chose
 */
function markOnboardingDone(action) {
  try {
    localStorage.setItem(OB_KEY, JSON.stringify({
      completedAt: new Date().toISOString(),
      firstAction: action,
      userId:      user.id,
    }));
  } catch { /* storage full — fail silently */ }
}


/* ── 3. Already completed? Skip to dashboard ─────── */
if (isOnboardingDone()) {
  window.location.replace('dashboard.html');
}


/* ── 4. Personalise the welcome message ──────────── */
const nameEl = document.getElementById('obUserName');
if (nameEl) {
  const firstName = (user.name ?? user.email ?? 'Trader').split(' ')[0];
  nameEl.textContent = firstName;
}


/* ── 5. Wire up action cards ─────────────────────── */

/**
 * When any action card is clicked:
 * 1. Mark onboarding done with the chosen action label
 * 2. Let the <a href> navigate naturally
 */
document.querySelectorAll('.ob-action[data-action]').forEach(card => {
  card.addEventListener('click', () => {
    markOnboardingDone(card.dataset.action);
    /* href on the <a> handles the navigation */
  });
});


/* ── 6. Skip button ──────────────────────────────── */
document.getElementById('obSkip')?.addEventListener('click', () => {
  markOnboardingDone('skip');
  window.location.href = 'dashboard.html';
});


/* ── 7. "Already familiar" dashboard link ────────── */
/*
  The link in ob-already goes directly to dashboard.html.
  Mark onboarding done so it doesn't show again.
*/
document.querySelectorAll('.ob-already a').forEach(link => {
  link.addEventListener('click', () => markOnboardingDone('skip'));
});
