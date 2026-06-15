/* ===================================================
   TRADOCTORY — NAVBAR AUTH  (navbar-auth.js)

   Reads the current session and switches the navbar
   between guest state (Login / Get Started) and
   authenticated state (avatar + dropdown menu).

   FIREBASE MIGRATION:
   Replace checkAuth() call with onAuthStateChanged()
   from firebase/auth. The rest of the DOM wiring
   stays identical.
   =================================================== */

'use strict';

import { checkAuth, logoutUser } from './auth-store.js';


/* ── Elements ─────────────────────────────────────── */
const navGuest    = document.getElementById('navGuest');
const navUser     = document.getElementById('navUser');
const avatarBtn   = document.getElementById('navAvatarBtn');
const dropdown    = document.getElementById('navDropdown');
const avatarInit  = document.getElementById('navAvatarInitial');
const dropAvatar  = document.getElementById('dropdownAvatarInitial');
const dropName    = document.getElementById('dropdownName');
const dropPlan    = document.getElementById('dropdownPlan');
const signOutBtn  = document.getElementById('navSignOut');

const mobileGuest   = document.getElementById('mobileGuest');
const mobileUser    = document.getElementById('mobileUser');
const mobileAvatar  = document.getElementById('mobileAvatarInitial');
const mobileName    = document.getElementById('mobileUserName');
const mobilePlan    = document.getElementById('mobileUserPlan');
const mobileSignOut = document.getElementById('mobileSignOut');


/* ── Helpers ──────────────────────────────────────── */
function initial(user) {
  return (user.name ?? user.email ?? '?').charAt(0).toUpperCase();
}

function planLabel(user) {
  return user.plan === 'pro' ? '✦ Pro plan' : 'Free plan';
}

function openDropdown(open) {
  dropdown.classList.toggle('open', open);
  avatarBtn.setAttribute('aria-expanded', open);
}


/* ── Auth state → DOM ─────────────────────────────── */
function applyAuthState(user) {
  if (user) {
    /* Show authenticated navbar */
    navGuest.style.display  = 'none';
    navUser.style.display   = 'flex';

    const init = initial(user);
    const plan = planLabel(user);

    avatarInit.textContent = init;
    dropAvatar.textContent = init;
    dropName.textContent   = user.name ?? user.email;
    dropPlan.textContent   = plan;

    /* Mobile */
    mobileGuest.style.display = 'none';
    mobileUser.style.display  = 'block';
    if (mobileAvatar) mobileAvatar.textContent = init;
    if (mobileName)   mobileName.textContent   = user.name ?? user.email;
    if (mobilePlan)   mobilePlan.textContent   = plan;

  } else {
    /* Show guest navbar */
    navGuest.style.display = 'flex';
    navUser.style.display  = 'none';

    mobileGuest.style.display = 'block';
    mobileUser.style.display  = 'none';
  }
}


/* ── Dropdown toggle ──────────────────────────────── */
avatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdown.classList.contains('open');
  openDropdown(!isOpen);
});

/* Close on outside click */
document.addEventListener('click', (e) => {
  if (
    dropdown?.classList.contains('open') &&
    !dropdown.contains(e.target) &&
    !avatarBtn.contains(e.target)
  ) {
    openDropdown(false);
  }
});

/* Close on Escape */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dropdown?.classList.contains('open')) {
    openDropdown(false);
    avatarBtn?.focus();
  }
});

/* Close dropdown when any menu item is clicked */
dropdown?.addEventListener('click', () => openDropdown(false));


/* ── Sign out ─────────────────────────────────────── */
async function handleSignOut() {
  await logoutUser();
  /* Refresh in place — the navbar will re-render in guest state */
  window.location.reload();
}

signOutBtn?.addEventListener('click', handleSignOut);
mobileSignOut?.addEventListener('click', handleSignOut);


/* ── Boot ─────────────────────────────────────────── */
applyAuthState(checkAuth());
