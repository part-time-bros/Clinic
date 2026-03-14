// AuraClinic — Site Data
// Fetches clinic settings and doctors from Firestore, updates all pages dynamically.

import { getClinicSettings, getDoctorsList } from './firebase-config.js';

function fmtPhone(digits) {
  const d = String(digits).replace(/\D/g, '').replace(/^91/, '');
  return `+91 ${d.slice(0,5)} ${d.slice(5)}`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Apply clinic settings to data-site elements ───────────────

function applySettings(s) {
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
  return SPECIALTY_GROUPS.find(g =>
    specialty?.toLowerCase().includes(g.label.toLowerCase().split(' ')[0])
  ) || { label: specialty, heading: specialty, hi: '', alt: false };
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

// ── Bootstrap ─────────────────────────────────────────────────

Promise.all([getClinicSettings(), getDoctorsList()])
  .then(([settings, doctors]) => {
    applySettings(settings);
    renderDoctorsPage(doctors);
    renderHomeDocGrid(doctors);
    populateDoctorSelect(doctors);
  })
  .catch(console.error);

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

// ── Booking page doctor dropdown ──────────────────────────────

function populateDoctorSelect(doctors) {
  const sel = document.getElementById('bkDoctorSelect');
  if (!sel) return;
  const active = doctors.filter(d => d.active !== false);
  active.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}


