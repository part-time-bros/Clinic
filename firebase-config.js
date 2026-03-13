// AuraClinic — Firebase Config

import { initializeApp }                           from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getFirestore, collection, addDoc,
         getDocs, doc, updateDoc,
         query, orderBy, serverTimestamp }         from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }             from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';

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

// ── PUBLIC: called by booking forms ──────────────────────────

export async function saveAppointment(data) {
  const docRef = await addDoc(collection(db, 'appointments'), {
    ...data,
    status:    'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── ADMIN: called only from admin.html ───────────────────────

export async function adminLogin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function adminLogout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getAppointments() {
  const q      = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
  const snap   = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateAppointmentStatus(id, status) {
  await updateDoc(doc(db, 'appointments', id), { status });
}

export async function updateAppointment(id, fields) {
  await updateDoc(doc(db, 'appointments', id), fields);
}

// ─────────────────────────────────────────────────────────────
// Updated Firestore Security Rules — paste into Firebase console
// ─────────────────────────────────────────────────────────────
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /appointments/{id} {
//
//       // Anyone can submit a booking form
//       allow create: if
//         request.resource.data.keys().hasAll(['name','phone','specialty','date','status','createdAt'])
//         && request.resource.data.name is string
//         && request.resource.data.name.size() > 0
//         && request.resource.data.name.size() < 120
//         && request.resource.data.phone is string
//         && request.resource.data.status == 'pending';
//
//       // Only logged-in admins can read or update
//       allow read, update: if request.auth != null;
//
//       // Nobody can delete from the client
//       allow delete: if false;
//     }
//   }
// }
//
// ─────────────────────────────────────────────────────────────
