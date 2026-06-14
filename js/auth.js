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
   SVG ICONS
   =================================================== */
const ICONS = {
  errorCircle: `<svg class="form-error-icon" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`,

  checkCircle: `<svg width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,

  validCheck: `<svg width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,

  eyeOn: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
    viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/></svg>`,

  eyeOff: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
    viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
      a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12
      4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0
      1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`,
};


/* ===================================================
   VALIDATORS  (pure functions → string | null)
   =================================================== */
const VALIDATORS = {
  name(v) {
    const t = v.trim();
    if (!t)            return 'Full name is required.';
    if (t.length < 3)  return 'Name must be at least 3 characters.';
    if (t.length > 80) return 'Name is too long (max 80 characters).';
    if (!/[a-zA-Z]/.test(t)) return 'Name must contain at least one letter.';
    return null;
  },

  email(v) {
    const t = v.trim();
    if (!t) return 'Email address is required.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!re.test(t)) return 'Please enter a valid email address.';
    return null;
  },

  password(v) {
    if (!v)           return 'Password is required.';
    if (v.length < 8) return 'Password must be at least 8 characters.';
    return null;
  },

  confirmPassword(v, original) {
    if (!v)             return 'Please confirm your password.';
    if (v !== original) return 'Passwords do not match.';
    return null;
  },
};


/* ===================================================
   FIELD STATE HELPERS
   =================================================== */

/**
 * Inject a valid-check icon into an input's wrapper (once).
 * Works for both icon-leading and password inputs.
 */
function ensureValidIcon(input) {
  const wrap = input.closest('.form-input-wrap');
  if (!wrap) return null;
  let icon = wrap.querySelector('.input-valid-icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'input-valid-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS.validCheck;
    /* Place before the pass-toggle if present, otherwise append */
    const toggle = wrap.querySelector('.pass-toggle');
    if (toggle) {
      wrap.insertBefore(icon, toggle);
      /* Push the toggle left a bit to avoid overlap */
      toggle.style.right = '34px';
      icon.style.right   = '12px';
    } else {
      icon.style.right = '12px';
      wrap.appendChild(icon);
    }
  }
  return icon;
}

function showError(inputEl, errorEl, message) {
  /* Input styling */
  inputEl.classList.remove('valid');
  inputEl.classList.add('error');

  /* Hide valid icon */
  const icon = ensureValidIcon(inputEl);
  if (icon) icon.classList.remove('show');

  /* Animate error in */
  if (errorEl) {
    errorEl.innerHTML = ICONS.errorCircle + '<span>' + message + '</span>';
    errorEl.classList.add('show');
    errorEl.removeAttribute('hidden');
  }
}

function showValid(inputEl, errorEl, hintEl, hintMessage) {
  /* Input styling */
  inputEl.classList.remove('error');
  inputEl.classList.add('valid');

  /* Show valid check icon */
  const icon = ensureValidIcon(inputEl);
  if (icon) icon.classList.add('show');

  /* Hide error */
  if (errorEl) errorEl.classList.remove('show');

  /* Optionally show a success hint */
  if (hintEl && hintMessage) {
    hintEl.innerHTML = ICONS.checkCircle + '<span>' + hintMessage + '</span>';
    hintEl.classList.add('show');
  }
}

function clearState(inputEl, errorEl, hintEl) {
  inputEl.classList.remove('error', 'valid');
  const icon = inputEl.closest('.form-input-wrap')?.querySelector('.input-valid-icon');
  if (icon) icon.classList.remove('show');
  if (errorEl) errorEl.classList.remove('show');
  if (hintEl)  hintEl.classList.remove('show');
}

/** Shake the input and briefly flash it red */
function shakeField(inputEl) {
  inputEl.classList.remove('shake');
  /* Force reflow so re-adding the class triggers the animation */
  void inputEl.offsetWidth;
  inputEl.classList.add('shake');
  inputEl.addEventListener('animationend', () => inputEl.classList.remove('shake'), { once: true });
}

function shakeAllErrors(fields) {
  fields.forEach(f => {
    if (f.classList.contains('error')) shakeField(f);
  });
}

function showGlobalError(message) {
  const el = document.getElementById('authGlobalError');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideGlobalError() {
  const el = document.getElementById('authGlobalError');
  if (el) el.style.display = 'none';
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}


/* ===================================================
   PASSWORD STRENGTH METER
   =================================================== */
function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)                score++;
  if (pw.length >= 12)               score++;
  if (/[A-Z]/.test(pw))             score++;
  if (/[0-9]/.test(pw))             score++;
  if (/[^A-Za-z0-9]/.test(pw))      score++;

  const levels = [
    { label: 'Weak',   cls: 'weak',   color: '#ef4444' },
    { label: 'Fair',   cls: 'fair',   color: '#f59e0b' },
    { label: 'Good',   cls: 'good',   color: '#3b82f6' },
    { label: 'Strong', cls: 'strong', color: '#00d26a' },
  ];
  const idx = Math.min(Math.floor((score - 1) / 1.25), 3);
  return score === 0 ? null : levels[Math.max(idx, 0)];
}

