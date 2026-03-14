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

export function subscribeToAuditLog(callback) {
  // No orderBy — avoids requiring a Firestore composite index on a new collection.
  // Sorting is done client-side in renderAuditLog.
  return onSnapshot(collection(db, 'auditLog'), snap => {
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0));
    callback(data);
  }, err => console.error('Audit log listener error:', err));
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
  email:        'care@auraclinic.in',
  addressLine1: '42 Wellness Avenue, Indiranagar',
  addressLine2: 'Bangalore 560038, Karnataka',
  addressFull:  '42 Wellness Avenue, Indiranagar, Bangalore 560038',
  addressNote:  'Near Indiranagar Metro Station',
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
  { id:1, initials:'SR', color:'#0066CC,#0052A3', name:'Dr. Sudha Raghavan',  specialty:'General and Internal Medicine', quals:'MBBS, MD (Internal Medicine) — AIIMS Delhi',                  bio:'Dr. Raghavan has 18 years of experience managing complex internal medicine cases. She completed her residency at AIIMS Delhi and has a particular interest in preventive medicine.',  years:18, tags:'Preventive Health,Womens Health,Diabetes',          active:true },
  { id:2, initials:'RK', color:'#059669,#047857', name:'Dr. Ramesh Krishnan', specialty:'General Medicine',              quals:'MBBS, DNB (General Medicine) — Kasturba Medical College',     bio:'Dr. Krishnan brings 12 years of broad clinical experience across both urban hospitals and community health settings. He has a calm, patient-centred approach.',                        years:12, tags:'Elderly Care,Hypertension,Thyroid',                 active:true },
  { id:3, initials:'AK', color:'#00957A,#007A63', name:'Dr. Arvind Kumar',    specialty:'Interventional Cardiology',     quals:'MBBS, DM (Cardiology) — Manipal University',                 bio:'Dr. Kumar is an interventional cardiologist with 14 years of experience. He trained at Manipal University and completed a fellowship at Apollo Hospitals.',                           years:14, tags:'ECG and Echo,Hypertension,Arrhythmia',             active:true },
  { id:4, initials:'PM', color:'#7C3AED,#6D28D9', name:'Dr. Priya Menon',     specialty:'Dermatology and Cosmetology',   quals:'MBBS, MD (Dermatology) — St. Johns Medical College',         bio:'Dr. Menon has 11 years of clinical dermatology experience with advanced training in cosmetic procedures. She is one of the most sought-after dermatologists in Indiranagar.',         years:11, tags:'Acne and Eczema,PRP Therapy,Cosmetic Dermatology',  active:true },
  { id:5, initials:'VN', color:'#DC2626,#B91C1C', name:'Dr. Vikram Nair',     specialty:'Dental Surgery',               quals:'BDS, MDS (Oral Surgery) — Manipal College of Dental Sciences',bio:'Dr. Nair is a senior dental surgeon with 9 years of experience in both restorative and cosmetic dentistry. He has a particular interest in painless dentistry.',                     years:9,  tags:'Root Canal,Implants,Smile Design',                  active:true },
  { id:6, initials:'SA', color:'#D97706,#B45309', name:'Dr. Sreeja Anil',     specialty:'Paediatrics and Neonatology',   quals:'MBBS, MD (Paediatrics) — Bangalore Medical College',         bio:'Dr. Sreeja Anil is a paediatrician with 8 years of experience covering newborn care through adolescent health. She is beloved by her young patients for her calm, friendly manner.', years:8,  tags:'Newborn Care,Vaccinations,Growth Monitoring',      active:true },
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
