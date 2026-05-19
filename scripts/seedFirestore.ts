import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDY70_Aa698FE9KzzcmkjyFn-CHGratfxg",
  authDomain: "featherframs.firebaseapp.com",
  projectId: "featherframs",
  storageBucket: "featherframs.firebasestorage.app",
  messagingSenderId: "24277638021",
  appId: "1:24277638021:web:c558ecb719adb6d0c1c2ec",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log('🌱 Seeding Firestore...');

  await setDoc(doc(db, 'users', 'supervisor_001'), {
    name: 'Supervisor',
    role: 'supervisor',
    language: 'mr',
    assignedFarms: ['farm_001'],
    createdAt: Timestamp.now(),
  });

  await setDoc(doc(db, 'farms', 'farm_001'), {
    name: 'Farm A',
    location: 'Pune, Maharashtra',
    supervisorId: 'supervisor_001',
    sheds: 2,
    partitionsPerShed: 2,
    totalCameras: 4,
    createdAt: Timestamp.now(),
  });

  await setDoc(doc(db, 'farms', 'farm_001', 'batches', 'batch_001'), {
    batchNumber: 1,
    totalBirds: 3800,
    startDate: Timestamp.fromDate(new Date()),
    endDate: null,
    active: true,
    targetDay: 45,
    createdAt: Timestamp.now(),
    cumMortality: 0,
    cumFeedConsumeBags: 0,
    currentOpeningBalance: 3800,
    lastABW: 0,
    lastDay: 0,
  });

  console.log('✅ Done! Farm + Batch with 3800 birds created.');
}

seed().catch(console.error);