function renderStrength(pw, barsEl, labelEl) {
  if (!barsEl || !labelEl) return;
  const bars   = barsEl.querySelectorAll('.strength-bar');
  const result = pw ? passwordStrength(pw) : null;

  bars.forEach((bar, i) => {
    bar.className = 'strength-bar';
    if (result && i <= ['weak','fair','good','strong'].indexOf(result.cls)) {
      bar.classList.add(result.cls);
    }
  });

  labelEl.textContent = result ? 'Strength: ' + result.label : '';
  labelEl.style.color = result ? result.color : '';
}


/* ===================================================
   PASSWORD VISIBILITY TOGGLE
   =================================================== */
function initPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input  = document.getElementById(inputId);
  if (!toggle || !input) return;

  toggle.innerHTML = ICONS.eyeOn;

  toggle.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type    = showing ? 'password' : 'text';
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    toggle.innerHTML = showing ? ICONS.eyeOn : ICONS.eyeOff;
  });
}


/* ===================================================
   DEBOUNCE UTILITY
   =================================================== */
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}


/* ===================================================
   FIREBASE AUTH HANDLERS
   (wired up — no-op until Firebase connected)
   =================================================== */
async function handleLogin({ email, password, rememberMe }) {
  /* ---- UNCOMMENT FOR FIREBASE ----
  const persistence = rememberMe
    ? browserLocalPersistence
    : browserSessionPersistence;
  await setPersistence(auth, persistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
  --------------------------------- */
  return new Promise((resolve) => setTimeout(() => resolve({ email }), 1200));
}

async function handleSignup({ name, email, password }) {
  /* ---- UNCOMMENT FOR FIREBASE ----
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  return cred.user;
  --------------------------------- */
  return new Promise((resolve) => setTimeout(() => resolve({ displayName: name, email }), 1400));
}

async function handleGoogleAuth() {
  /* ---- UNCOMMENT FOR FIREBASE ----
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
  --------------------------------- */
  return new Promise((resolve) => setTimeout(() => resolve({}), 1000));
}

