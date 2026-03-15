// AuraClinic — Firebase Config

import { initializeApp }                                from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs,
         doc, updateDoc, setDoc, getDoc,
         query, orderBy, serverTimestamp, onSnapshot }  from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut,
         onAuthStateChanged, setPersistence,
         browserSessionPersistence }                    from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBCi8ytQagIVZFya7Ipy_YKNm0Cfo6acDY',
  authDomain:        'auraclinic-42da8.firebaseapp.com',
  projectId:         'auraclinic-42da8',
  storageBucket:     'auraclinic-42da8.firebasestorage.app',
  messagingSenderId: '1006372372941',
  appId:             '1:1006372372941:web:cfd0d571337e301d5d8484',
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── PUBLIC ────────────────────────────────────────────────────

export async function saveAppointment(data) {
  const docRef = await addDoc(collection(db, 'appointments'), {
    ...data,
    status:    'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── ADMIN AUTH ────────────────────────────────────────────────

const SESSION_KEY = 'ac_login_at';
const MAX_SESSION = 24 * 60 * 60 * 1000;

export async function adminLogin(email, password) {
  await setPersistence(auth, browserSessionPersistence);
  // Stamp session BEFORE sign-in — onAuthStateChanged fires before the
  // signInWithEmailAndPassword promise resolves, so the stamp must exist first.
  sessionStorage.setItem(SESSION_KEY, Date.now().toString());
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred;
  } catch (err) {
    // Clear stamp if login actually failed
    sessionStorage.removeItem(SESSION_KEY);
    throw err;
  }
}

export async function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async user => {
    if (user) {
      const loginAt = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10);
      // No session stamp means tab was closed and Firebase restored from cache — force re-login
      if (!loginAt) {
        await signOut(auth);
        callback(null);
        return;
      }
      // Session older than 24 hours — force re-login
      if (Date.now() - loginAt > MAX_SESSION) {
        sessionStorage.removeItem(SESSION_KEY);
        await signOut(auth);
        callback(null);
        return;
      }
    }
    callback(user);
  });
}

// ── ADMIN APPOINTMENTS ────────────────────────────────────────

export async function getAppointments() {
  const q    = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Real-time listener — calls callback whenever appointments change
// Returns an unsubscribe function
export function subscribeToAppointments(callback) {
  const q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, err => console.error('Realtime listener error:', err));
}

// ── AUDIT LOG ────────────────────────────────────────────────

export async function writeAuditLog(entry) {
  await addDoc(collection(db, 'auditLog'), {
    ...entry,
    timestamp: serverTimestamp(),
  });
}

export function subscribeToAuditLog(callback, onError) {
  // No orderBy — avoids requiring a Firestore composite index on a new collection.
  // Sorting is done client-side in renderAuditLog.
  return onSnapshot(collection(db, 'auditLog'), snap => {
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0));
    callback(data);
  }, err => {
    console.error('Audit log listener error:', err);
    if (onError) onError(err);
  });
}

export async function updateAppointmentStatus(id, status) {
  await updateDoc(doc(db, 'appointments', id), { status });
}

export async function updateAppointment(id, fields) {
  await updateDoc(doc(db, 'appointments', id), fields);
}

// ── CLINIC SETTINGS ───────────────────────────────────────────

const DEFAULT_SETTINGS = {
  phone:        '9876543210',
  whatsapp:     '919876543210',
  email:        'care@medicareclinic.in',
  addressLine1: '12 Health Avenue, Kowdiar',
  addressLine2: 'Trivandrum 695003, Kerala',
  addressFull:  '12 Health Avenue, Kowdiar, Trivandrum 695003',
  addressNote:  'Near Kowdiar Junction',
  mapEmbed:     'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.9!2d77.6408!3d12.9784!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTLCsDU4JzQyLjIiTiA3N8KwMzgnMjYuOSJF!5e0!3m2!1sen!2sin!4v1234567890',
  hoursWeekday: 'Mon-Fri: 8AM-8PM',
  hoursSat:     'Sat: 8AM-6PM',
  hoursSun:     'Sun: 9AM-2PM',
  hoursFooter:  'Mon-Sat: 8AM-8PM, Sun: 9AM-2PM',
  hoursCall:    'Mon-Sat, 8AM-8PM',
};

