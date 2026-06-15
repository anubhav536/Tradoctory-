/* ===================================================
   TRADOCTORY — AUTH UTILITIES  (auth-utils.js)

   Small, dependency-free helpers shared by the auth UI
   and provider layer. Keep this file pure and Firebase
   friendly: no DOM, storage, or provider-specific code.
   =================================================== */

'use strict';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TAG_PATTERN = /<[^>]*>/g;
const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g;
const MULTI_SPACE_PATTERN = /\s+/g;

/**
 * Remove characters that should never be persisted or echoed back to the UI.
 * This is intentionally lightweight; rendering still uses textContent where
 * user-provided values are displayed.
 */
export function sanitizeText(value) {
  return String(value ?? '')
    .replace(TAG_PATTERN, '')
    .replace(CONTROL_CHARS_PATTERN, '')
    .replace(MULTI_SPACE_PATTERN, ' ')
    .trim();
}

/** Normalize email exactly once before validation, lookup, and persistence. */
export function normalizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

/** Passwords are credentials, so preserve every typed character. */
export function normalizePassword(value) {
  return String(value ?? '');
}

export function sanitizeAuthInput({ name = '', email = '', password = '', confirmPassword = '' } = {}) {
  return {
    name: sanitizeText(name),
    email: normalizeEmail(email),
    password: normalizePassword(password),
    confirmPassword: normalizePassword(confirmPassword),
  };
}

export const AUTH_VALIDATORS = {
  name(value) {
    const text = sanitizeText(value);
    if (!text) return 'Full name is required.';
    if (text.length < 3) return 'Name must be at least 3 characters.';
    if (text.length > 80) return 'Name is too long (max 80 characters).';
    if (!/[a-zA-Z]/.test(text)) return 'Name must contain at least one letter.';
    return null;
  },

  email(value) {
    const email = normalizeEmail(value);
    if (!email) return 'Email address is required.';
    if (!EMAIL_PATTERN.test(email)) return 'Please enter a valid email address.';
    return null;
  },

  password(value) {
    const password = normalizePassword(value);
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  },

  confirmPassword(value, original) {
    const password = normalizePassword(value);
    if (!password) return 'Please confirm your password.';
    if (password !== normalizePassword(original)) return 'Passwords do not match.';
    return null;
  },
};

export function validateSignupInput(input) {
  const sanitized = sanitizeAuthInput(input);
  const errors = {
    name: AUTH_VALIDATORS.name(sanitized.name),
    email: AUTH_VALIDATORS.email(sanitized.email),
    password: AUTH_VALIDATORS.password(sanitized.password),
    confirmPassword: AUTH_VALIDATORS.confirmPassword(
      sanitized.confirmPassword,
      sanitized.password
    ),
  };
  return { sanitized, errors, valid: Object.values(errors).every(error => !error) };
}

export function validateLoginInput(input) {
  const sanitized = sanitizeAuthInput(input);
  const errors = {
    email: AUTH_VALIDATORS.email(sanitized.email),
    password: AUTH_VALIDATORS.password(sanitized.password),
  };
  return { sanitized, errors, valid: Object.values(errors).every(error => !error) };
}
