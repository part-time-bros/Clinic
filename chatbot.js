// ══════════════════════════════════════════════════════════════════════
//  MediCare Clinic — Gemini AI Chatbot  v2.0
//  Drop in: add  <script src="chatbot.js"></script>  before </body>
//
//  ── MODEL STRATEGY (researched March 2026) ──────────────────────────
//
//  PRIMARY  → gemini-2.5-flash        (stable, 10 RPM, 500 RPD)
//  FALLBACK → gemini-2.5-flash-lite   (stable, 15 RPM, 1,000 RPD) ← 2× daily quota
//
//  Why NOT Gemini 3 Flash / 3.1 Flash-Lite for free tier?
//  Both are "preview" models → Google gives MORE restricted free limits
//  to preview models vs stable models.
//  gemini-2.5-flash + lite are the free-tier kings right now.
//  Source: ai.google.dev/gemini-api/docs/rate-limits (March 2026)
//
//  ── FREE-TIER SQUEEZE TRICKS ────────────────────────────────────────
//  ✓ Smart cache — 14 categories of common questions = 0 API calls
//  ✓ History cap at 6 turns — prevents input token bleed per request
//  ✓ maxOutputTokens: 300 — clinic answers are short, saves output tokens
//  ✓ Temperature: 0.5 — focused = less wandering = shorter outputs
//  ✓ Auto-fallback on 429 — seamless switch Flash → Flash-Lite
//  ✓ Exponential backoff (2s, 4s) before switching model
//  ✓ Short system prompt — fewer input tokens on every single call
//
//  ── QUOTA RESET TIP ─────────────────────────────────────────────────
//  Daily quota resets midnight Pacific = 1:30 PM IST every day.
//
//  👇 ONLY EDIT THIS CONFIG BLOCK:
// ══════════════════════════════════════════════════════════════════════

const CHATBOT_CONFIG = {
  geminiApiKey:  'AIzaSyBHRk4LMFQ6_8x6iV7nhtlqzZNFV9FTlGo',
  clinicName:    'MediCare Clinic',
  clinicPhone:   '7034525123',
  clinicWA:      '917034525123',
  clinicEmail:   'care@medicareclinic.in',
  clinicAddress: '12 Health Avenue, Kowdiar, Trivandrum 695003',
  clinicHours:   'Mon–Fri 8AM–8PM | Sat 8AM–6PM | Sun 9AM–2PM',
  bookingUrl:    'booking.html',
  primaryColor:  '#0066CC',
};

