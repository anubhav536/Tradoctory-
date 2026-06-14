/* ===================================================
   TRADOCTORY — AUTH JAVASCRIPT
   Firebase Integration Ready

   To connect Firebase:
   1. npm install firebase (or use CDN)
   2. Uncomment the import block below
   3. Replace firebaseConfig with your project config
   4. Uncomment the Firebase calls in handleLogin / handleSignup
   =================================================== */

'use strict';

/* ===================================================
   FIREBASE CONFIG (uncomment when ready)
   ===================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js';
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         updateProfile,
         sendEmailVerification,
         GoogleAuthProvider,
         signInWithPopup,
         setPersistence,
         browserLocalPersistence,
         browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
=================================================== */


/* ===================================================
   FORM VALIDATION HELPERS
   =================================================== */
const VALIDATORS = {
  name(v) {
    const t = v.trim();
    if (!t)             return 'Full name is required.';
    if (t.length < 2)   return 'Name must be at least 2 characters.';
    if (t.length > 80)  return 'Name is too long.';
    return null;
  },
  email(v) {
    const t = v.trim();
    if (!t) return 'Email address is required.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(t)) return 'Please enter a valid email address.';
    return null;
  },
  password(v) {
    if (!v)            return 'Password is required.';
    if (v.length < 8)  return 'Password must be at least 8 characters.';
    return null;
  },
  confirmPassword(v, original) {
    if (!v)          return 'Please confirm your password.';
    if (v !== original) return 'Passwords do not match.';
    return null;
  },
};

function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (!input) return;
  input.classList.add('error');
  if (error) {
    error.textContent = message;
    error.classList.add('show');
  }
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (!input) return;
  input.classList.remove('error');
  if (error) error.classList.remove('show');
}

function clearAllErrors(...ids) {
  ids.forEach(clearFieldError);
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function showAuthError(message) {
  let el = document.getElementById('authGlobalError');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function hideAuthError() {
  const el = document.getElementById('authGlobalError');
  if (el) el.style.display = 'none';
}


/* ===================================================
   PASSWORD STRENGTH METER
   =================================================== */
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8)                     score++;
  if (password.length >= 12)                    score++;
  if (/[A-Z]/.test(password))                  score++;
  if (/[0-9]/.test(password))                  score++;
  if (/[^A-Za-z0-9]/.test(password))           score++;

  if (score <= 1) return { level: 0, label: 'Weak',   cls: 'weak'   };
  if (score === 2) return { level: 1, label: 'Fair',   cls: 'fair'   };
  if (score === 3) return { level: 2, label: 'Good',   cls: 'good'   };
  return              { level: 3, label: 'Strong', cls: 'strong' };
}

function updateStrengthMeter(password, barsContainer, labelEl) {
  const bars   = barsContainer.querySelectorAll('.strength-bar');
  const result = checkPasswordStrength(password);

  bars.forEach((bar, i) => {
    bar.className = 'strength-bar';
    if (i <= result.level) bar.classList.add(result.cls);
  });

  labelEl.textContent = password ? `Strength: ${result.label}` : '';
}


/* ===================================================
   PASSWORD VISIBILITY TOGGLE
   =================================================== */
function initPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input  = document.getElementById(inputId);
  if (!toggle || !input) return;

  toggle.addEventListener('click', () => {
    const isPass = input.type === 'password';
    input.type   = isPass ? 'text' : 'password';
    toggle.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
    toggle.innerHTML = isPass ? eyeOffIcon() : eyeIcon();
  });
}

