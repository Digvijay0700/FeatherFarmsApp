// ─────────────────────────────────────────────────────────────
// app/weight-tracker.tsx
// Weight Estimation — live Firestore, weight + biomass + chart
// ─────────────────────────────────────────────────────────────

import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { db } from '../firebaseConfig';

const W = Dimensions.get('window').width;
const FARM_ID  = 'farm_001';
const BATCH_ID = 'batch_001';

// Standard FCR broiler weight curve (g) for reference line
const STANDARD_WEIGHTS = [45,58,74,92,113,136,162,191,222,256,292,330,370,412,455,500,545,592,640,688,737,787,837,888,939,990,1041,1092,1143,1194,1244,1293,1342,1390,1437,1483,1528,1572,1615,1657,1698,1737,1775,1811,1845];

function timeAgo(iso?: string) {
  if (!iso) return 'Never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function weightStatus(g: number) {
  // compare against day-adjusted standard (rough approximation)
  if (g > 1800) return { label: 'Excellent', color: '#66BB6A', bg: '#EDF8EE' };
  if (g > 1200) return { label: 'On track',  color: '#42A5F5', bg: '#EEF6FF' };
  if (g > 800)  return { label: 'Average',   color: '#F5A623', bg: '#FFF4E4' };
  return             { label: 'Low',         color: '#EF5350', bg: '#FFF0F0' };
}

export default function WeightTrackerScreen() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'ai_results', 'weight'),
      snap => { setData(snap.exists() ? snap.data() : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const history = data?.history ?? [];
  const last10  = history.slice(-10);
  const hasChart = last10.length >= 2;
  const status  = data?.weightG ? weightStatus(data.weightG) : null;

  // FCR (crude estimate): biomass / (days * feed per day assumed 150g)
  const fcrEstimate = data?.biomassKg
    ? (data.biomassKg / ((data.count ?? 3800) * 0.15)).toFixed(2)
    : '—';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#42A5F5" />

      {/* HEADER */}
      <View style={[s.header, { backgroundColor: '#42A5F5' }]}>
        <Text style={s.headerTitle}>⚖️  Weight Tracker</Text>
        <Text style={s.headerSub}>CSRNet Dual  ·  Density + weight heads</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#42A5F5" />
          <Text style={s.loadingText}>Waiting for model results…</Text>
        </View>
      ) : !data ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>No data yet</Text>
          <Text style={s.emptySub}>Run the weight model on the web dashboard.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* BIG WEIGHT */}
          <View style={s.bigCard}>
            <Text style={s.bigLabel}>Average Bird Weight</Text>
            <Text style={[s.bigValue, { color: '#42A5F5' }]}>
              {data.weightG ? `${data.weightG}g` : '—'}
            </Text>
            {status && (
              <View style={[s.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            )}
            <Text style={s.updatedAt}>Updated {timeAgo(data.updatedAt)}</Text>
          </View>

          {/* STAT ROW */}
          <View style={s.statRow}>
            <View style={[s.statCard, { backgroundColor: '#EEF6FF' }]}>
              <Text style={s.statIcon}>🐔</Text>
              <Text style={[s.statVal, { color: '#42A5F5' }]}>{data.count?.toLocaleString() ?? '—'}</Text>
              <Text style={s.statLbl}>Bird count</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#F8F0FB' }]}>
              <Text style={s.statIcon}>📦</Text>
              <Text style={[s.statVal, { color: '#AB47BC' }]}>{data.biomassKg ?? '—'} kg</Text>
              <Text style={s.statLbl}>Total biomass</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#EDF8EE' }]}>
              <Text style={s.statIcon}>📈</Text>
              <Text style={[s.statVal, { color: '#66BB6A' }]}>{fcrEstimate}</Text>
              <Text style={s.statLbl}>Est. FCR</Text>
            </View>
          </View>

          {/* WEIGHT CHART */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Weight trend (last {last10.length} readings)</Text>
            {hasChart ? (
              <LineChart
                data={{
                  labels: last10.map((_: any, i: number) =>
                    i === 0 || i === last10.length - 1 ? String(i + 1) : ''
                  ),
                  datasets: [
                    {
                      data: last10.map((h: any) => h.weightG ?? 0),
                      color: () => '#42A5F5',
                      strokeWidth: 2,
                    },
                  ],
                }}
                width={W - 64}
                height={180}
                chartConfig={{
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo:   '#fff',
                  color: (op = 1) => `rgba(66,165,245,${op})`,
                  labelColor: () => '#999',
                  decimalPlaces: 0,
                  propsForDots: { r: '4', stroke: '#42A5F5' },
                }}
                bezier
                withInnerLines={false}
                style={{ borderRadius: 12, marginLeft: -8 }}
                yAxisSuffix="g"
                yAxisLabel=""
              />
            ) : (
              <View style={s.chartEmpty}>
                <Text style={s.chartEmptyText}>Run the model 2+ times to see the weight trend.</Text>
              </View>
            )}
          </View>

          {/* BIOMASS CHART */}
          {hasChart && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Biomass trend (kg)</Text>
              <LineChart
                data={{
                  labels: last10.map((_: any, i: number) =>
                    i === 0 || i === last10.length - 1 ? String(i + 1) : ''
                  ),
                  datasets: [{
                    data: last10.map((h: any) => h.biomassKg ?? 0),
                    color: () => '#AB47BC',
                  }],
                }}
                width={W - 64}
                height={150}
                chartConfig={{
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo:   '#fff',
                  color: (op = 1) => `rgba(171,71,188,${op})`,
                  labelColor: () => '#999',
                  decimalPlaces: 1,
                  propsForDots: { r: '3', stroke: '#AB47BC' },
                }}
                bezier
                withInnerLines={false}
                style={{ borderRadius: 12, marginLeft: -8 }}
                yAxisSuffix=" kg"
                yAxisLabel=""
              />
            </View>
          )}

          {/* MODEL INFO */}
          <View style={s.infoCard}>
            <Text style={s.cardTitle}>Model info</Text>
            <Row label="Architecture" value="CSRNet Dual head" />
            <Row label="Heads"        value="Density + weight regression" />
            <Row label="Weight range" value="58g – 184g (trained)" />
            <Row label="Input size"   value="512 × 512 px" />
            <Row label="Last run"     value={timeAgo(data.updatedAt)} />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#FFF8E7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll: { padding: 16, paddingBottom: 40 },

  header: {
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, alignSelf: 'flex-start', marginTop: 12,
  },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1 },

  loadingText: { marginTop: 12, fontSize: 14, color: '#999' },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySub:    { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },

  bigCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    alignItems: 'center', marginTop: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  bigLabel:    { fontSize: 13, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  bigValue:    { fontSize: 58, fontWeight: '800', marginTop: 6 },
  statusPill:  { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  statusText:  { fontSize: 13, fontWeight: '700' },
  updatedAt:   { fontSize: 11, color: '#bbb', marginTop: 10 },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, borderRadius: 20, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statVal:  { fontSize: 16, fontWeight: '800' },
  statLbl:  { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 14 },

  chartEmpty:     { backgroundColor: '#FFF8E7', borderRadius: 12, padding: 20, alignItems: 'center' },
  chartEmptyText: { fontSize: 13, color: '#aaa', textAlign: 'center' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F5F0E8' },
  rowLabel: { fontSize: 13, color: '#888' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#333' },
});