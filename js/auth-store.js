/* ===================================================
   TRADOCTORY — AUTH STORE  (auth-store.js)

   Architecture overview:
   ┌─────────────────────────────────────────────────┐
   │  auth.js  (UI layer)                            │
   │   └─ calls registerUser / loginUser / etc.      │
   ├─────────────────────────────────────────────────┤
   │  auth-store.js  (this file — data layer)        │
   │   └─ ActiveProvider  ←── swap to migrate        │
   │        ├─ LocalAuthProvider  (localStorage)     │
   │        └─ FirebaseAuthProvider (stub, ready)    │
   └─────────────────────────────────────────────────┘

   FIREBASE MIGRATION (3 steps):
   1. Uncomment FirebaseAuthProvider and fill in config
   2. Change: const ActiveProvider = FirebaseAuthProvider;
   3. Done — all exported helpers remain identical
   =================================================== */

'use strict';


/* ===================================================
   AUTH ERROR CLASS
   =================================================== */
export class AuthError extends Error {
  /**
   * @param {string} code   - Machine-readable code (matches Firebase codes)
   * @param {string} message - Human-readable message
   */
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}


/* ===================================================
   STORAGE KEYS
   =================================================== */
const KEYS = {
  USERS:       'trdctr_users',        // Registered user records
  CREDENTIALS: 'trdctr_credentials',  // Hashed passwords (keyed by uid)
  SESSION:     'trdctr_session',       // Active session (localStorage = persisted)
  SESSION_TMP: 'trdctr_session_tmp',  // Active session (sessionStorage = tab-only)
};


/* ===================================================
   STORAGE ADAPTER
   Isolates all read/write so Firestore can replace it.
   =================================================== */
const Store = {
  get(key) {
    try {
      const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value, persist = true) {
    try {
      const target = persist ? localStorage : sessionStorage;
      target.setItem(key, JSON.stringify(value));
    } catch { /* storage full / private mode — fail silently */ }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  },
};


/* ===================================================
   INTERNAL UTILITIES
   =================================================== */

/** Generate a pseudo-unique user ID. */
function generateId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 9);
  return `uid_${ts}_${rnd}`;
}

/**
 * Lightweight credential hash.
 *
 * ⚠ NOT cryptographically secure — for local/demo use only.
 *   Firebase Auth replaces password handling entirely in production.
 *   Passwords are NEVER stored in the user object or session.
 */
