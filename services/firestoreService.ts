// firestoreService.ts
// Place at: FeatherFarms/services/firestoreService.ts
// All Firestore read/write operations for FeatherFarms

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Batch {
  batchNumber: number;
  totalBirds: number;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  targetDay: number;
  cumMortality: number;
  cumFeedConsumeBags: number;
  currentOpeningBalance: number;
  lastABW: number;
  lastDay: number;
}

export interface DailyRecord {
  date: Date;
  day: number;
  openingBalance: number;
  // Manual inputs
  dailyMortality: number;
  feedReceived: number;
  feedTransfer: number;
  dailyConsume: number;
  feedBalance: number;
  balFeedInFeeder: number;
  actualABW: number;
  // Auto-calculated
  cumMortality: number;
  cumMortPercent: number;
  cumFeedConsumeBags: number;
  feedPerBirdActual: number;
  feedPerBirdSTD: number;
  weightGainActual: number;
  fcrActual: number;
  fcrSTD: number;
  dayFCR: number;
  enteredBy: string;
  enteredAt: Date;
}

export interface PrevDayData {
  cumMortality: number;
  cumFeedConsumeBags: number;
  lastABW: number;
  openingBalance: number;
  lastDay: number;
}

// ─── STD Tables ───────────────────────────────────────────────────────────────

const STD_FEED_PER_BIRD: Record<number, number> = {
  1: 11, 2: 15, 3: 19, 4: 23, 5: 27, 6: 33, 7: 38, 8: 42, 9: 46, 10: 49,
  11: 52, 12: 57, 13: 61, 14: 67, 15: 71, 16: 77, 17: 82, 18: 87, 19: 92, 20: 97,
  21: 104, 22: 111, 23: 116, 24: 120, 25: 124, 26: 128, 27: 132, 28: 130, 29: 141, 30: 146,
  31: 151, 32: 156, 33: 162, 34: 169, 35: 175, 36: 179, 37: 181, 38: 185, 39: 186, 40: 188,
  41: 192, 42: 194,
};

const STD_ABW: Record<number, number> = {
  1: 58, 2: 74, 3: 93, 4: 115, 5: 140, 6: 170, 7: 204, 8: 241, 9: 281, 10: 323,
  11: 367, 12: 414, 13: 463, 14: 514, 15: 567, 16: 623, 17: 682, 18: 744, 19: 809, 20: 877,
  21: 949, 22: 1026, 23: 1106, 24: 1188, 25: 1272, 26: 1357, 27: 1443, 28: 1529, 29: 1616, 30: 1704,
  31: 1792, 32: 1880, 33: 1969, 34: 2055, 35: 2147, 36: 2236, 37: 2326, 38: 2416, 39: 2506, 40: 2597,
  41: 2688, 42: 2779,
};

const BAGS_TO_GRAMS = 50000; // 1 bag = 50kg

// ─── Auto-calculation helper ──────────────────────────────────────────────────

export function calculateFields(
  day: number,
  openingBalance: number,
  dailyMortality: number,
  dailyConsume: number,
  actualABW: number,
  prevCumMortality: number,
  prevCumFeedConsumeBags: number,
  totalBirds: number,
  prevABW: number,
) {
  const cumMortality = prevCumMortality + dailyMortality;
  const cumMortPercent = parseFloat(((cumMortality / totalBirds) * 100).toFixed(4));
  const cumFeedConsumeBags = prevCumFeedConsumeBags + dailyConsume;

  const activeBirds = openingBalance - dailyMortality;
  const dailyFeedGrams = dailyConsume * BAGS_TO_GRAMS;
  const feedPerBirdActual =
    activeBirds > 0 ? parseFloat((dailyFeedGrams / activeBirds).toFixed(1)) : 0;
  const feedPerBirdSTD = STD_FEED_PER_BIRD[day] ?? 0;

  const weightGainActual = actualABW > 0 ? actualABW - prevABW : 0;

  const cumFeedGrams = cumFeedConsumeBags * BAGS_TO_GRAMS;
  const stdABW = STD_ABW[day] ?? 1;

  const fcrActual =
    actualABW > 0 && activeBirds > 0
      ? parseFloat((cumFeedGrams / (actualABW * activeBirds)).toFixed(2))
      : 0;

  const fcrSTD =
    stdABW > 0
      ? parseFloat((cumFeedGrams / (stdABW * activeBirds)).toFixed(2))
      : 0;

  const weightDiff = actualABW - prevABW;
  const dayFCR =
    weightDiff > 0 && activeBirds > 0
      ? parseFloat((dailyFeedGrams / (weightDiff * activeBirds)).toFixed(2))
      : 0;

  return {
    cumMortality,
    cumMortPercent,
    cumFeedConsumeBags,
    feedPerBirdActual,
    feedPerBirdSTD,
    weightGainActual,
    fcrActual,
    fcrSTD,
    dayFCR,
  };
}

// ─── Firestore Operations ─────────────────────────────────────────────────────

