/* ===================================================
   TRADOCTORY — AUTH UI  (auth.js)

   Handles all form interaction, validation, and user
   feedback. Delegates all auth logic to auth-store.js.

   Dependency map:
     auth.js  →  auth-store.js  →  LocalAuthProvider
                                └→  FirebaseAuthProvider (future)
   =================================================== */

'use strict';

import {
  registerUser,
  loginUser,
  logoutUser,
  checkAuth,
} from './auth-store.js';


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
   FIELD VALIDATORS  (pure → string | null)
   =================================================== */
const VALIDATORS = {
  name(v) {
    const t = v.trim();
    if (!t)               return 'Full name is required.';
    if (t.length < 3)     return 'Name must be at least 3 characters.';
    if (t.length > 80)    return 'Name is too long (max 80 characters).';
    if (!/[a-zA-Z]/.test(t)) return 'Name must contain at least one letter.';
    return null;
  },
  email(v) {
    const t = v.trim();
    if (!t) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t))
      return 'Please enter a valid email address.';
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
function ensureValidIcon(input) {
  const wrap = input.closest('.form-input-wrap');
  if (!wrap) return null;
  let icon = wrap.querySelector('.input-valid-icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'input-valid-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS.validCheck;
    const toggle = wrap.querySelector('.pass-toggle');
    if (toggle) {
      wrap.insertBefore(icon, toggle);
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
  inputEl.classList.remove('valid');
  inputEl.classList.add('error');
  const icon = ensureValidIcon(inputEl);
  if (icon) icon.classList.remove('show');
  if (errorEl) {
    errorEl.innerHTML = ICONS.errorCircle + '<span>' + message + '</span>';
    errorEl.classList.add('show');
  }
}

function showValid(inputEl, errorEl) {
  inputEl.classList.remove('error');
  inputEl.classList.add('valid');
  const icon = ensureValidIcon(inputEl);
  if (icon) icon.classList.add('show');
  if (errorEl) errorEl.classList.remove('show');
}

function clearState(inputEl, errorEl) {
  inputEl.classList.remove('error', 'valid');
  const icon = inputEl.closest('.form-input-wrap')?.querySelector('.input-valid-icon');
  if (icon) icon.classList.remove('show');
  if (errorEl) errorEl.classList.remove('show');
}

function shakeField(inputEl) {
  inputEl.classList.remove('shake');
  void inputEl.offsetWidth;
  inputEl.classList.add('shake');
  inputEl.addEventListener('animationend', () => inputEl.classList.remove('shake'), { once: true });
}

function shakeAllErrors(fields) {
  fields.forEach(f => { if (f?.classList.contains('error')) shakeField(f); });
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
  if (pw.length >= 8)           score++;
  if (pw.length >= 12)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Weak',   cls: 'weak',   color: '#ef4444' },
    { label: 'Fair',   cls: 'fair',   color: '#f59e0b' },
    { label: 'Good',   cls: 'good',   color: '#3b82f6' },
    { label: 'Strong', cls: 'strong', color: '#00d26a' },
  ];
  return score === 0 ? null : levels[Math.min(Math.floor((score - 1) / 1.25), 3)];
}

function renderStrength(pw, barsEl, labelEl) {
  if (!barsEl || !labelEl) return;
  const bars   = barsEl.querySelectorAll('.strength-bar');
  const result = pw ? passwordStrength(pw) : null;
  bars.forEach((bar, i) => {
    bar.className = 'strength-bar';
    if (result && i <= ['weak','fair','good','strong'].indexOf(result.cls))
      bar.classList.add(result.cls);
  });
  labelEl.textContent = result ? 'Strength: ' + result.label : '';
  labelEl.style.color = result?.color ?? '';
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
   DEBOUNCE
   =================================================== */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}


/* ===================================================
   MAP AUTHERROR CODES → USER-FRIENDLY MESSAGES
   (mirrors Firebase error codes for drop-in compat)
   =================================================== */
function mapAuthError(err) {
  const codes = {
    'auth/email-already-in-use':   'An account with this email already exists. Try logging in.',
    'auth/user-not-found':         'No account found with that email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 8 characters.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/popup-closed-by-user':   'Google sign-in was cancelled.',
    'auth/invalid-credential':     'Invalid email or password.',
  };
  return codes[err?.code] ?? err?.message ?? 'Something went wrong. Please try again.';
}


/* ===================================================
   LOGIN PAGE
   =================================================== */
function initLoginPage() {
  const form        = document.getElementById('loginForm');
  const submitBtn   = document.getElementById('loginBtn');
  const emailInput  = document.getElementById('loginEmail');
  const passInput   = document.getElementById('loginPassword');
  const rememberEl  = document.getElementById('rememberMe');
  const googleBtn   = document.getElementById('googleLoginBtn');
  const successEl   = document.getElementById('loginSuccess');
  if (!form) return;

  const emailError = document.getElementById('loginEmailError');
  const passError  = document.getElementById('loginPasswordError');
  const touched    = { email: false, password: false };

  function validateEmail(show) {
    const err = VALIDATORS.email(emailInput.value);
    if (err && show) { showError(emailInput, emailError, err); return false; }
    if (!err)        { showValid(emailInput, emailError);      return true;  }
    clearState(emailInput, emailError);
    return false;
  }

  function validatePassword(show) {
    const err = VALIDATORS.password(passInput.value);
    if (err && show) { showError(passInput, passError, err); return false; }
    if (!err)        { showValid(passInput, passError);       return true;  }
    clearState(passInput, passError);
    return false;
  }

  emailInput.addEventListener('blur',  () => { touched.email = true;    validateEmail(true);    });
  passInput.addEventListener('blur',   () => { touched.password = true; validatePassword(true); });
  emailInput.addEventListener('input', debounce(() => { if (touched.email)    validateEmail(true);    }, 320));
  passInput.addEventListener('input',  ()           => { if (touched.password) validatePassword(true); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideGlobalError();

    touched.email = touched.password = true;
    const emailOk = validateEmail(true);
    const passOk  = validatePassword(true);

    if (!emailOk || !passOk) {
      shakeAllErrors([emailInput, passInput]);
      return;
    }

    setButtonLoading(submitBtn, true);
    try {
      await loginUser({
        email:      emailInput.value.trim(),
        password:   passInput.value,
        rememberMe: rememberEl?.checked ?? true,
      });
      form.style.display = 'none';
      successEl?.classList.add('show');
      setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    } catch (err) {
      showGlobalError(mapAuthError(err));
      shakeField(emailInput);
      shakeField(passInput);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  googleBtn?.addEventListener('click', () => {
    showGlobalError('Google sign-in requires Firebase. See auth-store.js to enable it.');
  });
}


/* ===================================================
   SIGNUP PAGE
   =================================================== */
function initSignupPage() {
  const form        = document.getElementById('signupForm');
  const submitBtn   = document.getElementById('signupBtn');
  const nameInput   = document.getElementById('signupName');
  const emailInput  = document.getElementById('signupEmail');
  const passInput   = document.getElementById('signupPassword');
  const confInput   = document.getElementById('signupConfirm');
  const googleBtn   = document.getElementById('googleSignupBtn');
  const successEl   = document.getElementById('signupSuccess');
  const successName = document.getElementById('signupSuccessName');
  const strengthEl  = document.getElementById('passwordStrength');
  const barsEl      = document.getElementById('strengthBars');
  const labelEl     = document.getElementById('strengthLabel');
  if (!form) return;

  const nameError  = document.getElementById('signupNameError');
  const emailError = document.getElementById('signupEmailError');
  const passError  = document.getElementById('signupPasswordError');
  const confError  = document.getElementById('signupConfirmError');
  const touched    = { name: false, email: false, password: false, confirm: false };

  function validateName(show) {
    const err = VALIDATORS.name(nameInput.value);
    if (err && show) { showError(nameInput, nameError, err); return false; }
    if (!err)        { showValid(nameInput, nameError);      return true;  }
    clearState(nameInput, nameError);
    return false;
  }

  function validateEmail(show) {
    const err = VALIDATORS.email(emailInput.value);
    if (err && show) { showError(emailInput, emailError, err); return false; }
    if (!err)        { showValid(emailInput, emailError);       return true;  }
    clearState(emailInput, emailError);
    return false;
  }

  function validatePassword(show) {
    const err = VALIDATORS.password(passInput.value);
    if (err && show) { showError(passInput, passError, err); return false; }
    if (!err)        { showValid(passInput, passError);       return true;  }
    clearState(passInput, passError);
    return false;
  }

  function validateConfirm(show) {
    const err = VALIDATORS.confirmPassword(confInput.value, passInput.value);
    if (err && show)            { showError(confInput, confError, err); return false; }
    if (!err && confInput.value){ showValid(confInput, confError);      return true;  }
    clearState(confInput, confError);
    return false;
  }

  nameInput.addEventListener('blur',  () => { touched.name    = true; validateName(true);     });
  emailInput.addEventListener('blur', () => { touched.email   = true; validateEmail(true);    });
  passInput.addEventListener('blur',  () => { touched.password= true; validatePassword(true); });
  confInput.addEventListener('blur',  () => { touched.confirm = true; validateConfirm(true);  });

  nameInput.addEventListener('input',  debounce(() => { if (touched.name)     validateName(true);    }, 350));
  emailInput.addEventListener('input', debounce(() => { if (touched.email)    validateEmail(true);   }, 350));

  passInput.addEventListener('input', () => {
    const val = passInput.value;
    if (val) { strengthEl?.classList.add('show'); renderStrength(val, barsEl, labelEl); }
    else       strengthEl?.classList.remove('show');
    if (touched.password) validatePassword(true);
    if (touched.confirm && confInput.value) validateConfirm(true);
  });

  confInput.addEventListener('input', () => {
    if (touched.confirm) validateConfirm(true);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideGlobalError();

    touched.name = touched.email = touched.password = touched.confirm = true;
    const nameOk  = validateName(true);
    const emailOk = validateEmail(true);
    const passOk  = validatePassword(true);
    const confOk  = validateConfirm(true);

    if (!nameOk || !emailOk || !passOk || !confOk) {
      shakeAllErrors([nameInput, emailInput, passInput, confInput]);
      form.querySelector('.form-input.error')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setButtonLoading(submitBtn, true);
    try {
      const user = await registerUser({
        name:     nameInput.value.trim(),
        email:    emailInput.value.trim(),
        password: passInput.value,
      });

      /* Show personalised success message */
      if (successName) successName.textContent = user.name.split(' ')[0];
      form.style.display = 'none';
      successEl?.classList.add('show');
      setTimeout(() => { window.location.href = 'login.html'; }, 2400);
    } catch (err) {
      showGlobalError(mapAuthError(err));
      if (err?.code === 'auth/email-already-in-use') shakeField(emailInput);
      else shakeAllErrors([nameInput, emailInput, passInput, confInput]);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  googleBtn?.addEventListener('click', () => {
    showGlobalError('Google sign-up requires Firebase. See auth-store.js to enable it.');
  });
}


/* ===================================================
   BOOTSTRAP
   =================================================== */
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
