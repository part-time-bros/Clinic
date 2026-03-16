// ══════════════════════════════════════════════════════════════════════
//  MediCare Clinic — Maya AI Chatbot  v3.0
//  Drop in: add  <script src="chatbot.js"></script>  before </body>
//
//  MODEL STRATEGY (March 2026)
//  PRIMARY  → gemini-2.5-flash       (stable, 10 RPM / 500 RPD free)
//  FALLBACK → gemini-2.5-flash-lite  (stable, 15 RPM / 1,000 RPD free)
//
//  FREE-TIER OPTIMISATIONS
//  ✓ Precision cache — only fires on SHORT, clearly categorical messages.
//    NOT on mid-sentence keyword matches that kill real conversations.
//  ✓ History cap at 8 turns — prevents input token bleed
//  ✓ maxOutputTokens: 500 — enough room for complete, helpful answers
//  ✓ Temperature: 0.7 — warm, natural receptionist tone
//  ✓ Auto-fallback on 429 with exponential backoff
//  ✓ PII stripped before every API call (DPDP Act 2023 compliance)
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

  const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  // ── System prompt ─────────────────────────────────────────────────
  // Rich context = smarter answers. Gemini needs to know the full
  // clinic — doctors, services, policies — to answer properly.
  const SYSTEM_PROMPT = `
You are Maya, the warm and knowledgeable AI receptionist at ${CHATBOT_CONFIG.clinicName}, located at ${CHATBOT_CONFIG.clinicAddress}.

━━ CLINIC DETAILS ━━
Phone / WhatsApp: ${CHATBOT_CONFIG.clinicPhone}
Email: ${CHATBOT_CONFIG.clinicEmail}
Hours: Monday–Friday 8AM–8PM | Saturday 8AM–6PM | Sunday 9AM–2PM
Appointments confirmed via WhatsApp within 30 minutes during clinic hours.
Lab reports delivered via WhatsApp on the same day for routine tests.
Book online: ${CHATBOT_CONFIG.bookingUrl}

━━ DOCTORS ━━
1. Dr. Lakshmi Nair — General & Internal Medicine (16 yrs exp)
   MBBS, MD (Internal Medicine) — Amrita Institute, Kochi
   Specialises in chronic disease management, preventive care, women's health, diabetes.

2. Dr. Suresh Menon — General Medicine (13 yrs exp)
   MBBS, DNB (General Medicine) — GMC Trivandrum
   Known for thorough diagnosis. Manages elderly care, hypertension, thyroid disorders.

3. Dr. Arun Pillai — Interventional Cardiology (15 yrs exp)
   MBBS, DM (Cardiology) — SCTIMST Trivandrum
   Specialises in ECG, Echo, Holter monitoring, arrhythmia, cardiac risk management.

4. Dr. Priya Menon — Dermatology & Cosmetology (11 yrs exp)
   MBBS, MD (Dermatology) — GMC Kochi
   Treats acne, eczema, psoriasis, hair loss. Cosmetic: PRP therapy, skin brightening.

5. Dr. Vishnu Kumar — Dental Surgery (10 yrs exp)
   BDS, MDS (Oral Surgery) — PMS College of Dental Science, Trivandrum
   Gentle approach. Root canals, implants, braces, smile design. Great with anxious patients.

6. Dr. Deepa Krishnan — Paediatrics & Neonatology (9 yrs exp)
   MBBS, MD (Paediatrics) — GMC Trivandrum
   Newborn care, vaccinations, growth monitoring, adolescent health. Beloved by children.

━━ SERVICES ━━
• General Medicine — routine check-ups, chronic disease management, health screenings
• Cardiology — ECG, Echo, Holter, hypertension and heart disease management
• Dermatology — skin, hair and nail conditions; acne, eczema, cosmetic procedures
• Dental Care — cleanings, fillings, root canals, implants, braces, cosmetic dentistry
• Paediatrics — newborn to teen care, vaccinations, developmental assessments
• Diagnostics & Lab — in-house pathology, digital X-ray, ultrasound, ECG; same-day WhatsApp reports

━━ HOW TO BEHAVE ━━
- Be warm, clear and genuinely helpful — like a great clinic receptionist, not a chatbot.
- Give complete answers. If someone asks about a doctor or service, actually tell them about it.
- Use bullet points only when listing multiple items. Never use markdown headers (##).
- For medical symptoms: give a caring, empathetic response, suggest the right doctor, and ALWAYS end with: "Please visit the clinic so one of our doctors can give you a proper evaluation."
- For emergencies, immediately say: "Please call 112 or go to the nearest emergency room right away."
- NEVER diagnose, prescribe, or give dosage advice under any circumstances.
- If asked something you don't know (exact fees, specific test availability), say you'll connect them with the team and share the WhatsApp number.
- Reply in the same language the user writes in — English, Malayalam, or Hindi.
- Keep responses conversational and human. No robotic repetition of the clinic name in every sentence.
`.trim();

  // ── PII Stripper (DPDP Act 2023) ─────────────────────────────────
  function stripPII(text) {
    return text
      .replace(/\b[6-9]\d{9}\b/g, '[phone removed]')
      .replace(/\+91[\s-]?\d{5}[\s-]?\d{5}/g, '[phone removed]')
      .replace(/\b[\w.+\-]+@[\w\-]+\.[a-z]{2,}\b/gi, '[email removed]')
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[id removed]')
      .replace(/\b(my name is|i am|i'm|name:|called)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/gi, '$1 [name removed]')
      .substring(0, 600);
  }

  // ── Precision cache ───────────────────────────────────────────────
  // CRITICAL RULE: Cache only fires when the message is SHORT (≤ maxWords)
  // AND clearly matches a known standalone query pattern.
  //
  // This prevents "when should I take this medicine?" being intercepted
  // by hours cache, or "my doctor told me to visit" triggering booking.
  // Longer / complex messages always go straight to Gemini.

  const CACHE = [
    {
      maxWords: 5,
      starts: ['hi', 'hello', 'hey', 'hii', 'helo', 'good morning', 'good afternoon', 'good evening', 'namaste', 'namaskar'],
      reply: `👋 Hi there! I'm **Maya**, the AI assistant at ${CHATBOT_CONFIG.clinicName}.\n\nHow can I help you today? You can ask me about our doctors, services, booking an appointment, or clinic timings.`,
    },
    {
      maxWords: 4,
      exact: ['thanks', 'thank you', 'thank u', 'thx', 'ty', 'ok thanks', 'ok thank you', 'great thanks', 'got it', 'perfect', 'awesome'],
      reply: `You're welcome! 😊 Is there anything else I can help you with?`,
    },
    {
      maxWords: 3,
      exact: ['bye', 'goodbye', 'ok bye', 'see you', 'take care'],
      reply: `Take care and stay healthy! 💙 We look forward to seeing you at ${CHATBOT_CONFIG.clinicName}.`,
    },
    {
      maxWords: 6,
      starts: ['what are your hours', 'what are the hours', 'what time do you open', 'what time does the clinic', 'clinic timings', 'clinic hours', 'opening hours', 'working hours', 'are you open today'],
      reply: `🕐 **Clinic Hours:**\n• Monday–Friday: 8AM – 8PM\n• Saturday: 8AM – 6PM\n• Sunday: 9AM – 2PM\n\nWalk-ins welcome. To guarantee your slot, [book an appointment](${CHATBOT_CONFIG.bookingUrl}) or WhatsApp us at wa.me/${CHATBOT_CONFIG.clinicWA}.`,
    },
    {
      maxWords: 6,
      starts: ['how do i book', 'how to book', 'how can i book', 'book an appointment', 'make an appointment', 'i want to book', 'want to make'],
      reply: `You can book in 3 ways:\n1. **Online** — [Fill the booking form](${CHATBOT_CONFIG.bookingUrl}) (takes 2 minutes)\n2. **WhatsApp** — Message us at wa.me/${CHATBOT_CONFIG.clinicWA}\n3. **Call** — 📞 ${CHATBOT_CONFIG.clinicPhone}\n\nWe confirm your slot within **30 minutes** on WhatsApp during clinic hours.`,
    },
    {
      maxWords: 5,
      starts: ['where are you', 'where is the clinic', 'clinic address', 'clinic location', 'how to reach', 'how do i get'],
      reply: `📍 **${CHATBOT_CONFIG.clinicAddress}**\nNear Kowdiar Junction, Trivandrum.\n\nSearch **"MediCare Clinic Kowdiar"** on Google Maps for directions.`,
    },
    {
      maxWords: 5,
      exact: ['phone number', 'contact number', 'your number', 'whatsapp number', 'contact details', 'how to contact', 'how to reach you'],
      reply: `📞 **${CHATBOT_CONFIG.clinicPhone}**\n💬 WhatsApp: wa.me/${CHATBOT_CONFIG.clinicWA}\n📧 ${CHATBOT_CONFIG.clinicEmail}\n\nAvailable during clinic hours (Mon–Sat 8AM–8PM).`,
    },
    {
      maxWords: 4,
      starts: ['emergency', "it's an emergency", 'its an emergency', 'this is an emergency'],
      reply: `🚨 **If this is a medical emergency, call 112 or go to the nearest emergency room immediately.**\n\nFor urgent same-day clinic appointments: 📞 **${CHATBOT_CONFIG.clinicPhone}**`,
    },
  ];

  function getCachedReply(text) {
    const t  = text.toLowerCase().trim();
    const wc = t.split(/\s+/).length;
    for (const entry of CACHE) {
      if (wc > (entry.maxWords || 6)) continue;
      if (entry.exact?.some(e  => t === e || t.startsWith(e + ' '))) return entry.reply;
      if (entry.starts?.some(s => t.startsWith(s)))                   return entry.reply;
    }
    return null;
  }

  // ── Conversation history ──────────────────────────────────────────
  const MAX_HISTORY = 8;
  let msgHistory = [];
  function trimHistory() {
    if (msgHistory.length > MAX_HISTORY) {
      msgHistory = msgHistory.slice(msgHistory.length - MAX_HISTORY);
    }
  }

  // ── API ───────────────────────────────────────────────────────────
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
          temperature:     0.7,
          maxOutputTokens: 500,
          topP:            0.92,
        },
      }),
    });
    if (res.status === 429) { const e = new Error('429'); e.code = 429; throw e; }
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  }

  async function callGemini(userText) {
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
    return `I'm having a bit of trouble right now. Please reach us directly:\n📞 **${CHATBOT_CONFIG.clinicPhone}**\n💬 WhatsApp: wa.me/${CHATBOT_CONFIG.clinicWA}`;
  }

  // ── State ─────────────────────────────────────────────────────────
  let isOpen = false, isLoading = false;

  // ── Styles ────────────────────────────────────────────────────────
  const C = CHATBOT_CONFIG.primaryColor;
  const CSS = `
  #mc-fab{position:fixed;bottom:88px;right:22px;z-index:9998;width:56px;height:56px;border-radius:50%;background:${C};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,102,204,.38);transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s;outline:none}
  #mc-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,102,204,.5)}
  #mc-fab svg{transition:opacity .18s,transform .18s}
  #mc-fab .ic-chat{opacity:1;transform:scale(1) rotate(0deg)}
  #mc-fab .ic-close{opacity:0;transform:scale(.6) rotate(-90deg);position:absolute}
  #mc-fab.open .ic-chat{opacity:0;transform:scale(.6) rotate(90deg)}
  #mc-fab.open .ic-close{opacity:1;transform:scale(1) rotate(0deg)}
  #mc-badge{position:absolute;top:-3px;right:-3px;width:18px;height:18px;background:#EF4444;border-radius:50%;border:2px solid #fff;font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif}
  #mc-badge.hidden{display:none}
  #mc-win{position:fixed;bottom:156px;right:22px;z-index:9999;width:368px;max-height:540px;background:#fff;border-radius:20px;box-shadow:0 24px 56px rgba(15,23,42,.15),0 8px 20px rgba(15,23,42,.08);display:flex;flex-direction:column;overflow:hidden;font-family:'DM Sans',sans-serif;transform-origin:bottom right;transform:scale(.85) translateY(16px);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .22s ease}
  #mc-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}
  .mc-hdr{display:flex;align-items:center;gap:11px;padding:14px 16px;background:${C};border-radius:20px 20px 0 0;flex-shrink:0}
  .mc-hdr-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .mc-hdr-info{flex:1;min-width:0}
  .mc-hdr-name{font-weight:700;font-size:14px;color:#fff;line-height:1.2}
  .mc-hdr-status{display:flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,.75);margin-top:2px}
  .mc-dot{width:7px;height:7px;border-radius:50%;background:#34D399;flex-shrink:0;animation:mcPulse 2.4s ease-in-out infinite}
  @keyframes mcPulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.5)}50%{box-shadow:0 0 0 5px rgba(52,211,153,0)}}
  .mc-hdr-btn{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.15);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.8);transition:background .18s;flex-shrink:0}
  .mc-hdr-btn:hover{background:rgba(255,255,255,.25);color:#fff}
  #mc-msgs{flex:1;overflow-y:auto;padding:14px 12px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
  #mc-msgs::-webkit-scrollbar{width:4px}
  #mc-msgs::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:4px}
  .mc-msg{display:flex;flex-direction:column;gap:3px;max-width:88%}
  .mc-msg.bot{align-self:flex-start}
  .mc-msg.user{align-self:flex-end}
  .mc-bbl{padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.58;word-break:break-word}
  .mc-msg.bot  .mc-bbl{background:#F1F5F9;color:#0F172A;border-bottom-left-radius:4px;border:1px solid #E2E8F0}
  .mc-msg.user .mc-bbl{background:${C};color:#fff;border-bottom-right-radius:4px}
  .mc-bbl strong{font-weight:700}
  .mc-bbl a{color:${C};font-weight:600;text-decoration:underline;text-underline-offset:2px}
  .mc-msg.user .mc-bbl a{color:rgba(255,255,255,.9)}
  .mc-bbl ul,.mc-bbl ol{margin:6px 0 2px;padding-left:18px}
  .mc-bbl li{margin-bottom:3px}
  .mc-time{font-size:10.5px;color:#94A3B8;padding:0 4px}
  .mc-msg.user .mc-time{text-align:right}
  .mc-typing{display:flex;align-self:flex-start;background:#F1F5F9;border:1px solid #E2E8F0;padding:12px 16px;border-radius:16px;border-bottom-left-radius:4px;gap:5px;align-items:center}
  .mc-typing span{width:7px;height:7px;border-radius:50%;background:#94A3B8;animation:mcBounce 1.2s infinite}
  .mc-typing span:nth-child(2){animation-delay:.18s}
  .mc-typing span:nth-child(3){animation-delay:.36s}
  @keyframes mcBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
  .mc-qr{padding:0 12px 10px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}
  .mc-qr-btn{background:#EFF6FF;border:1.5px solid rgba(0,102,204,.18);color:${C};font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;padding:5px 12px;border-radius:99px;cursor:pointer;transition:all .18s;white-space:nowrap}
  .mc-qr-btn:hover{background:${C};color:#fff;border-color:${C}}
  .mc-inp-row{padding:10px 12px 12px;display:flex;gap:8px;align-items:flex-end;border-top:1px solid #F1F5F9;flex-shrink:0}
  #mc-inp{flex:1;border:1.5px solid #E2E8F0;border-radius:12px;padding:9px 13px;font-size:13.5px;font-family:'DM Sans',sans-serif;color:#0F172A;background:#F8FAFC;outline:none;resize:none;min-height:38px;max-height:90px;line-height:1.45;transition:border-color .18s,box-shadow .18s}
  #mc-inp:focus{border-color:${C};background:#fff;box-shadow:0 0 0 3px rgba(0,102,204,.1)}
  #mc-inp::placeholder{color:#94A3B8}
  #mc-send{width:38px;height:38px;border-radius:11px;background:${C};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .18s,box-shadow .18s;box-shadow:0 2px 8px rgba(0,102,204,.28)}
  #mc-send:hover{transform:scale(1.08);box-shadow:0 4px 14px rgba(0,102,204,.38)}
  #mc-send:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .mc-powered{text-align:center;font-size:10px;color:#CBD5E1;padding:4px 0 10px;letter-spacing:.02em}
  @media(max-width:768px){#mc-fab{bottom:196px;right:14px}#mc-win{bottom:262px;right:8px}}
  @media(max-width:400px){#mc-win{width:calc(100vw - 16px);right:8px;bottom:262px;max-height:55vh}#mc-fab{right:14px;bottom:196px}}
  `;

  const QUICK_REPLIES = ['Book an appointment','Our doctors','Clinic hours','Lab & diagnostics','Get directions'];

  const esc    = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const nowStr = () => new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  const $      = id => document.getElementById(id);
  const scroll = () => { const e = $('mc-msgs'); if(e) e.scrollTop = e.scrollHeight; };

  function md(t) {
    let s = esc(t);
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    const lines = s.split('\n');
    const out = []; let ulBuf = [], olBuf = [];
    const flushUl = () => { if(ulBuf.length){out.push(`<ul>${ulBuf.join('')}</ul>`);ulBuf=[];} };
    const flushOl = () => { if(olBuf.length){out.push(`<ol>${olBuf.join('')}</ol>`);olBuf=[];} };
    for (const line of lines) {
      const ul = line.match(/^[•\-\*]\s+(.+)/);
      const ol = line.match(/^\d+\.\s+(.+)/);
      if      (ul) { flushOl(); ulBuf.push(`<li>${ul[1]}</li>`); }
      else if (ol) { flushUl(); olBuf.push(`<li>${ol[1]}</li>`); }
      else         { flushUl(); flushOl(); out.push(line); }
    }
    flushUl(); flushOl();
    return out.join('<br>');
  }

  function appendMsg(role, text) {
    const w = document.createElement('div');
    w.className = `mc-msg ${role}`;
    w.innerHTML = `<div class="mc-bbl">${md(text)}</div><div class="mc-time">${nowStr()}</div>`;
    $('mc-msgs').appendChild(w); scroll();
  }

  function showTyping() {
    const t = document.createElement('div');
    t.id = 'mc-typing'; t.className = 'mc-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    $('mc-msgs').appendChild(t); scroll();
  }

  function removeQuickReplies() { document.querySelector('.mc-qr')?.remove(); }

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
    isLoading = true; if (send) send.disabled = true;

    const cached = getCachedReply(text);
    if (cached) {
      await sleep(420);
      appendMsg('bot', cached);
    } else {
      showTyping();
      const reply = await callGemini(text);
      $('mc-typing')?.remove();
      appendMsg('bot', reply);
    }

    isLoading = false; if (send) send.disabled = false;
  }

  function toggleChat() {
    isOpen = !isOpen;
    $('mc-win')?.classList.toggle('open', isOpen);
    $('mc-fab')?.classList.toggle('open', isOpen);
    $('mc-badge')?.classList.add('hidden');
    if (isOpen) setTimeout(() => $('mc-inp')?.focus(), 320);
  }

  function clearChat() { msgHistory = []; $('mc-msgs').innerHTML = ''; addWelcome(); }

  function addWelcome() {
    const w = document.createElement('div'); w.className = 'mc-msg bot';
    w.innerHTML = `<div class="mc-bbl">👋 Hi! I'm <strong>Maya</strong>, the AI assistant at <strong>${CHATBOT_CONFIG.clinicName}</strong>.<br><br>I can help you with appointments, information about our doctors and services, clinic hours, or any general questions.<br><br>What can I help you with today?</div><div class="mc-time">${nowStr()}</div>`;
    $('mc-msgs').appendChild(w); showQuickReplies();
  }

  function buildUI() {
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

    const fab = document.createElement('button'); fab.id = 'mc-fab';
    fab.setAttribute('aria-label','Chat with Maya, our AI assistant');
    fab.innerHTML = `<svg class="ic-chat" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><svg class="ic-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><div id="mc-badge">1</div>`;
    fab.addEventListener('click', toggleChat);
    document.body.appendChild(fab);

    const win = document.createElement('div'); win.id = 'mc-win';
    win.innerHTML = `
      <div class="mc-hdr">
        <div class="mc-hdr-av"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/></svg></div>
        <div class="mc-hdr-info">
          <div class="mc-hdr-name">Maya — AI Receptionist</div>
          <div class="mc-hdr-status"><div class="mc-dot"></div>${CHATBOT_CONFIG.clinicName}</div>
        </div>
        <button class="mc-hdr-btn" id="mc-clear" title="Clear chat" aria-label="Clear chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
        </button>
      </div>
      <div id="mc-msgs"></div>
      <div class="mc-inp-row">
        <textarea id="mc-inp" placeholder="Ask me anything…" rows="1" maxlength="500"></textarea>
        <button id="mc-send" aria-label="Send message"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
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
