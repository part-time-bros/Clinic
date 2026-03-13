// ─────────────────────────────────────────────────────────────
// AuraClinic — Firebase Config
//
// Steps to activate:
//  1. Go to https://console.firebase.google.com
//  2. Create a project → Add a web app → copy the config below
//  3. In Firestore Database → Create database (start in production mode)
//  4. Set the security rules shown at the bottom of this file
// ─────────────────────────────────────────────────────────────

import { initializeApp }              from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getFirestore, collection,
         addDoc, serverTimestamp }    from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

// ── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyBCi8ytQagIVZFya7Ipy_YKNm0Cfo6acDY',
  authDomain:        'auraclinic-42da8.firebaseapp.com',
  projectId:         'auraclinic-42da8',
  storageBucket:     'auraclinic-42da8.firebasestorage.app',
  messagingSenderId: '1006372372941',
  appId:             '1:1006372372941:web:cfd0d571337e301d5d8484',
};
// ─────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/**
 * Saves an appointment to Firestore.
 * @param {Object} data — appointment fields collected from the form
 * @returns {Promise<string>} — the generated document ID
 */
export async function saveAppointment(data) {
  const docRef = await addDoc(collection(db, 'appointments'), {
    ...data,
    status:    'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ─────────────────────────────────────────────────────────────
// Firestore Security Rules (paste into Firebase console)
// ─────────────────────────────────────────────────────────────
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//
//     // Anyone can create an appointment (website form submission)
//     // No one can read, update, or delete from the client side.
//     // Admin reads happen via the Admin SDK (server-side, Phase 3).
//     match /appointments/{id} {
//       allow create: if
//         request.resource.data.keys().hasAll(['name','phone','specialty','date','status','createdAt'])
//         && request.resource.data.name is string
//         && request.resource.data.name.size() > 0
//         && request.resource.data.name.size() < 120
//         && request.resource.data.phone is string
//         && request.resource.data.status == 'pending';
//
//       allow read, update, delete: if false;
//     }
//   }
// }
//
// ─────────────────────────────────────────────────────────────
