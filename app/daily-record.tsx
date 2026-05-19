// app/daily-record.tsx
// Daily Record Entry — Yellow & White theme, Firestore connected

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Animated, KeyboardAvoidingView,
  Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Constants ────────────────────────────────────────────────────────────────
const FARM_ID = 'farm_001';
const BATCH_ID = 'batch_001';
const SUPERVISOR_ID = 'supervisor_001';
const BAGS_TO_GRAMS = 50000;

const STD_FEED: Record<number, number> = {
  1:11,2:15,3:19,4:23,5:27,6:33,7:38,8:42,9:46,10:49,
  11:52,12:57,13:61,14:67,15:71,16:77,17:82,18:87,19:92,20:97,
  21:104,22:111,23:116,24:120,25:124,26:128,27:132,28:130,29:141,30:146,
  31:151,32:156,33:162,34:169,35:175,36:179,37:181,38:185,39:186,40:188,
  41:192,42:194,43:196,44:198,45:200,
};
const STD_ABW: Record<number, number> = {
  1:58,2:74,3:93,4:115,5:140,6:170,7:204,8:241,9:281,10:323,
  11:367,12:414,13:463,14:514,15:567,16:623,17:682,18:744,19:809,20:877,
  21:949,22:1026,23:1106,24:1188,25:1272,26:1357,27:1443,28:1529,29:1616,30:1704,
  31:1792,32:1880,33:1969,34:2055,35:2147,36:2236,37:2326,38:2416,39:2506,40:2597,
  41:2688,42:2779,43:2870,44:2960,45:3050,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function DailyRecordEntry() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [day, setDay] = useState(1);
  const [totalBirds, setTotalBirds] = useState(3800);
  const [prev, setPrev] = useState({
    cumMortality: 0, cumFeedConsumeBags: 0,
    lastABW: 0, openingBalance: 3800,
  });

  // Inputs
  const [dailyMortality, setDailyMortality] = useState('');
  const [feedReceived, setFeedReceived] = useState('');
  const [feedTransfer, setFeedTransfer] = useState('');
  const [dailyConsume, setDailyConsume] = useState('');
  const [feedBalance, setFeedBalance] = useState('');
  const [balFeedInFeeder, setBalFeedInFeeder] = useState('');
  const [actualABW, setActualABW] = useState('');

  // Calculated
  const [calc, setCalc] = useState({
    cumMortality: 0, cumMortPercent: '0', cumFeedConsumeBags: 0,
    feedPerBirdActual: '—', feedPerBirdSTD: '—',
    weightGainActual: '—', fcrActual: '—', fcrSTD: '—', dayFCR: '—',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const mort = parseFloat(dailyMortality) || 0;
    const consume = parseFloat(dailyConsume) || 0;
    const abw = parseFloat(actualABW) || 0;

    const cumMort = prev.cumMortality + mort;
    const cumMortPct = ((cumMort / totalBirds) * 100).toFixed(4);
    const cumConsume = prev.cumFeedConsumeBags + consume;
    const activeBirds = prev.openingBalance - mort;
    const dailyFeedG = consume * BAGS_TO_GRAMS;
    const feedPerBirdActual = activeBirds > 0 ? (dailyFeedG / activeBirds).toFixed(1) : '—';
    const feedPerBirdSTD = String(STD_FEED[day] ?? '—');
    const weightGainActual = abw > 0 ? String(abw - prev.lastABW) : '—';
    const cumFeedG = cumConsume * BAGS_TO_GRAMS;
    const fcrActual = abw > 0 && activeBirds > 0
      ? (cumFeedG / (abw * activeBirds)).toFixed(2) : '—';
    const stdABW = STD_ABW[day] ?? 1;
    const fcrSTD = (cumFeedG / (stdABW * activeBirds)).toFixed(2);
    const wDiff = abw - prev.lastABW;
    const dayFCR = wDiff > 0 && activeBirds > 0
      ? (dailyFeedG / (wDiff * activeBirds)).toFixed(2) : '—';

    setCalc({ cumMortality: cumMort, cumMortPercent: cumMortPct, cumFeedConsumeBags: cumConsume,
      feedPerBirdActual, feedPerBirdSTD, weightGainActual, fcrActual, fcrSTD, dayFCR });
  }, [dailyMortality, dailyConsume, actualABW, prev, day]);

  async function loadData() {
    setLoading(true);
    try {
      const batchRef = doc(db, 'farms', FARM_ID, 'batches', BATCH_ID);
      const snap = await getDoc(batchRef);
      if (!snap.exists()) {
        Alert.alert('Error', 'No active batch found.');
        setLoading(false);
        return;
      }
      const d = snap.data();
      const startDate = d.startDate?.toDate() ?? new Date();
      const dayNum = Math.max(1, Math.ceil(
        (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      setDay(dayNum);
      setTotalBirds(d.totalBirds ?? 3800);

      // Check if today already saved
      const todayRef = doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'dailyRecords', `day_${dayNum}`);
      const todaySnap = await getDoc(todayRef);
      setAlreadySaved(todaySnap.exists());

      // Get previous day data
      if (dayNum > 1) {
        const prevRef = doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'dailyRecords', `day_${dayNum - 1}`);
        const prevSnap = await getDoc(prevRef);
        if (prevSnap.exists()) {
          const p = prevSnap.data();
          setPrev({
            cumMortality: p.cumMortality ?? 0,
            cumFeedConsumeBags: p.cumFeedConsumeBags ?? 0,
            lastABW: p.actualABW ?? 0,
            openingBalance: (p.openingBalance ?? 3800) - (p.dailyMortality ?? 0),
          });
        } else {
          setPrev({
            cumMortality: d.cumMortality ?? 0,
            cumFeedConsumeBags: d.cumFeedConsumeBags ?? 0,
            lastABW: d.lastABW ?? 0,
            openingBalance: d.currentOpeningBalance ?? 3800,
          });
        }
      } else {
        setPrev({ cumMortality: 0, cumFeedConsumeBags: 0, lastABW: 0, openingBalance: d.totalBirds ?? 3800 });
      }

      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e) {
      Alert.alert('Error', 'Failed to load data. Check connection.');
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!dailyMortality || !dailyConsume || !actualABW) {
      Alert.alert('चूक / Missing', 'Mortality, Feed Consume आणि ABW आवश्यक आहे.');
      return;
    }
    if (alreadySaved) {
      Alert.alert('आधीच जतन केले', `Day ${day} already saved. Overwrite?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Overwrite', style: 'destructive', onPress: doSave },
      ]);
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      const dayId = `day_${day}`;
      await setDoc(doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'dailyRecords', dayId), {
        date: Timestamp.fromDate(new Date()),
        day,
        openingBalance: prev.openingBalance,
        dailyMortality: parseFloat(dailyMortality) || 0,
        feedReceived: parseFloat(feedReceived) || 0,
        feedTransfer: parseFloat(feedTransfer) || 0,
        dailyConsume: parseFloat(dailyConsume) || 0,
        feedBalance: parseFloat(feedBalance) || 0,
        balFeedInFeeder: parseFloat(balFeedInFeeder) || 0,
        actualABW: parseFloat(actualABW) || 0,
        cumMortality: calc.cumMortality,
        cumMortPercent: parseFloat(calc.cumMortPercent),
        cumFeedConsumeBags: calc.cumFeedConsumeBags,
        feedPerBirdActual: parseFloat(calc.feedPerBirdActual) || 0,
        feedPerBirdSTD: parseFloat(calc.feedPerBirdSTD) || 0,
        weightGainActual: parseFloat(calc.weightGainActual) || 0,
        fcrActual: parseFloat(calc.fcrActual) || 0,
        fcrSTD: parseFloat(calc.fcrSTD) || 0,
        dayFCR: parseFloat(calc.dayFCR) || 0,
        enteredBy: SUPERVISOR_ID,
        enteredAt: Timestamp.now(),
      });

      await updateDoc(doc(db, 'farms', FARM_ID, 'batches', BATCH_ID), {
        cumMortality: calc.cumMortality,
        cumFeedConsumeBags: calc.cumFeedConsumeBags,
        currentOpeningBalance: prev.openingBalance - (parseFloat(dailyMortality) || 0),
        lastABW: parseFloat(actualABW) || 0,
        lastDay: day,
        lastFCR: parseFloat(calc.fcrActual) || 0,
      });

      setAlreadySaved(true);
      Alert.alert('✅ जतन केले!', `Day ${day} record saved successfully!`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={styles.loadingText}>लोड होत आहे... / Loading...</Text>
      </View>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fcrHigh = calc.fcrActual !== '—' && calc.fcrSTD !== '—' &&
    parseFloat(calc.fcrActual) > parseFloat(calc.fcrSTD);
  const mortHigh = (parseFloat(dailyMortality) || 0) > prev.openingBalance * 0.005;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5A623" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>📋 दैनिक नोंद</Text>
          <Text style={styles.headerSub}>Daily Record Entry</Text>
        </View>
        <View style={styles.dayBadge}>
          <Text style={styles.dayNum}>{day}</Text>
          <Text style={styles.dayLbl}>Day</Text>
        </View>
      </View>

      {alreadySaved && (
        <View style={styles.savedBanner}>
          <Text style={styles.savedBannerText}>✅ Day {day} आधीच जतन केले / Already saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Info Strip */}
          <View style={styles.infoStrip}>
            <InfoChip label="तारीख" value={todayStr} />
            <InfoChip label="एकूण पक्षी" value={String(totalBirds)} />
            <InfoChip label="आज उघडणारे" value={String(prev.openingBalance)} />
          </View>

          {/* Alerts */}
          {fcrHigh && (
            <View style={[styles.alertBox, { borderColor: '#E67E22', backgroundColor: '#FEF0E6' }]}>
              <Text style={[styles.alertText, { color: '#E67E22' }]}>
                ⚠️ FCR मानकापेक्षा जास्त! Actual: {calc.fcrActual} vs STD: {calc.fcrSTD}
              </Text>
            </View>
          )}
          {mortHigh && (
            <View style={[styles.alertBox, { borderColor: '#C0392B', backgroundColor: '#FDEDEC' }]}>
              <Text style={[styles.alertText, { color: '#C0392B' }]}>
                🚨 जास्त मृत्यू! High Mortality: {dailyMortality} birds today
              </Text>
            </View>
          )}

          {/* Manual Entry */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✍️ माहिती भरा / Enter Details</Text>

            <InputRow label="दैनिक मृत्यू / Daily Mortality" hint="birds"
              value={dailyMortality} onChangeText={setDailyMortality} />
            <InputRow label="चारा मिळाला / Feed Received" hint="bags"
              value={feedReceived} onChangeText={setFeedReceived} />
            <InputRow label="चारा हस्तांतरण / Feed Transfer" hint="bags"
              value={feedTransfer} onChangeText={setFeedTransfer} />
            <InputRow label="दैनिक वापर / Daily Consume" hint="bags"
              value={dailyConsume} onChangeText={setDailyConsume} />
            <InputRow label="चारा शिल्लक / Feed Balance" hint="bags"
              value={feedBalance} onChangeText={setFeedBalance} />
            <InputRow label="भरणाऱ्यात चारा / Bal in Feeder" hint="bags"
              value={balFeedInFeeder} onChangeText={setBalFeedInFeeder} />
            <InputRow label="वास्तविक वजन / Actual ABW" hint="grams"
              value={actualABW} onChangeText={setActualABW} />
          </View>

          {/* Auto Calculated */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔢 स्वयंचलित गणना / Auto-Calculated</Text>
            <View style={styles.calcGrid}>
              <CalcCard label="Cum Mortality" value={String(calc.cumMortality)}
                sub={`${calc.cumMortPercent}%`} accent="#C0392B" />
              <CalcCard label="Cum Feed" value={`${calc.cumFeedConsumeBags} bags`} accent="#2980B9" />
              <CalcCard label="Feed/Bird" value={`${calc.feedPerBirdActual}g`}
                sub={`STD: ${calc.feedPerBirdSTD}g`} accent="#27AE60" />
              <CalcCard label="Weight Gain" value={`${calc.weightGainActual}g`} accent="#8E44AD" />
              <CalcCard label="FCR Actual" value={calc.fcrActual}
                sub={`STD: ${calc.fcrSTD}`} accent={fcrHigh ? '#C0392B' : '#F5A623'} />
              <CalcCard label="Day FCR" value={calc.dayFCR} accent="#16A085" />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>
                  {alreadySaved ? '✏️ अपडेट करा / Update' : '💾 जतन करा / Save Record'}
                </Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipLabel}>{label}</Text>
      <Text style={styles.infoChipValue}>{value}</Text>
    </View>
  );
}

function InputRow({ label, hint, value, onChangeText }: {
  label: string; hint: string; value: string; onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#ccc"
        />
        <Text style={styles.inputHint}>{hint}</Text>
      </View>
    </View>
  );
}

function CalcCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <View style={[styles.calcCard, { borderTopColor: accent }]}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={[styles.calcValue, { color: accent }]}>{value}</Text>
      {sub && <Text style={styles.calcSub}>{sub}</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8E1' },
  loadingWrap: { flex: 1, backgroundColor: '#FFF8E1', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#F5A623', marginTop: 12, fontSize: 14, fontWeight: '700' },

  header: {
    backgroundColor: '#F5A623',
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: { padding: 6 },
  backText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerSub: { color: '#fff', fontSize: 11, opacity: 0.85, fontWeight: '600' },
  dayBadge: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  dayNum: { fontSize: 22, fontWeight: '900', color: '#F5A623' },
  dayLbl: { fontSize: 9, color: '#F5A623', fontWeight: '700' },

  savedBanner: {
    backgroundColor: '#FFF3D6', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F5A623',
  },
  savedBannerText: { color: '#E67E22', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  scroll: { padding: 16 },

  infoStrip: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  infoChip: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 10, borderWidth: 1.5, borderColor: '#FFE082',
    shadowColor: '#F5A623', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  infoChipLabel: { color: '#aaa', fontSize: 9, fontWeight: '700', marginBottom: 2 },
  infoChipValue: { color: '#333', fontSize: 13, fontWeight: '800' },

  alertBox: {
    borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1.5,
  },
  alertText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  section: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    marginBottom: 14, borderWidth: 1.5, borderColor: '#FFE082',
    shadowColor: '#F5A623', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#F5A623', marginBottom: 14 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#FFF3D6',
  },
  inputLabel: { color: '#555', fontSize: 12, fontWeight: '600', flex: 1, paddingRight: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF8E1', borderRadius: 8,
    borderWidth: 1.5, borderColor: '#FFE082', paddingHorizontal: 10,
  },
  input: { color: '#333', fontSize: 16, fontWeight: '800', paddingVertical: 6, minWidth: 50, textAlign: 'right' },
  inputHint: { color: '#aaa', fontSize: 10, marginLeft: 4 },

  calcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  calcCard: {
    width: '47%', backgroundColor: '#FFF8E1', borderRadius: 12,
    padding: 12, borderTopWidth: 3, borderWidth: 1, borderColor: '#FFE082',
  },
  calcLabel: { color: '#888', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  calcValue: { fontSize: 20, fontWeight: '900' },
  calcSub: { color: '#aaa', fontSize: 10, marginTop: 2 },

  saveBtn: {
    backgroundColor: '#F5A623', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    marginTop: 6,
    shadowColor: '#F5A623', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});