export async function getClinicSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'clinic'));
    return snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveClinicSettings(data) {
  await setDoc(doc(db, 'settings', 'clinic'), data, { merge: true });
}

// ── DOCTOR PROFILES ───────────────────────────────────────────

const DEFAULT_DOCTORS = [
  { id:1, initials:'LN', color:'#0066CC,#0052A3', name:'Dr. Lakshmi Nair',     specialty:'General and Internal Medicine', quals:'MBBS, MD (Internal Medicine) — Amrita Institute of Medical Sciences',    bio:'Dr. Nair has 16 years of experience in internal medicine. She trained at Amrita Institute, Kochi and specialises in chronic disease management and preventive care.', years:16, tags:'Preventive Health,Womens Health,Diabetes', active:true },
  { id:2, initials:'SM', color:'#059669,#047857', name:'Dr. Suresh Menon',    specialty:'General Medicine',              quals:'MBBS, DNB (General Medicine) — Government Medical College Trivandrum', bio:'Dr. Menon has 13 years of experience in general practice. He completed his DNB from GMC Trivandrum and is known for his thorough approach to diagnosis and patient care.', years:13, tags:'Elderly Care,Hypertension,Thyroid', active:true },
  { id:3, initials:'AP', color:'#00957A,#007A63', name:'Dr. Arun Pillai',     specialty:'Interventional Cardiology',     quals:'MBBS, DM (Cardiology) — SCTIMST Trivandrum',                  bio:'Dr. Pillai is a cardiologist trained at the prestigious SCTIMST, Trivandrum with 15 years of experience. He specialises in ECG interpretation, hypertension management and cardiac risk.', years:15, tags:'ECG and Echo,Hypertension,Arrhythmia', active:true },
  { id:4, initials:'PM', color:'#7C3AED,#6D28D9', name:'Dr. Priya Menon',     specialty:'Dermatology and Cosmetology',   quals:'MBBS, MD (Dermatology) — Government Medical College Kochi',   bio:'Dr. Menon has 11 years of clinical dermatology experience with advanced training in cosmetic procedures. She is one of the most sought-after dermatologists in Trivandrum.', years:11, tags:'Acne and Eczema,PRP Therapy,Cosmetic Dermatology', active:true },
  { id:5, initials:'VK', color:'#DC2626,#B91C1C', name:'Dr. Vishnu Kumar',    specialty:'Dental Surgery',               quals:'BDS, MDS (Oral Surgery) — PMS College of Dental Science Trivandrum', bio:'Dr. Kumar is a dental surgeon with 10 years of experience in restorative and cosmetic dentistry. He is known for his gentle, painless approach — particularly popular with anxious patients.', years:10, tags:'Root Canal,Implants,Smile Design', active:true },
  { id:6, initials:'DK', color:'#D97706,#B45309', name:'Dr. Deepa Krishnan',  specialty:'Paediatrics and Neonatology',   quals:'MBBS, MD (Paediatrics) — Government Medical College Trivandrum', bio:'Dr. Deepa Krishnan is a paediatrician with 9 years of experience from newborn care through teenage health. She is beloved by young patients and parents alike for her warm, gentle manner.', years:9, tags:'Newborn Care,Vaccinations,Growth Monitoring', active:true },
];

export async function getDoctorsList() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'doctors'));
    return snap.exists() ? snap.data().list : DEFAULT_DOCTORS;
  } catch {
    return DEFAULT_DOCTORS;
  }
}

export async function saveDoctorsList(list) {
  await setDoc(doc(db, 'settings', 'doctors'), { list });
}

// ── DOCTOR AVAILABILITY ───────────────────────────────────────
// Stored as { doctorId: { offDays: [0,6], blockedDates: ['2026-03-25'] } }

export async function getAvailability() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'availability'));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

export async function saveAvailability(data) {
  await setDoc(doc(db, 'settings', 'availability'), data, { merge: true });
}

// ── HERO CONTENT ─────────────────────────────────────────────