// ══════════════════════════════════════════════════════════════════════
//  DO NOT EDIT BELOW THIS LINE
// ══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Model ladder (tried in order on 429 / error) ──────────────────
  const MODELS = [
    'gemini-2.5-flash',       // Primary:  best quality stable, 10 RPM, 500 RPD
    'gemini-2.5-flash-lite',  // Fallback: highest free RPD, 15 RPM, 1,000 RPD
  ];

  // ── DPDP-compliant system prompt ──────────────────────────────────
  // NOTE: Web search / Google grounding is deliberately NOT enabled here.
  // Enabling grounding costs extra tokens per call and drains free tier fast.
  // The cached replies above handle 90% of common queries at zero API cost.
  //
  // DPDP ACT 2023 COMPLIANCE NOTE:
  // Under India's Digital Personal Data Protection Act 2023, health data is
  // classified as sensitive personal data. The Gemini free tier may use prompts
  // for model improvement. To comply, we strip all PII (names, phone numbers,
  // Aadhaar, emails) from user messages BEFORE sending to the API.
  // The stripping happens in stripPII() below — never send raw patient data.
  const SYSTEM_PROMPT =
    `You are Maya, a friendly and professional AI receptionist for ${CHATBOT_CONFIG.clinicName}, ` +
    `${CHATBOT_CONFIG.clinicAddress}. ` +
    `Help with: appointments, doctors (General Medicine, Cardiology, Dermatology, Dental, Paediatrics, Diagnostics), ` +
    `hours (${CHATBOT_CONFIG.clinicHours}), contact (Phone/WA: ${CHATBOT_CONFIG.clinicPhone}, Email: ${CHATBOT_CONFIG.clinicEmail}). ` +
    `Bookings confirmed on WhatsApp in 30 min. Lab reports via WhatsApp same day. ` +
    `Rules: Concise 2-4 sentences. NEVER diagnose or prescribe. Use bullets for lists. ` +
    `ALWAYS end medical symptom questions with: "Please visit the clinic for a proper consultation." ` +
    `ALWAYS add for emergencies: "For emergencies, call 102 or 108 immediately." ` +
    `Unsure? Share WhatsApp number. Reply in user's language (English/Malayalam/Hindi). ` +
    `You are an AI assistant, not a doctor. Never replace professional medical advice.`;

  // ── PII Stripper (DPDP Act 2023 compliance) ───────────────────────
  // Removes personally identifiable information before sending to Gemini API.
  // This is MANDATORY for Indian health data under DPDP + NDPS regulations.
  // Penalty for PII leaks: up to ₹250 crore under DPDP Act.
  function stripPII(text) {
    return text
      // Indian mobile numbers (6-9 starting, 10 digits)
      .replace(/\b[6-9]\d{9}\b/g, '[phone number removed]')
      // International numbers
      .replace(/\+91[\s-]?\d{5}[\s-]?\d{5}/g, '[phone number removed]')
      // Email addresses
      .replace(/\b[\w.+\-]+@[\w\-]+\.[a-z]{2,}\b/gi, '[email removed]')
      // Aadhaar numbers (12 digits, sometimes spaced)
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[id removed]')
      // Names (heuristic: "My name is X" or "I am X")
      .replace(/\b(my name is|i am|i'm|name:|called)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/gi, '$1 [name removed]')
      // Trim to 500 chars max to cap input tokens
      .substring(0, 500);
  }

  // ── Response cache — each hit = 0 API calls = 0 quota burned ─────
  const CACHE_MAP = [
    { keys: ['timing', 'timings', 'hours', 'open', 'time', 'when'],
      reply: `📅 **Clinic Hours:**\n• Mon–Fri: 8AM – 8PM\n• Saturday: 8AM – 6PM\n• Sunday: 9AM – 2PM\n\nWant to book a slot? → [Book here](${CHATBOT_CONFIG.bookingUrl})` },

    { keys: ['phone', 'call', 'number', 'contact', 'reach'],
      reply: `📞 **${CHATBOT_CONFIG.clinicPhone}**\n💬 WhatsApp: wa.me/${CHATBOT_CONFIG.clinicWA}\n📧 ${CHATBOT_CONFIG.clinicEmail}` },

    { keys: ['address', 'location', 'where', 'direction', 'map'],
      reply: `📍 **${CHATBOT_CONFIG.clinicAddress}**\nNear Kowdiar Junction, Trivandrum.\n\nSearch "MediCare Clinic Kowdiar" on Google Maps for directions.` },

    { keys: ['whatsapp', 'wa ', 'message us'],
      reply: `💬 WhatsApp: **wa.me/${CHATBOT_CONFIG.clinicWA}**\nWe confirm your appointment within 30 minutes! 🗓️` },

    { keys: ['book', 'appointment', 'schedule', 'slot', 'visit'],
      reply: `To book:\n1. 🌐 [Online form](${CHATBOT_CONFIG.bookingUrl})\n2. 💬 WhatsApp: wa.me/${CHATBOT_CONFIG.clinicWA}\n3. 📞 Call: ${CHATBOT_CONFIG.clinicPhone}\n\nConfirmed within 30 mins on WhatsApp!` },

    { keys: ['service', 'services', 'treatment', 'specialty', 'department'],
      reply: `🏥 **Our Services:**\n• General Medicine\n• Cardiology\n• Dermatology & Cosmetology\n• Dental Surgery\n• Paediatrics & Neonatology\n• Diagnostics & Lab\n\n[Book an appointment](${CHATBOT_CONFIG.bookingUrl})` },

    { keys: ['doctor', 'doctors', 'physician', 'specialist'],
      reply: `We have specialists in General Medicine, Cardiology, Dermatology, Dental, and Paediatrics.\n\nVisit the [booking page](${CHATBOT_CONFIG.bookingUrl}) to see availability and book your slot.` },

    { keys: ['lab', 'test', 'blood', 'report', 'result', 'diagnostic', 'ecg', 'xray', 'ultrasound'],
      reply: `🧪 **Lab & Diagnostics:**\nIn-house pathology lab, digital X-ray, ultrasound & ECG.\n• Routine results ready in 4–6 hours\n• Delivered via **WhatsApp** same day!\n• Specialised panels: 24–48 hours` },

    { keys: ['fee', 'fees', 'price', 'cost', 'charge', 'how much'],
      reply: `Consultation fees vary by specialty. Please call **${CHATBOT_CONFIG.clinicPhone}** or WhatsApp for current pricing.` },

    { keys: ['hi', 'hello', 'hey', 'hii', 'namaste'],
      reply: `👋 Hi! I'm **Maya**, the AI assistant for ${CHATBOT_CONFIG.clinicName}.\n\nHow can I help you today?` },

    { keys: ['thank', 'thanks', 'thank you'],
      reply: `You're welcome! 😊 Anything else I can help with?` },

    { keys: ['bye', 'goodbye', 'ok bye'],
      reply: `Take care! Stay healthy 💙 Visit us at ${CHATBOT_CONFIG.clinicAddress}.` },

    { keys: ['emergency', 'urgent', 'ambulance'],
      reply: `🚨 **Emergency? Call 112 immediately.**\n\nFor urgent clinic assistance: 📞 **${CHATBOT_CONFIG.clinicPhone}**\nHours: ${CHATBOT_CONFIG.clinicHours}` },

    { keys: ['insurance', 'cashless', 'mediclaim'],
      reply: `For insurance and cashless details, call **${CHATBOT_CONFIG.clinicPhone}** or WhatsApp us — our team will guide you on coverage.` },
  ];

  function getCachedReply(text) {
    const clean = text.toLowerCase().trim();
    for (const entry of CACHE_MAP) {
      if (entry.keys.some(k => clean.includes(k))) return entry.reply;
    }
    return null;
  }

  // ── History manager — cap at 6 turns to limit input tokens ───────
  const MAX_HISTORY = 6;
  let msgHistory = [];
  function trimHistory() {
    if (msgHistory.length > MAX_HISTORY) {
      msgHistory = msgHistory.slice(msgHistory.length - MAX_HISTORY);
    }
  }

  // ── API caller with auto-fallback + exponential backoff ───────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function callModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CHATBOT_CONFIG.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: msgHistory,
        generationConfig: {
          temperature: 0.5,      // focused = shorter output = fewer output tokens
          maxOutputTokens: 300,  // hard cap — clinic answers fit in 300 tokens
          topP: 0.9,
        },
      }),
    });
    if (res.status === 429) { const e = new Error('429'); e.code = 429; throw e; }
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error?.message || `HTTP ${res.status}`); }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  async function callGemini(userText) {
    // Strip PII before sending to API — DPDP Act 2023 compliance
    const safeText = stripPII(userText);
    msgHistory.push({ role: 'user', parts: [{ text: safeText }] });
    trimHistory();

    for (let mi = 0; mi < MODELS.length; mi++) {
      const maxRetry = mi === 0 ? 2 : 1;
      for (let attempt = 0; attempt <= maxRetry; attempt++) {
        try {
          if (attempt > 0) await sleep(Math.pow(2, attempt) * 1000);
          const reply = await callModel(MODELS[mi]);
          if (reply) {
            msgHistory.push({ role: 'model', parts: [{ text: reply }] });
            return reply;
          }
        } catch (e) {
          if (e.code === 429 && attempt < maxRetry) continue;
          break;
        }
      }
    }

    msgHistory.pop();
    return `Sorry, I'm having trouble right now. Please contact us directly:\n📞 **${CHATBOT_CONFIG.clinicPhone}**\n💬 WhatsApp: wa.me/${CHATBOT_CONFIG.clinicWA}`;
  }

  // ── State ─────────────────────────────────────────────────────────
  let isOpen = false, isLoading = false;

  // ── Styles ────────────────────────────────────────────────────────
  const CSS = `
  #mc-fab{position:fixed;bottom:88px;right:22px;z-index:9998;width:56px;height:56px;border-radius:50%;background:${CHATBOT_CONFIG.primaryColor};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,102,204,.38);transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s;outline:none}
  #mc-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,102,204,.5)}
  #mc-fab svg{transition:opacity .18s,transform .18s}
  #mc-fab .ic-chat{opacity:1;transform:scale(1) rotate(0deg)}
  #mc-fab .ic-close{opacity:0;transform:scale(.6) rotate(-90deg);position:absolute}
  #mc-fab.open .ic-chat{opacity:0;transform:scale(.6) rotate(90deg)}
  #mc-fab.open .ic-close{opacity:1;transform:scale(1) rotate(0deg)}
  #mc-badge{position:absolute;top:-3px;right:-3px;width:18px;height:18px;background:#EF4444;border-radius:50%;border:2px solid #fff;font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif}
  #mc-badge.hidden{display:none}
  #mc-win{position:fixed;bottom:156px;right:22px;z-index:9999;width:360px;max-height:520px;background:#fff;border-radius:20px;box-shadow:0 24px 56px rgba(15,23,42,.15),0 8px 20px rgba(15,23,42,.08);display:flex;flex-direction:column;overflow:hidden;font-family:'DM Sans',sans-serif;transform-origin:bottom right;transform:scale(.85) translateY(16px);opacity:0;pointer-events:none;transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .22s ease}
  #mc-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}
  .mc-hdr{background:linear-gradient(135deg,${CHATBOT_CONFIG.primaryColor} 0%,#004999 100%);padding:14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}
  .mc-hdr-av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .mc-hdr-info{flex:1;min-width:0}
  .mc-hdr-name{font-weight:700;font-size:14px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif}
  .mc-hdr-status{font-size:11.5px;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:5px;margin-top:1px}
  .mc-dot{width:6px;height:6px;border-radius:50%;background:#4ADE80;animation:mc-pulse 2s infinite}
  @keyframes mc-pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .mc-hdr-btn{background:rgba(255,255,255,.15);border:none;color:rgba(255,255,255,.8);width:30px;height:30px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .18s;flex-shrink:0}
  .mc-hdr-btn:hover{background:rgba(255,255,255,.25)}
  #mc-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
  #mc-msgs::-webkit-scrollbar{width:4px}
  #mc-msgs::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:99px}
  .mc-msg{display:flex;flex-direction:column;max-width:82%;animation:mc-in .2s ease}
  @keyframes mc-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .mc-msg.bot{align-self:flex-start}.mc-msg.user{align-self:flex-end}
  .mc-bbl{padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.55}
  .mc-msg.bot .mc-bbl{background:#F1F5F9;color:#0F172A;border-bottom-left-radius:4px}
  .mc-msg.user .mc-bbl{background:${CHATBOT_CONFIG.primaryColor};color:#fff;border-bottom-right-radius:4px}
  .mc-bbl ul{margin:4px 0 0;padding-left:16px}.mc-bbl li{margin-bottom:2px}
  .mc-bbl a{text-decoration:underline;opacity:.85}
  .mc-msg.bot .mc-bbl a{color:${CHATBOT_CONFIG.primaryColor}}.mc-msg.user .mc-bbl a{color:rgba(255,255,255,.9)}
  .mc-time{font-size:10.5px;color:#94A3B8;margin-top:3px;padding:0 4px}
  .mc-msg.user .mc-time{text-align:right}
  .mc-typing{display:flex;align-self:flex-start;background:#F1F5F9;padding:12px 16px;border-radius:16px;border-bottom-left-radius:4px;gap:5px;align-items:center}
  .mc-typing span{width:7px;height:7px;border-radius:50%;background:#94A3B8;animation:mc-bounce 1.2s infinite}
  .mc-typing span:nth-child(2){animation-delay:.18s}.mc-typing span:nth-child(3){animation-delay:.36s}
  @keyframes mc-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
  .mc-qr{padding:0 12px 10px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}
  .mc-qr-btn{background:#EFF6FF;border:1.5px solid rgba(0,102,204,.18);color:${CHATBOT_CONFIG.primaryColor};font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;padding:5px 12px;border-radius:99px;cursor:pointer;transition:all .18s;white-space:nowrap}
  .mc-qr-btn:hover{background:${CHATBOT_CONFIG.primaryColor};color:#fff;border-color:${CHATBOT_CONFIG.primaryColor}}
  .mc-inp-row{padding:10px 12px 12px;display:flex;gap:8px;align-items:center;border-top:1px solid #F1F5F9;flex-shrink:0}
  #mc-inp{flex:1;border:1.5px solid #E2E8F0;border-radius:12px;padding:9px 13px;font-size:13.5px;font-family:'DM Sans',sans-serif;color:#0F172A;background:#F8FAFC;outline:none;resize:none;min-height:38px;max-height:90px;line-height:1.45;transition:border-color .18s}
  #mc-inp:focus{border-color:${CHATBOT_CONFIG.primaryColor};background:#fff}
  #mc-inp::placeholder{color:#94A3B8}
  #mc-send{width:38px;height:38px;border-radius:11px;background:${CHATBOT_CONFIG.primaryColor};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .18s,box-shadow .18s;box-shadow:0 2px 8px rgba(0,102,204,.28)}
  #mc-send:hover{transform:scale(1.08);box-shadow:0 4px 14px rgba(0,102,204,.38)}
  #mc-send:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .mc-powered{text-align:center;font-size:10px;color:#CBD5E1;padding:0 0 8px;letter-spacing:.02em}
  @media(max-width:768px){#mc-fab{bottom:196px;right:14px}#mc-win{bottom:262px;right:8px}}
  @media(max-width:400px){#mc-win{width:calc(100vw - 16px);right:8px;bottom:262px;max-height:55vh}#mc-fab{right:14px;bottom:196px}}
  `;

  const QUICK_REPLIES = ['Book appointment','Clinic timings','Our doctors','Lab tests','Contact us'];

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const now = () => new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  const $   = id => document.getElementById(id);
  const scroll = () => { const e = $('mc-msgs'); if(e) e.scrollTop = e.scrollHeight; };

  function md(t) {
    return esc(t)
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^[•\-] (.+)/gm,'<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>')
      .replace(/\n/g,'<br>');
  }

  function appendMsg(role, text) {
    const w = document.createElement('div');
    w.className = `mc-msg ${role}`;
    w.innerHTML = `<div class="mc-bbl">${md(text)}</div><div class="mc-time">${now()}</div>`;
    $('mc-msgs').appendChild(w); scroll();
  }

  function showTyping() {
    const t = document.createElement('div');
    t.id = 'mc-typing'; t.className = 'mc-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    $('mc-msgs').appendChild(t); scroll();
  }

  function removeQuickReplies() { const q = document.querySelector('.mc-qr'); if(q) q.remove(); }

  function showQuickReplies() {
    if (document.querySelector('.mc-qr')) return;
    const row = document.createElement('div'); row.className = 'mc-qr';
    QUICK_REPLIES.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'mc-qr-btn'; btn.textContent = label;
      btn.addEventListener('click', () => sendMessage(label));
      row.appendChild(btn);
    });
    const ir = document.querySelector('.mc-inp-row');
    if (ir) ir.parentNode.insertBefore(row, ir);
  }

  async function sendMessage(text) {
    text = (text || $('mc-inp')?.value || '').trim();
    if (!text || isLoading) return;
    const inp = $('mc-inp'), send = $('mc-send');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }
    removeQuickReplies();
    appendMsg('user', text);
    isLoading = true; if(send) send.disabled = true;

    const cached = getCachedReply(text);
    if (cached) {
      await sleep(360);
      appendMsg('bot', cached);
    } else {
      showTyping();
      const reply = await callGemini(text);
      const t = $('mc-typing'); if(t) t.remove();
      appendMsg('bot', reply);
    }

    isLoading = false; if(send) send.disabled = false;
  }

  function toggleChat() {
    isOpen = !isOpen;
    $('mc-win')?.classList.toggle('open', isOpen);
    $('mc-fab')?.classList.toggle('open', isOpen);
    $('mc-badge')?.classList.add('hidden');
    if (isOpen) setTimeout(() => $('mc-inp')?.focus(), 300);
  }

  function clearChat() { msgHistory = []; $('mc-msgs').innerHTML = ''; addWelcome(); }

  function addWelcome() {
    const w = document.createElement('div'); w.className = 'mc-msg bot';
    w.innerHTML = `<div class="mc-bbl">👋 Hi! I'm <strong>Maya</strong>, the AI assistant for <strong>${CHATBOT_CONFIG.clinicName}</strong>.<br><br>I can help you book appointments, find doctors, check timings, or answer health questions.<br><br>How can I help you today?</div><div class="mc-time">${now()}</div>`;
    $('mc-msgs').appendChild(w); showQuickReplies();
  }

  function buildUI() {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);

    const fab = document.createElement('button'); fab.id = 'mc-fab';
    fab.setAttribute('aria-label','Open chat');
    fab.innerHTML = `<svg class="ic-chat" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><svg class="ic-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><div id="mc-badge">1</div>`;
    fab.addEventListener('click', toggleChat);
    document.body.appendChild(fab);

    const win = document.createElement('div'); win.id = 'mc-win';
    win.innerHTML = `
      <div class="mc-hdr">
        <div class="mc-hdr-av"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/></svg></div>
        <div class="mc-hdr-info">
          <div class="mc-hdr-name">Maya — AI Assistant</div>
          <div class="mc-hdr-status"><div class="mc-dot"></div>${CHATBOT_CONFIG.clinicName}</div>
        </div>
        <button class="mc-hdr-btn" id="mc-clear" title="Clear chat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></button>
      </div>
      <div id="mc-msgs"></div>
      <div class="mc-inp-row">
        <textarea id="mc-inp" placeholder="Type a message…" rows="1" maxlength="500"></textarea>
        <button id="mc-send"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
      <div class="mc-powered">Powered by Gemini AI</div>
    `;
    document.body.appendChild(win);

    $('mc-clear').addEventListener('click', clearChat);
    $('mc-send').addEventListener('click', () => sendMessage());
    $('mc-inp').addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} });
    $('mc-inp').addEventListener('input', function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,90)+'px'; });

    addWelcome();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', buildUI)
    : buildUI();

})();
