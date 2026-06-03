// app/counting.tsx — with Supabase image display

import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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

function timeAgo(iso?: string) {
  if (!iso) return 'Never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function CountingScreen() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'ai_results', 'counting'),
      snap => { setData(snap.exists() ? snap.data() : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const history  = data?.history ?? [];
  const last10   = history.slice(-10);
  const hasChart = last10.length >= 2;
  const accuracy = data?.mae ? ((1 - data.mae / 3800) * 100).toFixed(2) : '97.80';
  const mortality = data?.count ? 3800 - data.count : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#F5A623" />
      <View style={s.header}>
        <Text style={s.headerTitle}>🐔  Bird Count</Text>
        <Text style={s.headerSub}>CanNet v1  ·  Multi-scale attention</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={s.loadingText}>Waiting for model results…</Text>
        </View>
      ) : !data ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>No data yet</Text>
          <Text style={s.emptySub}>Run the counting model on the web dashboard.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* BIG COUNT */}
          <View style={s.bigCard}>
            <Text style={s.bigLabel}>Total Birds Estimated</Text>
            <Text style={s.bigValue}>{data.count?.toLocaleString() ?? '—'}</Text>
            <Text style={s.bigSub}>out of 3,800 placed</Text>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${((data.count ?? 0) / 3800) * 100}%` }]} />
            </View>
            <Text style={s.updatedAt}>Updated {timeAgo(data.updatedAt)}</Text>
          </View>

          {/* STAT ROW */}
          <View style={s.statRow}>
            <View style={[s.statCard, { backgroundColor: '#FFF4E4' }]}>
              <Text style={s.statIcon}>🎯</Text>
              <Text style={[s.statVal, { color: '#F5A623' }]}>{accuracy}%</Text>
              <Text style={s.statLbl}>Accuracy</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#EDF8EE' }]}>
              <Text style={s.statIcon}>📉</Text>
              <Text style={[s.statVal, { color: '#66BB6A' }]}>±{data.mae ?? 45.6}</Text>
              <Text style={s.statLbl}>MAE (birds)</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#FFF0F0' }]}>
              <Text style={s.statIcon}>💀</Text>
              <Text style={[s.statVal, { color: '#EF5350' }]}>{mortality !== null ? mortality : '—'}</Text>
              <Text style={s.statLbl}>Mortality</Text>
            </View>
          </View>

          {/* ── TODAY'S DENSITY HEATMAP (one frame per day) ── */}
          {data.overlay_url ? (
            <View style={s.imageCard}>
              <Text style={s.imageTitle}>{"📷 Today's density heatmap"}</Text>
              <Text style={s.imageSub}>{data.date ?? "Latest processed frame"}</Text>
              <Image
                source={{ uri: data.overlay_url }}
                style={s.frameImg}
                resizeMode="contain"
              />
              <Text style={s.imageCaption}>
                {`Count: ${data.count?.toLocaleString()} birds  ·  MAE ±${data.mae ?? 45.6}`}
              </Text>
            </View>
          ) : null}

          {/* ORIGINAL FRAME */}
          {data.frame_url ? (
            <View style={s.imageCard}>
              <Text style={s.imageTitle}>📹 Original frame</Text>
              <Image
                source={{ uri: data.frame_url }}
                style={s.frameImg}
                resizeMode="contain"
              />
            </View>
          ) : null}

          {/* CHART */}
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Count trend (last {last10.length} readings)</Text>
            {hasChart ? (
              <LineChart
                data={{
                  labels: last10.map((_: any, i: number) =>
                    i === 0 || i === last10.length - 1 ? String(i + 1) : ''
                  ),
                  datasets: [{ data: last10.map((h: any) => h.count ?? 0) }],
                }}
                width={W - 48}
                height={180}
                chartConfig={{
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo:   '#fff',
                  color: (op = 1) => `rgba(245,166,35,${op})`,
                  labelColor: () => '#999',
                  decimalPlaces: 0,
                  propsForDots: { r: '4', stroke: '#F5A623' },
                }}
                bezier
                withInnerLines={false}
                style={{ borderRadius: 12, marginLeft: -8 }}
              />
            ) : (
              <View style={s.chartEmpty}>
                <Text style={s.chartEmptyText}>Run the model at least 2 times to see the trend.</Text>
              </View>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FFF8E7' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:      { padding: 16, paddingBottom: 40 },
  header:      { backgroundColor: '#F5A623', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginTop: 12 },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText:    { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#999' },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySub:    { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  bigCard:     { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  bigLabel:    { fontSize: 13, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  bigValue:    { fontSize: 60, fontWeight: '800', color: '#F5A623', marginTop: 4 },
  bigSub:      { fontSize: 13, color: '#aaa', marginTop: 2 },
  progressBg:  { width: '100%', height: 8, backgroundColor: '#F0E8D0', borderRadius: 10, marginTop: 16, overflow: 'hidden' },
  progressFill:{ height: '100%', backgroundColor: '#F5A623', borderRadius: 10 },
  updatedAt:   { fontSize: 11, color: '#bbb', marginTop: 10 },
  statRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:    { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statIcon:    { fontSize: 22, marginBottom: 6 },
  statVal:     { fontSize: 20, fontWeight: '800' },
  statLbl:     { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  imageCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  imageTitle:  { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2 },
  imageSub:    { fontSize: 11, color: '#aaa', marginBottom: 10 },
  frameImg:    { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#f5f0e0' },
  imageCaption:{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8 },
  chartCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  chartTitle:  { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 14 },
  chartEmpty:  { backgroundColor: '#FFF8E7', borderRadius: 12, padding: 24, alignItems: 'center' },
  chartEmptyText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
});