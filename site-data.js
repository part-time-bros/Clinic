// MediCare Clinic — Site Data
// Fetches clinic settings and doctors from Firestore, updates all pages dynamically.

import { getClinicSettings, getDoctorsList, getAvailability, getHeroContent, getTestimonials, getServices } from './firebase-config.js';

function fmtPhone(digits) {
  const d = String(digits).replace(/\D/g, '').replace(/^91/, '');
  return `+91 ${d.slice(0,5)} ${d.slice(5)}`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Sanitize fetched settings — replace any empty/missing field with a default ──
function sanitizeSettings(s) {
  const DEFAULTS = {
    email:        'care@medicareclinic.in',
    phone:        '7034525123',
    whatsapp:     '917034525123',
    addressLine1: '12 Health Avenue, Kowdiar',
    addressLine2: 'Trivandrum 695003, Kerala',
    addressFull:  '12 Health Avenue, Kowdiar, Trivandrum 695003',
    addressNote:  'Near Kowdiar Junction',
    hoursWeekday: 'Mon-Fri: 8AM-8PM',
    hoursSat:     'Sat: 8AM-6PM',
    hoursSun:     'Sun: 9AM-2PM',
    hoursFooter:  'Mon-Sat: 8AM-8PM, Sun: 9AM-2PM',
    hoursCall:    'Mon-Sat, 8AM-8PM',
  };
  const clean = { ...s };
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    if (!clean[key] || String(clean[key]).trim() === '') {
      clean[key] = fallback;
    }
  }
  return clean;
}

// ── Apply clinic settings to data-site elements ───────────────

function applySettings(s) {
  s = sanitizeSettings(s);
  const displayPhone = fmtPhone(s.phone);
  const waNum        = s.whatsapp || `91${s.phone}`;

  document.querySelectorAll('[data-site]').forEach(el => {
    const key = el.dataset.site;
    switch (key) {
      case 'phone-text':      el.textContent = displayPhone; break;
      case 'phone-link':      el.href = `tel:+91${s.phone.replace(/\D/g,'')}`; break;
      case 'phone-nav':
        el.href = `tel:+91${s.phone.replace(/\D/g,'')}`;
        el.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ` ${displayPhone}\n      `; });
        break;
      case 'wa-link':         el.href = `https://wa.me/${waNum}`; break;
      case 'wa-text':         el.textContent = displayPhone; break;
      case 'email-text':      el.textContent = s.email; break;
      case 'email-link':      el.href = `mailto:${s.email}`; el.textContent = s.email; break;
      case 'email-link-href': el.href = `mailto:${s.email}`; break;
      case 'address-full':    el.textContent = s.addressFull; break;
      case 'address-line1':   el.textContent = s.addressLine1; break;
      case 'address-line2':   el.textContent = s.addressLine2; break;
      case 'address-note':    el.textContent = s.addressNote; break;
      case 'hours-footer':    el.textContent = s.hoursFooter; break;
      case 'hours-call':      el.textContent = s.hoursCall; break;
      case 'hours-weekday':   el.textContent = s.hoursWeekday; break;
      case 'hours-sat':       el.textContent = s.hoursSat; break;
      case 'hours-sun':       el.textContent = s.hoursSun; break;
      case 'map-frame':       el.src = s.mapEmbed; break;
    }
  });
}

// ── Generate full doctor card HTML ────────────────────────────

function clockSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}

function buildCard(doc, delay) {
  const tags = doc.tags
    ? `${doc.years} years,${doc.tags}`.split(',')
        .map((t, i) => i === 0
          ? `<span class="doc-tag">${clockSvg()} ${esc(t.trim())}</span>`
          : `<span class="doc-tag">${esc(t.trim())}</span>`)
        .join('')
    : `<span class="doc-tag">${clockSvg()} ${doc.years} years</span>`;

  const lastName = (doc.name || '').split(' ').pop();

  return `
    <div class="doc-full-card reveal rv-d${delay}" data-doctor-id="${doc.id}">
      <div class="doc-full-av" style="background:linear-gradient(135deg,${esc(doc.color)})" data-doc="av">${esc(doc.initials)}</div>
      <div class="doc-full-name" data-doc="name">${esc(doc.name)}</div>
      <div class="doc-full-spec" data-doc="spec">${esc(doc.specialty)}</div>
      <div class="doc-full-quals" data-doc="quals">${esc(doc.quals)}</div>
      <p class="doc-full-bio" data-doc="bio">${esc(doc.bio)}</p>
      <div class="doc-tags" data-doc="tags">${tags}</div>
      <div style="margin-top:18px;">
        <a href="booking.html" class="btn btn-primary btn-sm btn-full" data-doc="btn">Book with Dr. ${esc(lastName)}</a>
      </div>
    </div>`;
}