function hashCredential(password, salt) {
  const input = `${password}::${salt}::trdctr_v1`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h  = (Math.imul(h, 0x01000193) | 0) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function getUsers()        { return Store.get(KEYS.USERS)       ?? []; }
function getCredentials()  { return Store.get(KEYS.CREDENTIALS) ?? {}; }
function saveUsers(users)  { Store.set(KEYS.USERS, users); }
function saveCredentials(c){ Store.set(KEYS.CREDENTIALS, c); }


/* ===================================================
   LOCAL AUTH PROVIDER
   Implements the AuthProvider interface using localStorage.
   ─────────────────────────────────────────────────────
   AuthProvider interface (both providers must implement):
     signUp({ name, email, password })  → Promise<User>
     signIn({ email, password, rememberMe }) → Promise<User>
     signOut()                          → Promise<void>
     getCurrentUser()                   → User | null
   =================================================== */
const LocalAuthProvider = {

  async signUp({ name, email, password }) {
    const users    = getUsers();
    const emailKey = email.trim().toLowerCase();

    if (users.some(u => u.email === emailKey)) {
      throw new AuthError(
        'auth/email-already-in-use',
        'An account with this email already exists.'
      );
    }

    /* Build user record (no sensitive data) */
    const user = {
      id:        generateId(),
      name:      name.trim(),
      email:     emailKey,
      createdAt: new Date().toISOString(),
      plan:      'free',
    };

    /* Store hashed credential separately */
    const salt  = Math.random().toString(36).slice(2, 10);
    const creds = getCredentials();
    creds[user.id] = { hash: hashCredential(password, salt), salt };

    saveUsers([...users, user]);
    saveCredentials(creds);

    return user;
  },

  async signIn({ email, password, rememberMe = true }) {
    const users    = getUsers();
    const emailKey = email.trim().toLowerCase();
    const user     = users.find(u => u.email === emailKey);

    if (!user) {
      throw new AuthError(
        'auth/user-not-found',
        'No account found with that email address.'
      );
    }

    const creds = getCredentials();
    const cred  = creds[user.id];

    if (!cred || hashCredential(password, cred.salt) !== cred.hash) {
      throw new AuthError(
        'auth/wrong-password',
        'Incorrect password. Please try again.'
      );
    }

    /* Persist session */
    const sessionKey = rememberMe ? KEYS.SESSION : KEYS.SESSION_TMP;
    Store.set(sessionKey, user, rememberMe);

    return user;
  },

  async signOut() {
    Store.remove(KEYS.SESSION);
    Store.remove(KEYS.SESSION_TMP);
  },

  getCurrentUser() {
    return Store.get(KEYS.SESSION) ?? Store.get(KEYS.SESSION_TMP) ?? null;
  },
};


/* ===================================================
   FIREBASE AUTH PROVIDER  (uncomment to activate)
   ─────────────────────────────────────────────────
   Import Firebase at the top of this file:

   import { initializeApp } from 'firebase/app';
   import {
     getAuth, createUserWithEmailAndPassword,
     signInWithEmailAndPassword, signOut,
     updateProfile, sendEmailVerification,
     onAuthStateChanged, setPersistence,
     browserLocalPersistence, browserSessionPersistence,
   } from 'firebase/auth';
   import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

   const app  = initializeApp({ ...your config... });
   const auth = getAuth(app);
   const db   = getFirestore(app);

const FirebaseAuthProvider = {
  async signUp({ name, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    const user = {
      id:        cred.user.uid,
      name,
      email:     cred.user.email,
      createdAt: new Date().toISOString(),
      plan:      'free',
    };
    await setDoc(doc(db, 'users', user.id), user);
    return user;
  },

  async signIn({ email, password, rememberMe = true }) {
    const persistence = rememberMe
      ? browserLocalPersistence
      : browserSessionPersistence;
    await setPersistence(auth, persistence);
    const cred  = await signInWithEmailAndPassword(auth, email, password);
    const snap  = await getDoc(doc(db, 'users', cred.user.uid));
    return snap.exists() ? snap.data() : { id: cred.user.uid, email };
  },

  async signOut() {
    await signOut(auth);
  },

  getCurrentUser() {
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    return {
      id:    fbUser.uid,
      name:  fbUser.displayName ?? '',
      email: fbUser.email,
      plan:  'free',
    };
  },
};
   =================================================== */


/* ===================================================
   ACTIVE PROVIDER
   ─────────────────────────────────────────────────
   To migrate to Firebase:
     const ActiveProvider = FirebaseAuthProvider;
   =================================================== */
const ActiveProvider = LocalAuthProvider;


/* ===================================================
   PUBLIC API
   These are the only functions the rest of the app uses.
   Their signatures never change, regardless of provider.
   =================================================== */

/**
 * Register a new user.
 *
 * @param {{ name: string, email: string, password: string }}
 * @returns {Promise<User>}  The created user object (no password).
 * @throws  {AuthError}
 *
 * User object shape:
 * {
 *   id:        string,   // unique uid
 *   name:      string,
 *   email:     string,   // always lowercase
 *   createdAt: string,   // ISO 8601
 *   plan:      'free'    // default plan
 * }
 */
export async function registerUser({ name, email, password }) {
  const user = await ActiveProvider.signUp({ name, email, password });
  return user;
}

/**
 * Log in an existing user and persist the session.
 *
 * @param {{ email: string, password: string, rememberMe?: boolean }}
 * @returns {Promise<User>}
 * @throws  {AuthError}
 */
export async function loginUser({ email, password, rememberMe = true }) {
  const user = await ActiveProvider.signIn({ email, password, rememberMe });
  return user;
}

/**
 * Log out the current user and clear the session.
 *
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  await ActiveProvider.signOut();
}

/**
 * Check whether a user is currently authenticated.
 *
 * @returns {User | null}  The current user object, or null if not logged in.
 */
export function checkAuth() {
  return ActiveProvider.getCurrentUser();
}

/**
 * Get the current user (alias of checkAuth for readability).
 *
 * @returns {User | null}
 */
export function getCurrentUser() {
  return checkAuth();
}