/**
 * Fetch the active batch for a farm
 */
export async function getActiveBatch(farmId: string): Promise<{ id: string; data: Batch } | null> {
  try {
    const batchRef = doc(db, 'farms', farmId, 'batches', 'batch_001');
    const snap = await getDoc(batchRef);
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      data: {
        ...d,
        startDate: d.startDate?.toDate(),
        endDate: d.endDate?.toDate() ?? null,
      } as Batch,
    };
  } catch (err) {
    console.error('getActiveBatch error:', err);
    return null;
  }
}

/**
 * Fetch previous day data needed for today's calculations
 */
export async function getPrevDayData(
  farmId: string,
  batchId: string,
  currentDay: number,
): Promise<PrevDayData> {
  // Default: Day 1 has no previous
  if (currentDay <= 1) {
    return {
      cumMortality: 0,
      cumFeedConsumeBags: 0,
      lastABW: 0,
      openingBalance: 3800,
      lastDay: 0,
    };
  }

  try {
    const prevDayId = `day_${currentDay - 1}`;
    const ref = doc(db, 'farms', farmId, 'batches', batchId, 'dailyRecords', prevDayId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Fallback: read from batch document cumulative totals
      const batchSnap = await getDoc(doc(db, 'farms', farmId, 'batches', batchId));
      if (batchSnap.exists()) {
        const b = batchSnap.data();
        return {
          cumMortality: b.cumMortality ?? 0,
          cumFeedConsumeBags: b.cumFeedConsumeBags ?? 0,
          lastABW: b.lastABW ?? 0,
          openingBalance: b.currentOpeningBalance ?? 3800,
          lastDay: b.lastDay ?? 0,
        };
      }
      return { cumMortality: 0, cumFeedConsumeBags: 0, lastABW: 0, openingBalance: 3800, lastDay: 0 };
    }

    const d = snap.data();
    return {
      cumMortality: d.cumMortality ?? 0,
      cumFeedConsumeBags: d.cumFeedConsumeBags ?? 0,
      lastABW: d.actualABW ?? 0,
      openingBalance: (d.openingBalance ?? 3800) - (d.dailyMortality ?? 0),
      lastDay: d.day ?? 0,
    };
  } catch (err) {
    console.error('getPrevDayData error:', err);
    return { cumMortality: 0, cumFeedConsumeBags: 0, lastABW: 0, openingBalance: 3800, lastDay: 0 };
  }
}

/**
 * Save today's daily record + update batch cumulative totals
 */
export async function saveDailyRecord(
  farmId: string,
  batchId: string,
  day: number,
  inputs: {
    dailyMortality: number;
    feedReceived: number;
    feedTransfer: number;
    dailyConsume: number;
    feedBalance: number;
    balFeedInFeeder: number;
    actualABW: number;
  },
  calculated: {
    cumMortality: number;
    cumMortPercent: number;
    cumFeedConsumeBags: number;
    feedPerBirdActual: number;
    feedPerBirdSTD: number;
    weightGainActual: number;
    fcrActual: number;
    fcrSTD: number;
    dayFCR: number;
  },
  openingBalance: number,
  supervisorId: string,
): Promise<boolean> {
  try {
    const dayId = `day_${day}`;
    const recordRef = doc(db, 'farms', farmId, 'batches', batchId, 'dailyRecords', dayId);

    // Save daily record
    await setDoc(recordRef, {
      date: Timestamp.fromDate(new Date()),
      day,
      openingBalance,
      ...inputs,
      ...calculated,
      enteredBy: supervisorId,
      enteredAt: Timestamp.now(),
    });

    // Update batch cumulative totals
    const batchRef = doc(db, 'farms', farmId, 'batches', batchId);
    await updateDoc(batchRef, {
      cumMortality: calculated.cumMortality,
      cumFeedConsumeBags: calculated.cumFeedConsumeBags,
      currentOpeningBalance: openingBalance - inputs.dailyMortality,
      lastABW: inputs.actualABW,
      lastDay: day,
    });

    console.log(`✅ Day ${day} record saved`);
    return true;
  } catch (err) {
    console.error('saveDailyRecord error:', err);
    return false;
  }
}

/**
 * Fetch all daily records for a batch (for history/charts)
 */
export async function getAllDailyRecords(
  farmId: string,
  batchId: string,
): Promise<DailyRecord[]> {
  try {
    const colRef = collection(db, 'farms', farmId, 'batches', batchId, 'dailyRecords');
    const q = query(colRef, orderBy('day', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        date: data.date?.toDate(),
        enteredAt: data.enteredAt?.toDate(),
      } as DailyRecord;
    });
  } catch (err) {
    console.error('getAllDailyRecords error:', err);
    return [];
  }
}

/**
 * Check if today's record already exists
 */
export async function checkRecordExists(
  farmId: string,
  batchId: string,
  day: number,
): Promise<boolean> {
  try {
    const ref = doc(db, 'farms', farmId, 'batches', batchId, 'dailyRecords', `day_${day}`);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}