const DEFAULT_HERO = {
  title:       'Healthcare you can trust, close to home.',
  subtitle:    'Expert doctors, modern diagnostics, and personalised care — all under one roof in Indiranagar, Bangalore.',
  stat1_num:   '5000', stat1_lbl: 'Patients Treated',
  stat2_num:   '15',   stat2_lbl: 'Years of Care',
  stat3_num:   '12',   stat3_lbl: 'Specialist Doctors',
  stat4_num:   '98%',  stat4_lbl: 'Patient Satisfaction',
};

export async function getHeroContent() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'hero'));
    return snap.exists() ? { ...DEFAULT_HERO, ...snap.data() } : DEFAULT_HERO;
  } catch { return DEFAULT_HERO; }
}

export async function saveHeroContent(data) {
  await setDoc(doc(db, 'settings', 'hero'), data, { merge: true });
}

// ── TESTIMONIALS ─────────────────────────────────────────────

const DEFAULT_TESTIMONIALS = [
  { id:1, text:"Dr. Raghavan spent a full 20 minutes explaining my diagnosis and treatment plan. I never felt rushed. The clinic is spotlessly clean and the staff are genuinely warm.", name:'Rohit Sharma', note:'Patient since 2021', initials:'RS', color:'#0066CC,#0052A3', stars:5 },
  { id:2, text:"Got my ECG, blood work, and cardiologist review all in one visit. The WhatsApp report arrived that evening. Incredibly convenient for working professionals.", name:'Ananya Nair', note:'Patient since 2022', initials:'AN', color:'#00957A,#007A63', stars:5 },
  { id:3, text:"Brought my 4-year-old for a vaccination and she did not cry once. The paediatric team has a real gift with children. This is our family clinic for life.", name:'Divya Menon', note:'Patient since 2023', initials:'DM', color:'#7C3AED,#6D28D9', stars:5 },
];

export async function getTestimonials() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'testimonials'));
    return snap.exists() ? snap.data().list : DEFAULT_TESTIMONIALS;
  } catch { return DEFAULT_TESTIMONIALS; }
}

export async function saveTestimonials(list) {
  await setDoc(doc(db, 'settings', 'testimonials'), { list });
}

// ── SERVICES ─────────────────────────────────────────────────

const DEFAULT_SERVICES = [
  { id:1, title:'General Medicine',    desc:'Comprehensive diagnosis and treatment for acute and chronic conditions. Preventive health checks and wellness programmes.' },
  { id:2, title:'Cardiology',          desc:'Advanced cardiac diagnostics including ECG, Echo, and Holter monitoring. Management of hypertension and heart disease.' },
  { id:3, title:'Dermatology',         desc:'Diagnosis and treatment of skin, hair, and nail conditions. Acne, eczema, psoriasis, and cosmetic dermatology.' },
  { id:4, title:'Dental Care',         desc:'Complete dental services from routine cleaning and fillings to root canals, braces, and cosmetic corrections.' },
  { id:5, title:'Paediatrics',         desc:'Dedicated child healthcare from newborn through adolescence. Vaccinations, growth monitoring, and developmental assessments.' },
  { id:6, title:'Diagnostics and Lab', desc:'In-house pathology lab, digital X-ray, ultrasound, and ECG. Same-day reports for most tests with WhatsApp delivery.' },
];

export async function getServices() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'services'));
    return snap.exists() ? snap.data().list : DEFAULT_SERVICES;
  } catch { return DEFAULT_SERVICES; }
}

export async function saveServices(list) {
  await setDoc(doc(db, 'settings', 'services'), { list });
}

// ─────────────────────────────────────────────────────────────
// Firestore Security Rules — UPDATED (paste into Firebase console)
// ─────────────────────────────────────────────────────────────
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /appointments/{id} {
//       allow create: if
//         request.resource.data.keys().hasAll(['name','phone','specialty','date','status','createdAt'])
//         && request.resource.data.name is string
//         && request.resource.data.name.size() > 0
//         && request.resource.data.name.size() < 120
//         && request.resource.data.phone is string
//         && request.resource.data.status == 'pending';
//       allow read, update: if request.auth != null;
//       allow delete: if false;
//     }
//     match /settings/{document} {
//       allow read: if true;
//       allow write: if request.auth != null;
//     }
//     match /auditLog/{entry} {
//       allow create, read: if request.auth != null;
//       allow update, delete: if false;
//     }
//   }
// }