// Groups doctors by specialty category for section rendering
const SPECIALTY_GROUPS = [
  { label: 'General Medicine',                 heading: 'Primary care',   hi: 'physicians',   alt: false },
  { label: 'Cardiology',                       heading: 'Heart',          hi: 'specialists',  alt: true  },
  { label: 'Dermatology and Cosmetology',      heading: 'Skin',           hi: 'specialists',  alt: false },
  { label: 'Dental Surgery',                   heading: 'Dental',         hi: 'care',         alt: false },
  { label: 'Paediatrics and Neonatology',      heading: 'Paediatric',     hi: 'care',         alt: false },
  { label: 'Diagnostics',                      heading: 'Diagnostics',    hi: '& lab',        alt: true  },
  { label: 'Interventional Cardiology',        heading: 'Heart',          hi: 'specialists',  alt: true  },
];

function getGroup(specialty) {
  if (!specialty) return { label: '', heading: '', hi: '', alt: false };
  const lower = specialty.toLowerCase();
  // Exact match first — prevents 'Interventional Cardiology' matching 'Cardiology' group
  const exact = SPECIALTY_GROUPS.find(g => g.label.toLowerCase() === lower);
  if (exact) return exact;
  // Partial fallback — match if specialty contains the group label
  const partial = SPECIALTY_GROUPS.find(g => lower.includes(g.label.toLowerCase()));
  return partial || { label: specialty, heading: specialty, hi: '', alt: false };
}

