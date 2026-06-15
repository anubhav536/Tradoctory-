/* ===================================================
   TRADOCTORY — ROUTE GUARD  (route-guard.js)

   Protects pages that require authentication.
   Sits on top of auth-store.js and inherits its
   provider abstraction — no changes needed here
   when migrating to Firebase.

   Architecture:
   ┌─────────────────────────────────────────────────┐
   │  dashboard.html / journal.html / analysis.html  │
   │   └─ import { guardRoute } from './route-guard' │
   ├─────────────────────────────────────────────────┤
   │  route-guard.js  (this file)                    │
   │   └─ calls checkAuth() / onAuthStateChanged()   │
   ├─────────────────────────────────────────────────┤
   │  auth-store.js  (provider layer)                │
   │   └─ LocalAuthProvider  ←── or FirebaseProvider │
   └─────────────────────────────────────────────────┘

   FIREBASE MIGRATION NOTE:
   ─────────────────────────────────────────────────
   Replace the guardRoute body with:

     import { getAuth, onAuthStateChanged } from 'firebase/auth';
     const auth = getAuth();
     onAuthStateChanged(auth, (user) => {
       if (!user) {
         window.location.replace(redirectTo);
       } else {
         document.documentElement.classList.remove('guard-loading');
       }
     });

   onAuthStateChanged is asynchronous, so the
   guard-loading class (visibility:hidden) prevents
   a flash of protected content while Firebase
   resolves the session.
   =================================================== */

'use strict';

import { checkAuth, getCurrentUser } from './auth-store.js';


/* ---------------------------------------------------
   GUARD-LOADING CLASS
   Added to <html> by the inline script in each
   protected page BEFORE this module loads. Keeps the
   page invisible until auth is confirmed, preventing
   any flash of protected content.
   --------------------------------------------------- */
const ROOT = document.documentElement;


/**
 * Protect a page — redirect to login if not authenticated.
 *
 * Call this at the top of every protected page's module script.
 * The function is synchronous for the localStorage provider and
 * is designed to be swapped for onAuthStateChanged when migrating
 * to Firebase (see note above).
 *
 * @param {string} [redirectTo='login.html']  Page to redirect unauthenticated users to.
 * @returns {object|null}  The current user object if authenticated, otherwise never returns (redirect).
 */
export function guardRoute(redirectTo = 'login.html') {
  const user = checkAuth();

  if (!user) {
    /* Preserve the originally requested URL so login can redirect back. */
    const intendedUrl = window.location.pathname + window.location.search;
    const loginUrl    = `${redirectTo}?next=${encodeURIComponent(intendedUrl)}`;
    window.location.replace(loginUrl);
    return null;
  }

  /* Auth confirmed — reveal the page. */
  ROOT.classList.remove('guard-loading');
  return user;
}


/**
 * Redirect already-authenticated users away from auth pages (login / signup).
 *
 * Call this in login.html and signup.html to skip the form for
 * logged-in users and send them straight to the app.
 *
 * FIREBASE MIGRATION NOTE:
 * Replace body with onAuthStateChanged check (see module header).
 *
 * @param {string} [redirectTo='dashboard.html']  Destination for authenticated users.
 */
export function redirectIfAuthenticated(redirectTo = 'dashboard.html') {
  const user = getCurrentUser();
  if (user) {
    window.location.replace(redirectTo);
  }
}


/**
 * Return the current authenticated user, or null.
 * Convenience re-export so protected pages only need
 * to import from route-guard.js.
 *
 * @returns {object|null}
 */
export { getCurrentUser } from './auth-store.js';


/**
 * Sign out and redirect to the landing page.
 *
 * @param {string} [redirectTo='index.html']
 */
export async function signOutAndRedirect(redirectTo = 'index.html') {
  const { logoutUser } = await import('./auth-store.js');
  await logoutUser();
  window.location.replace(redirectTo);
}