function mapFirebaseError(code) {
  const map = {
    'auth/user-not-found':         'No account found with that email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/email-already-in-use':   'An account with that email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/popup-closed-by-user':   'Google sign-in was cancelled.',
    'auth/invalid-credential':     'Invalid email or password. Please check and try again.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}


/* ===================================================
   LOGIN PAGE
   =================================================== */
function initLoginPage() {
  const form       = document.getElementById('loginForm');
  const submitBtn  = document.getElementById('loginBtn');
  const emailInput = document.getElementById('loginEmail');
  const passInput  = document.getElementById('loginPassword');
  const rememberEl = document.getElementById('rememberMe');
  const googleBtn  = document.getElementById('googleLoginBtn');
  const successEl  = document.getElementById('loginSuccess');
  if (!form) return;

  const emailError = document.getElementById('loginEmailError');
  const passError  = document.getElementById('loginPasswordError');

  /* Track which fields have been "touched" (blurred at least once) */
  const touched = { email: false, password: false };

  /* --- Validate a single field and update its UI --- */
  function validateEmail(show) {
    const err = VALIDATORS.email(emailInput.value);
    if (err && show) {
      showError(emailInput, emailError, err);
      return false;
    } else if (!err) {
      showValid(emailInput, emailError, null, null);
      return true;
    } else {
      clearState(emailInput, emailError, null);
      return false;
    }
  }

  function validatePassword(show) {
    const err = VALIDATORS.password(passInput.value);
    if (err && show) {
      showError(passInput, passError, err);
      return false;
    } else if (!err) {
      showValid(passInput, passError, null, null);
      return true;
    } else {
      clearState(passInput, passError, null);
      return false;
    }
  }

  /* --- Blur: mark touched and validate --- */
  emailInput.addEventListener('blur', () => {
    touched.email = true;
    validateEmail(true);
  });

  passInput.addEventListener('blur', () => {
    touched.password = true;
    validatePassword(true);
  });

  /* --- Input: live validate only after field has been touched --- */
  emailInput.addEventListener('input', debounce(() => {
    if (touched.email) validateEmail(true);
  }, 300));

  passInput.addEventListener('input', () => {
    if (touched.password) validatePassword(true);
  });

  /* --- Submit --- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideGlobalError();

    /* Force-touch all fields */
    touched.email    = true;
    touched.password = true;

    const emailOk = validateEmail(true);
    const passOk  = validatePassword(true);

    if (!emailOk || !passOk) {
      shakeAllErrors([emailInput, passInput]);
      return;
    }

    setButtonLoading(submitBtn, true);

    try {
      await handleLogin({
        email:      emailInput.value.trim(),
        password:   passInput.value,
        rememberMe: rememberEl?.checked ?? false,
      });
      form.style.display = 'none';
      successEl?.classList.add('show');
      setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    } catch (err) {
      showGlobalError(mapFirebaseError(err?.code));
      shakeField(emailInput);
      shakeField(passInput);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  /* --- Google --- */
  googleBtn?.addEventListener('click', async () => {
    hideGlobalError();
    googleBtn.disabled = true;
    try {
      await handleGoogleAuth();
      window.location.href = 'index.html';
    } catch (err) {
      showGlobalError(mapFirebaseError(err?.code));
    } finally {
      googleBtn.disabled = false;
    }
  });
}


/* ===================================================
   SIGNUP PAGE
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
  const labelEl    = document.getElementById('strengthLabel');
  if (!form) return;

  const nameError = document.getElementById('signupNameError');
  const emailError= document.getElementById('signupEmailError');
  const passError = document.getElementById('signupPasswordError');
  const confError = document.getElementById('signupConfirmError');

  const touched = { name: false, email: false, password: false, confirm: false };

  /* --- Per-field validators --- */
  function validateName(show) {
    const err = VALIDATORS.name(nameInput.value);
    if (err && show) { showError(nameInput, nameError, err); return false; }
    if (!err)        { showValid(nameInput, nameError, null, null); return true; }
    clearState(nameInput, nameError, null);
    return false;
  }

  function validateEmail(show) {
    const err = VALIDATORS.email(emailInput.value);
    if (err && show) { showError(emailInput, emailError, err); return false; }
    if (!err)        { showValid(emailInput, emailError, null, null); return true; }
    clearState(emailInput, emailError, null);
    return false;
  }

  function validatePassword(show) {
    const err = VALIDATORS.password(passInput.value);
    if (err && show) { showError(passInput, passError, err); return false; }
    if (!err)        { showValid(passInput, passError, null, null); return true; }
    clearState(passInput, passError, null);
    return false;
  }

  function validateConfirm(show) {
    const err = VALIDATORS.confirmPassword(confInput.value, passInput.value);
    if (err && show) { showError(confInput, confError, err); return false; }
    if (!err && confInput.value) { showValid(confInput, confError, null, null); return true; }
    clearState(confInput, confError, null);
    return false;
  }

  /* --- Blur handlers --- */
  nameInput.addEventListener('blur', () => { touched.name = true; validateName(true); });
  emailInput.addEventListener('blur', () => { touched.email = true; validateEmail(true); });
  passInput.addEventListener('blur', () => { touched.password = true; validatePassword(true); });
  confInput.addEventListener('blur', () => { touched.confirm = true; validateConfirm(true); });

  /* --- Live input handlers --- */
  nameInput.addEventListener('input', debounce(() => {
    if (touched.name) validateName(true);
  }, 350));

  emailInput.addEventListener('input', debounce(() => {
    if (touched.email) validateEmail(true);
  }, 350));

  passInput.addEventListener('input', () => {
    const val = passInput.value;

    /* Strength meter */
    if (val) {
      strengthEl?.classList.add('show');
      renderStrength(val, barsEl, labelEl);
    } else {
      strengthEl?.classList.remove('show');
    }

    if (touched.password) validatePassword(true);

    /* Re-validate confirm if already touched */
    if (touched.confirm && confInput.value) validateConfirm(true);
  });

  confInput.addEventListener('input', () => {
    if (touched.confirm) validateConfirm(true);
  });

  /* --- Submit --- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideGlobalError();

    /* Force-touch all */
    touched.name     = true;
    touched.email    = true;
    touched.password = true;
    touched.confirm  = true;

    const nameOk  = validateName(true);
    const emailOk = validateEmail(true);
    const passOk  = validatePassword(true);
    const confOk  = validateConfirm(true);

    if (!nameOk || !emailOk || !passOk || !confOk) {
      shakeAllErrors([nameInput, emailInput, passInput, confInput]);
      /* Scroll to first error */
      const firstError = form.querySelector('.form-input.error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setButtonLoading(submitBtn, true);

    try {
      await handleSignup({
        name:     nameInput.value.trim(),
        email:    emailInput.value.trim(),
        password: passInput.value,
      });
      form.style.display = 'none';
      successEl?.classList.add('show');
      setTimeout(() => { window.location.href = 'login.html'; }, 2200);
    } catch (err) {
      showGlobalError(mapFirebaseError(err?.code));
      shakeAllErrors([nameInput, emailInput, passInput, confInput]);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  /* --- Google --- */
  googleBtn?.addEventListener('click', async () => {
    hideGlobalError();
    googleBtn.disabled = true;
    try {
      await handleGoogleAuth();
      window.location.href = 'index.html';
    } catch (err) {
      showGlobalError(mapFirebaseError(err?.code));
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

  if (page === 'login') {
    initLoginPage();
    initPasswordToggle('loginPassToggle', 'loginPassword');
  }

  if (page === 'signup') {
    initSignupPage();
    initPasswordToggle('signupPassToggle', 'signupPassword');
    initPasswordToggle('signupConfToggle', 'signupConfirm');
  }
});
