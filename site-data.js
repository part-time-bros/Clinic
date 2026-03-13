// AuraClinic — Site Data
// Fetches clinic settings and doctors from Firestore, updates all pages dynamically.
// Included on every public page via <script type="module" src="./site-data.js">

import { getClinicSettings, getDoctorsList } from './firebase-config.js';

function fmtPhone(digits) {
  // "9876543210" -> "+91 98765 43210"
  const d = digits.replace(/\D/g, '').replace(/^91/, '');
  return `+91 ${d.slice(0,5)} ${d.slice(5)}`;
}

function applySettings(s) {
  const displayPhone = fmtPhone(s.phone);
  const waNum        = s.whatsapp || `91${s.phone}`;

  document.querySelectorAll('[data-site]').forEach(el => {
    const key = el.dataset.site;
    switch (key) {
      case 'phone-text':
        el.textContent = displayPhone;
        break;
      case 'phone-link':
        el.href = `tel:+${s.phone.replace(/\D/g,'').startsWith('91') ? '' : '91'}${s.phone.replace(/\D/g,'')}`;
        break;
      case 'phone-nav':
        el.href = `tel:+91${s.phone.replace(/\D/g,'')}`;
        // Update text node (after the SVG)
        el.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ` ${displayPhone}\n      `; });
        break;
      case 'wa-link':
        el.href = `https://wa.me/${waNum}`;
        break;
      case 'wa-text':
        el.textContent = displayPhone;
        break;
      case 'email-text':
        el.textContent = s.email;
        break;
      case 'email-link':
        el.href = `mailto:${s.email}`;
        el.textContent = s.email;
        break;
      case 'email-link-href':
        el.href = `mailto:${s.email}`;
        break;
      case 'address-full':
        el.textContent = s.addressFull;
        break;
      case 'address-line1':
        el.textContent = s.addressLine1;
        break;
      case 'address-line2':
        el.textContent = s.addressLine2;
        break;
      case 'address-note':
        el.textContent = s.addressNote;
        break;
      case 'hours-footer':
        el.textContent = s.hoursFooter;
        break;
      case 'hours-call':
        el.textContent = s.hoursCall;
        break;
      case 'hours-weekday':
        el.textContent = s.hoursWeekday;
        break;
      case 'hours-sat':
        el.textContent = s.hoursSat;
        break;
      case 'hours-sun':
        el.textContent = s.hoursSun;
        break;
      case 'map-frame':
        el.src = s.mapEmbed;
        break;
    }
  });
}

function clockSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}

function tagHtml(tagStr) {
  return tagStr.split(',').map((t, i) =>
    i === 0
      ? `<span class="doc-tag">${clockSvg()} ${t.trim()}</span>`
      : `<span class="doc-tag">${t.trim()}</span>`
  ).join('');
}

function applyDoctors(doctors) {
  const cards = document.querySelectorAll('[data-doctor-id]');
  cards.forEach(card => {
    const id  = parseInt(card.dataset.doctorId, 10);
    const doc = doctors.find(d => d.id === id);
    if (!doc) return;

    const nameEl  = card.querySelector('[data-doc="name"]');
    const specEl  = card.querySelector('[data-doc="spec"]');
    const qualsEl = card.querySelector('[data-doc="quals"]');
    const bioEl   = card.querySelector('[data-doc="bio"]');
    const tagsEl  = card.querySelector('[data-doc="tags"]');
    const avEl    = card.querySelector('[data-doc="av"]');
    const btnEl   = card.querySelector('[data-doc="btn"]');

    if (nameEl)  nameEl.textContent  = doc.name;
    if (specEl)  specEl.textContent  = doc.specialty;
    if (qualsEl) qualsEl.textContent = doc.quals;
    if (bioEl)   bioEl.textContent   = doc.bio;
    if (tagsEl)  tagsEl.innerHTML    = tagHtml(`${doc.years} years,${doc.tags}`);
    if (avEl)    avEl.style.background = `linear-gradient(135deg,${doc.color})`;
    if (avEl)    avEl.textContent    = doc.initials;
    if (btnEl)   btnEl.textContent   = `Book with ${doc.name.split(' ').slice(-1)[0]}`;
  });
}

// Fetch both in parallel
Promise.all([getClinicSettings(), getDoctorsList()])
  .then(([settings, doctors]) => {
    applySettings(settings);
    if (doctors.length) applyDoctors(doctors);
  })
  .catch(console.error);