function renderDoctorsPage(doctors) {
  const container = document.getElementById('doctorsContainer');
  if (!container) return;

  const active = doctors.filter(d => d.active !== false);
  if (!active.length) {
    container.innerHTML = '<section><div class="container"><p style="text-align:center;padding:48px;color:#94A3B8">No doctors listed.</p></div></section>';
    return;
  }

  // Group by specialty
  const grouped = {};
  active.forEach(d => {
    const key = d.specialty || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  let html = '';
  let sectionIdx = 0;
  for (const [specialty, docs] of Object.entries(grouped)) {
    const g   = getGroup(specialty);
    const alt = sectionIdx % 2 === 1 ? ' class="section-alt"' : '';
    html += `
<section${alt}>
  <div class="container">
    <div class="section-header center reveal">
      <div class="section-label center">${esc(specialty)}</div>
      <h2 class="section-title">${esc(g.heading)} <span class="hi">${esc(g.hi)}</span></h2>
    </div>
    <div class="doctors-full">
      ${docs.map((d, i) => buildCard(d, (i % 3) + 1)).join('')}
    </div>
  </div>
</section>`;
    sectionIdx++;
  }

  container.innerHTML = html;

  // Re-trigger IntersectionObserver reveals if script.js set them up
  if (typeof window.__acReveal === 'function') {
    window.__acReveal();
  } else {
    // Fallback: just make them all visible
    container.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }
}

// ── Skeleton loaders ─────────────────────────────────────────

function showDocSkeletons(container, count = 3) {
  if (!container) return;
  container.innerHTML = Array(count).fill(0).map(() => `
    <div class="doc-skeleton">
      <div class="skeleton doc-skeleton-av"></div>
      <div class="skeleton doc-skeleton-name"></div>
      <div class="skeleton doc-skeleton-spec"></div>
      <div class="skeleton doc-skeleton-qual"></div>
      <div class="skeleton doc-skeleton-bio"></div>
    </div>`).join('');
}

function showInfoSkeletons() {
  // Replace data-site text elements with skeleton bars while loading
  document.querySelectorAll('[data-site]').forEach(el => {
    const key = el.dataset.site;
    if (['phone-text','email-text','address-full','address-line1','address-line2','hours-footer','hours-call'].includes(key)) {
      const w = key.includes('address') ? 180 : key.includes('hours') ? 140 : 110;
      el.innerHTML = `<span class="skeleton info-skeleton" style="width:${w}px"></span>`;
    }
  });
}

// ── Bootstrap ─────────────────────────────────────────────────

// Show skeletons immediately before Firestore responds
showInfoSkeletons();
showDocSkeletons(document.getElementById('homeDocGrid'), 3);

// ── Error boundary + 8-second timeout ────────────────────────
// If Firestore never responds (offline / rules block / cold start),
// clear all skeletons and render defaults so the page is never
// stuck showing empty shimmer bars.

function clearSkeletons() {
  // Restore data-site text elements to their default values
  document.querySelectorAll('[data-site]').forEach(el => {
    const skel = el.querySelector('.skeleton.info-skeleton');
    if (skel) el.innerHTML = el.dataset.default || '';
  });
  // Clear doctor skeleton grid if still showing placeholder cards
  const homeDocGrid = document.getElementById('homeDocGrid');
  if (homeDocGrid && homeDocGrid.querySelector('.doc-skeleton')) {
    homeDocGrid.innerHTML = '<p style="text-align:center;color:#94A3B8;padding:48px 0">Unable to load doctors. Please refresh.</p>';
  }
}

const LOAD_TIMEOUT = 8_000; // 8 s
const timeoutId = setTimeout(() => {
  console.warn('[site-data] Firestore fetch timed out — rendering defaults');
  clearSkeletons();
}, LOAD_TIMEOUT);

Promise.all([
  getClinicSettings(), getDoctorsList(), getAvailability(),
  getHeroContent(), getTestimonials(), getServices()
]).then(([settings, doctors, availability, hero, testimonials, services]) => {
  clearTimeout(timeoutId);
  // Expose live settings globally so booking.html and chatbot.js can read them
  window.__acSettings = settings;
  // Update chatbot with live Firestore values (phone, WA, email, address, hours)
  if (typeof window.__mcUpdateConfig === 'function') window.__mcUpdateConfig(settings);
  applySettings(settings);
  applyDemoBanner(settings);
  applyHeroContent(hero);
  renderDoctorsPage(doctors);
  renderHomeDocGrid(doctors);
  renderServicesGrid(services);
  renderTestimonials(testimonials);
  populateDoctorSelect(doctors, availability);
}).catch(err => {
  clearTimeout(timeoutId);
  console.error('[site-data] Firestore fetch failed:', err);
  clearSkeletons();
});


// ── Demo banner toggle ────────────────────────────────────────
// When showDemoBanner is false (set via admin → Clinic Settings),
// the banner is hidden and the CSS offset variable is zeroed out
// so footer, wa-float and mob-cta all snap back to their normal positions.

function applyDemoBanner(s) {
  if (s.showDemoBanner === false) {
    const banner = document.getElementById('demoBanner');
    if (banner) banner.style.display = 'none';
    // Zero out the CSS offset so nothing shifts up unexpectedly
    document.documentElement.style.setProperty('--demo-bar-h', '0px');
  }
}

// ── Hero content ──────────────────────────────────────────────

function applyHeroContent(h) {
  const titleEl = document.getElementById('heroTitle');
  const subEl   = document.getElementById('heroSubtitle');
  if (titleEl) titleEl.innerHTML = esc(h.title).replace(/,/g, ',<br>');
  if (subEl)   subEl.textContent = h.subtitle;

  // Stats — update data-count so count-up script picks it up
  const pairs = [
    ['stat1Num', h.stat1_num, 'stat1Lbl', h.stat1_lbl],
    ['stat2Num', h.stat2_num, 'stat2Lbl', h.stat2_lbl],
    ['stat3Num', h.stat3_num, 'stat3Lbl', h.stat3_lbl],
    ['stat4Num', h.stat4_num, 'stat4Lbl', h.stat4_lbl],
  ];
  pairs.forEach(([numId, num, lblId, lbl]) => {
    const numEl = document.getElementById(numId);
    const lblEl = document.getElementById(lblId);
    if (numEl) {
      const isNumeric = /^\d+$/.test(String(num));
      if (isNumeric) {
        numEl.dataset.count = num;
        numEl.textContent   = '0';
        // Re-trigger count-up if element already passed the observer threshold
        if (numEl.classList.contains('visible') || numEl.closest('.visible') ||
            numEl.getBoundingClientRect().top < window.innerHeight) {
          if (typeof window.__acCountUp === 'function') window.__acCountUp(numEl);
        }
      } else {
        numEl.textContent = num;
        delete numEl.dataset.count;
      }
    }
    if (lblEl) lblEl.textContent = lbl;
  });
}

// ── Services grid ─────────────────────────────────────────────

// SVG icons keyed by lowercase service title word
const SVC_ICONS = {
  general:    '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6v-4"/>',
  cardiology: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  dermatology:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3 5 5M17.7 6.3 19 5M17.7 17.7 19 19M6.3 17.7 5 19"/>',
  dental:     '<path d="M12 5.5c-1.5-2-3.5-3-5-2-2 1.5-2 5 0 7l5 8 5-8c2-2 2-5.5 0-7-1.5-1-3.5 0-5 2z"/>',
  paediatrics:'<circle cx="12" cy="8" r="4"/><path d="M9 13c-2.5.5-5 2-5 4v1h16v-1c0-2-2.5-3.5-5-4"/>',
  diagnostics:'<path d="M9 3h6v8l3 9H6l3-9z"/><path d="M9 11h6"/>',
};

function getSvcIcon(title) {
  const key = Object.keys(SVC_ICONS).find(k => title.toLowerCase().includes(k));
  const path = key ? SVC_ICONS[key] : SVC_ICONS.general;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${path}</svg>`;
}

function renderServicesGrid(services) {
  const grid = document.getElementById('servicesGrid');
  if (!grid || !services?.length) return;
  const delays = ['rv-d1','rv-d2','rv-d3'];
  grid.innerHTML = services.map((s, i) => `
    <div class="card service-card reveal ${delays[i % 3]}">
      <div class="svc-icon">${getSvcIcon(s.title)}</div>
      <div class="svc-title">${esc(s.title)}</div>
      <p class="svc-desc">${esc(s.desc)}</p>
      <a href="services.html" class="svc-link">Learn more <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></a>
    </div>`).join('');
  if (typeof window.__acReveal === 'function') window.__acReveal();
  else grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

// ── Testimonials ──────────────────────────────────────────────

function starsSvg(n) {
  const star = '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" stroke="none"/></svg>';
  return Array(Math.min(5, Math.max(1, n || 5))).fill(star).join('');
}

function renderTestimonials(testimonials) {
  const grid = document.getElementById('testiGrid');
  if (!grid || !testimonials?.length) return;
  const delays = ['rv-d1','rv-d2','rv-d3'];
  grid.innerHTML = testimonials.map((t, i) => `
    <div class="card testi-card reveal ${delays[i % 3]}">
      <div class="testi-stars">${starsSvg(t.stars)}</div>
      <p class="testi-text">${esc(t.text)}</p>
      <div class="testi-author">
        <div class="testi-av" style="background:linear-gradient(135deg,${esc(t.color)})">${esc(t.initials)}</div>
        <div><div class="testi-name">${esc(t.name)}</div><div class="testi-note">${esc(t.note)}</div></div>
      </div>
    </div>`).join('');
  if (typeof window.__acReveal === 'function') window.__acReveal();
  else grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

// ── Homepage doctor preview grid (shows first 3 active doctors) ──

function renderHomeDocGrid(doctors) {
  const grid = document.getElementById('homeDocGrid');
  if (!grid) return;

  const active = doctors.filter(d => d.active !== false).slice(0, 3);
  const expSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  grid.innerHTML = active.map((d, i) => `
    <div class="card doctor-card reveal rv-d${i + 1}">
      <div class="doc-av" style="background:linear-gradient(135deg,${esc(d.color)})">${esc(d.initials)}</div>
      <div class="doc-name">${esc(d.name)}</div>
      <div class="doc-spec">${esc(d.specialty)}</div>
      <div class="doc-quals">${esc(d.quals)}</div>
      <div class="doc-exp">${expSvg} ${d.years} years experience</div>
    </div>`).join('');

  if (typeof window.__acReveal === 'function') window.__acReveal();
  else grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

// ── Booking page doctor dropdown + availability enforcement ──────

function populateDoctorSelect(doctors, availability) {
  const sel     = document.getElementById('bkDoctorSelect');
  const dateIn  = document.getElementById('bkDate');
  if (!sel || !dateIn) return;

  const active = doctors.filter(d => d.active !== false);
  active.forEach(d => {
    const opt   = document.createElement('option');
    opt.value   = d.name;
    opt.textContent = d.name;
    // Store doctor id for availability lookup
    opt.dataset.docId = d.id;
    sel.appendChild(opt);
  });

  // Set global min date to today
  const today = new Date().toISOString().slice(0, 10);
  dateIn.min  = today;

  function applyAvailability() {
    const selectedOpt = sel.options[sel.selectedIndex];
    const docId       = selectedOpt ? parseInt(selectedOpt.dataset.docId, 10) : null;
    const avail       = (docId && availability[docId]) || { offDays: [], blockedDates: [] };
    const offDays     = avail.offDays     || [];
    const blocked     = avail.blockedDates || [];

    // Clear previous invalid state
    dateIn.style.borderColor = '';
    dateIn.style.boxShadow   = '';
    const existing = dateIn.parentElement.querySelector('.avail-hint');
    if (existing) existing.remove();

    // If no specific doctor selected, just reset to today min
    if (!docId) {
      dateIn.min = today;
      dateIn.removeAttribute('data-blocked');
      dateIn.removeAttribute('data-offdays');
      return;
    }

    // Store on the input for validation in submit handler
    dateIn.dataset.blocked = JSON.stringify(blocked);
    dateIn.dataset.offdays = JSON.stringify(offDays);

    // Build a hint string
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const offNames = offDays.map(d => dayNames[d]);
    const parts    = [];
    if (offNames.length) parts.push(`Not available on ${offNames.join(', ')}`);
    if (blocked.length)  parts.push(`${blocked.length} date(s) blocked`);

    if (parts.length) {
      const hint = document.createElement('div');
      hint.className = 'avail-hint';
      hint.style.cssText = 'font-size:12px;color:#D97706;margin-top:5px;display:flex;align-items:center;gap:4px';
      hint.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${parts.join(' · ')}`;
      dateIn.parentElement.appendChild(hint);
    }

    // Validate current date selection immediately
    if (dateIn.value) validateDateAvailability(dateIn, offDays, blocked);
  }

  sel.addEventListener('change', applyAvailability);

  // Validate on date change
  dateIn.addEventListener('change', () => {
    const offDays = JSON.parse(dateIn.dataset.offdays || '[]');
    const blocked = JSON.parse(dateIn.dataset.blocked || '[]');
    validateDateAvailability(dateIn, offDays, blocked);
  });

  // Initial apply if a doctor is pre-selected
  applyAvailability();
}

function validateDateAvailability(dateIn, offDays, blocked) {
  if (!dateIn.value) return true;
  const chosen  = new Date(dateIn.value + 'T00:00:00');
  const dayOfWk = chosen.getDay();
  let errMsg    = null;

  if (offDays.includes(dayOfWk)) {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    errMsg = `${dayNames[dayOfWk]} is not available for this doctor.`;
  } else if (blocked.includes(dateIn.value)) {
    errMsg = 'This date is not available for this doctor. Please choose another.';
  }

  if (errMsg) {
    dateIn.style.borderColor = '#DC2626';
    dateIn.style.boxShadow   = '0 0 0 3px rgba(220,38,38,0.1)';
    let tip = dateIn.parentElement.querySelector('.field-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'field-tip';
      tip.style.cssText = 'font-size:12px;color:#DC2626;margin-top:4px;';
      dateIn.parentElement.appendChild(tip);
    }
    tip.textContent = errMsg;
    return false;
  } else {
    dateIn.style.borderColor = '#059669';
    dateIn.style.boxShadow   = '0 0 0 3px rgba(5,150,105,0.08)';
    const tip = dateIn.parentElement.querySelector('.field-tip');
    if (tip) tip.remove();
    return true;
  }
}