function eyeIcon() {
  return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
          viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/></svg>`;
}

function eyeOffIcon() {
  return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
          viewBox="0 0 24 24">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
            a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12
            4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0
            1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}


/* ===================================================
   FIREBASE AUTH HANDLERS (wired up, no-op until Firebase connected)
   =================================================== */
async function handleLogin({ email, password, rememberMe }) {
  /* ------ UNCOMMENT FOR FIREBASE ------ */
  // const persistence = rememberMe
  //   ? browserLocalPersistence
  //   : browserSessionPersistence;
  // await setPersistence(auth, persistence);
  // const cred = await signInWithEmailAndPassword(auth, email, password);
  // return cred.user;

  /* Simulated success for demo */
  return new Promise((resolve) => setTimeout(() => resolve({ email }), 1200));
}

async function handleSignup({ name, email, password }) {
  /* ------ UNCOMMENT FOR FIREBASE ------ */
  // const cred = await createUserWithEmailAndPassword(auth, email, password);
  // await updateProfile(cred.user, { displayName: name });
  // await sendEmailVerification(cred.user);
  // return cred.user;

  /* Simulated success for demo */
  return new Promise((resolve) => setTimeout(() => resolve({ displayName: name, email }), 1400));
}

async function handleGoogleAuth() {
  /* ------ UNCOMMENT FOR FIREBASE ------ */
  // const result = await signInWithPopup(auth, googleProvider);
  // return result.user;
  return new Promise((resolve) => setTimeout(() => resolve({}), 1000));
}

function mapFirebaseError(code) {
  const map = {
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/email-already-in-use':   'An account with that email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password should be at least 6 characters.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user':   'Google sign-in was cancelled.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}


/* ===================================================
   LOGIN PAGE INIT
   =================================================== */
function initLoginPage() {
  const form        = document.getElementById('loginForm');
  const submitBtn   = document.getElementById('loginBtn');
  const emailInput  = document.getElementById('loginEmail');
  const passInput   = document.getElementById('loginPassword');
  const rememberBox = document.getElementById('rememberMe');
  const googleBtn   = document.getElementById('googleLoginBtn');
  const successEl   = document.getElementById('loginSuccess');
  if (!form) return;

  /* Real-time validation */
  emailInput?.addEventListener('blur', () => {
    const err = VALIDATORS.email(emailInput.value);
    err ? showFieldError('loginEmail', err) : clearFieldError('loginEmail');
  });

  passInput?.addEventListener('input', () => clearFieldError('loginPassword'));

  /* Form submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();

    const email    = emailInput.value;
    const password = passInput.value;
    const remember = rememberBox?.checked ?? false;

    let valid = true;
    clearAllErrors('loginEmail', 'loginPassword');

    const emailErr = VALIDATORS.email(email);
    if (emailErr) { showFieldError('loginEmail', emailErr); valid = false; }

    const passErr = VALIDATORS.password(password);
    if (passErr)  { showFieldError('loginPassword', passErr); valid = false; }

    if (!valid) return;

    setButtonLoading(submitBtn, true);

    try {
      await handleLogin({ email, password, rememberMe: remember });
      /* On success: show success state, then redirect */
      form.style.display = 'none';
      successEl?.classList.add('show');
      setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    } catch (err) {
      const msg = mapFirebaseError(err?.code);
      showAuthError(msg);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  /* Google sign-in */
  googleBtn?.addEventListener('click', async () => {
    hideAuthError();
    googleBtn.disabled = true;
    try {
      await handleGoogleAuth();
      window.location.href = 'index.html';
    } catch (err) {
      showAuthError(mapFirebaseError(err?.code));
    } finally {
      googleBtn.disabled = false;
    }
  });
}


/* ===================================================
   SIGNUP PAGE INIT
   =================================================== */
function initSignupPage() {
  const form       = document.getElementById('signupForm');
  const submitBtn  = document.getElementById('signupBtn');
  const nameInput  = document.getElementById('signupName');
  const emailInput = document.getElementById('signupEmail');
  const passInput  = document.getElementById('signupPassword');
  const confInput  = document.getElementById('signupConfirm');
  const googleBtn  = document.getElementById('googleSignupBtn');
  const successEl  = document.getElementById('signupSuccess');
  const strengthEl = document.getElementById('passwordStrength');
  const barsEl     = document.getElementById('strengthBars');
  const strengthLbl= document.getElementById('strengthLabel');
  if (!form) return;

  /* Real-time validation */
  nameInput?.addEventListener('blur', () => {
    const err = VALIDATORS.name(nameInput.value);
    err ? showFieldError('signupName', err) : clearFieldError('signupName');
  });

  emailInput?.addEventListener('blur', () => {
    const err = VALIDATORS.email(emailInput.value);
    err ? showFieldError('signupEmail', err) : clearFieldError('signupEmail');
  });

  passInput?.addEventListener('input', () => {
    clearFieldError('signupPassword');
    const val = passInput.value;
    if (val) {
      strengthEl?.classList.add('show');
      updateStrengthMeter(val, barsEl, strengthLbl);
    } else {
      strengthEl?.classList.remove('show');
    }
  });

  confInput?.addEventListener('input', () => {
    clearFieldError('signupConfirm');
  });

  /* Form submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();

    const name     = nameInput?.value ?? '';
    const email    = emailInput.value;
    const password = passInput.value;
    const confirm  = confInput?.value ?? '';

    let valid = true;
    clearAllErrors('signupName', 'signupEmail', 'signupPassword', 'signupConfirm');

    const nameErr = VALIDATORS.name(name);
    if (nameErr)  { showFieldError('signupName', nameErr); valid = false; }

    const emailErr = VALIDATORS.email(email);
    if (emailErr) { showFieldError('signupEmail', emailErr); valid = false; }

    const passErr = VALIDATORS.password(password);
    if (passErr)  { showFieldError('signupPassword', passErr); valid = false; }

    const confErr = VALIDATORS.confirmPassword(confirm, password);
    if (confErr)  { showFieldError('signupConfirm', confErr); valid = false; }

    if (!valid) return;

    setButtonLoading(submitBtn, true);

    try {
      await handleSignup({ name, email, password });
      form.style.display = 'none';
      successEl?.classList.add('show');
      setTimeout(() => { window.location.href = 'login.html'; }, 2200);
    } catch (err) {
      showAuthError(mapFirebaseError(err?.code));
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  /* Google sign-up */
  googleBtn?.addEventListener('click', async () => {
    hideAuthError();
    googleBtn.disabled = true;
    try {
      await handleGoogleAuth();
      window.location.href = 'index.html';
    } catch (err) {
      showAuthError(mapFirebaseError(err?.code));
    } finally {
      googleBtn.disabled = false;
    }
  });
}


/* ===================================================
   BOOTSTRAP
   =================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'login')  {
    initLoginPage();
    initPasswordToggle('loginPassToggle', 'loginPassword');
  }

  if (page === 'signup') {
    initSignupPage();
    initPasswordToggle('signupPassToggle', 'signupPassword');
    initPasswordToggle('signupConfToggle', 'signupConfirm');
  }
});
