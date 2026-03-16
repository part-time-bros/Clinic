/**
 * MediCare Clinic — Shared Form Validation Module
 * Centralises all field rules, UI feedback, and rate-limiting logic
 * so index.html and booking.html never diverge again.
 *
 * Usage (ES module):
 *   import { RULES, fieldError, fieldOk, fieldReset,
 *            isRateLimited, incrementRate } from './validate.js';
 */

'use strict';

// ── Field UI helpers ─────────────────────────────────────────────────────────

export function fieldError(input, msg) {
  input.style.borderColor = '#DC2626';
  input.style.boxShadow   = '0 0 0 3px rgba(220,38,38,0.1)';
  let tip = input.parentElement.querySelector('.field-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'field-tip';
    tip.style.cssText = 'font-size:12px;color:#DC2626;margin-top:4px;';
    input.parentElement.appendChild(tip);
  }
  tip.textContent = msg;
}

export function fieldOk(input) {
  input.style.borderColor = '#059669';
  input.style.boxShadow   = '0 0 0 3px rgba(5,150,105,0.08)';
  const tip = input.parentElement.querySelector('.field-tip');
  if (tip) tip.remove();
}

export function fieldReset(input) {
  input.style.borderColor = '';
  input.style.boxShadow   = '';
  const tip = input.parentElement.querySelector('.field-tip');
  if (tip) tip.remove();
}

// ── Validation rules ─────────────────────────────────────────────────────────
//
// Each rule returns null on pass, or an error string on fail.
// The date() rule accepts optional availability data so booking.html
// can pass doctor off-days/blocked-dates without duplicating the logic.

export const RULES = {
  name(v) {
    if (!v)                         return 'Full name is required.';
    if (v.length < 3)               return 'Name must be at least 3 characters.';
    if (v.length > 80)              return 'Name is too long.';
    if (/[0-9]/.test(v))            return 'Name cannot contain numbers.';
    if (/[^a-zA-Z\s.\-']/.test(v))  return 'Name contains invalid characters.';
    return null;
  },

  phone(v) {
    const digits = v.replace(/[\s\-+]/g, '');
    if (!digits)                      return 'Phone number is required.';
    if (!/^\d+$/.test(digits))        return 'Phone number must contain digits only.';
    // Accept 10 digits, or 91 + 10 digits
    if (digits.length === 12 && digits.startsWith('91')) return null;
    if (digits.length !== 10)         return 'Enter a valid 10-digit Indian mobile number.';
    if (!/^[6-9]/.test(digits))       return 'Mobile number must start with 6, 7, 8, or 9.';
    return null;
  },

  /**
   * Email is optional — returns null on empty string.
   * Pass forceRequired = true when the field must not be blank.
   */
  email(v, { forceRequired = false } = {}) {
    v = (v || '').trim();
    if (!v) return forceRequired ? 'Email address is required.' : null;
    if (v.length > 254)         return 'Email too long (max 254 characters).';
    const local = v.split('@')[0] || '';
    if (local.length > 64)      return 'Email username part too long (max 64 chars).';
    if (v.includes('..'))       return 'Email cannot contain consecutive dots.';
    const re = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
    if (!re.test(v))            return 'Enter a valid email address (e.g. name@example.com).';
    const blocked = [
      'test@test.com', 'test@gmail.com', 'abc@abc.com',
      'aaa@aaa.com',   'example@example.com', 'admin@admin.com',
    ];
    if (blocked.includes(v.toLowerCase())) return 'Please enter your actual email address.';
    return null;
  },

  specialty(v) {
    return v ? null : 'Please select a specialty.';
  },

  /**
   * Date rule.
   * @param {string} v          - ISO date string (YYYY-MM-DD)
   * @param {object} avail      - Optional doctor availability
   *   @param {number[]} avail.offDays      - Day-of-week indices that are blocked (0=Sun)
   *   @param {string[]} avail.blockedDates - Specific dates blocked (YYYY-MM-DD)
   */
  date(v, { offDays = [], blockedDates = [] } = {}) {
    if (!v) return 'Please select a preferred date.';
    const chosen  = new Date(v + 'T00:00:00');
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 3);
    if (chosen < today)    return 'Please select a future date.';
    if (chosen > maxDate)  return 'Appointments can only be booked up to 3 months ahead.';
    if (offDays.length) {
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const dayOfWk  = chosen.getDay();
      if (offDays.includes(dayOfWk)) return `${dayNames[dayOfWk]} is not available for this doctor.`;
    }
    if (blockedDates.length && blockedDates.includes(v)) {
      return 'This date is not available for this doctor. Please choose another.';
    }
    return null;
  },
};

// ── Blur / input listener helper ─────────────────────────────────────────────
//
// Attach live validation to a single input.
// ruleFn: function(value) → null | errorString
//
export function attachBlur(input, ruleFn) {
  input.addEventListener('blur', () => {
    const v   = input.value.trim();
    const err = ruleFn(v);
    if (v) err ? fieldError(input, err) : fieldOk(input);
  });
  input.addEventListener('input', () => {
    // Only re-validate once the field has already been touched
    if (input.style.borderColor) {
      const err = ruleFn(input.value.trim());
      err ? fieldError(input, err) : fieldOk(input);
    }
  });
}

// ── Client-side rate limiter ─────────────────────────────────────────────────
// Limits to MAX_SUBMISSIONS per 24-hour rolling window, stored in localStorage.

const HP_KEY        = 'ac_bk_submissions';
const MAX_SUBS      = 2;
const WINDOW_MS     = 24 * 60 * 60 * 1000;

function getRateData() {
  try {
    return JSON.parse(localStorage.getItem(HP_KEY))
      || { count: 0, resetAt: Date.now() + WINDOW_MS };
  } catch {
    return { count: 0, resetAt: Date.now() + WINDOW_MS };
  }
}

export function isRateLimited() {
  const d = getRateData();
  if (Date.now() > d.resetAt) {
    localStorage.setItem(HP_KEY, JSON.stringify({ count: 0, resetAt: Date.now() + WINDOW_MS }));
    return false;
  }
  return d.count >= MAX_SUBS;
}

export function incrementRate() {
  const d = getRateData();
  d.count++;
  localStorage.setItem(HP_KEY, JSON.stringify(d));
}
