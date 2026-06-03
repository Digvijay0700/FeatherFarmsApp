// app/crowding-detection.tsx — with Supabase image display

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
import { BarChart } from 'react-native-chart-kit';
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

function alertColor(a?: string) {
  if (a === 'normal') return '#66BB6A';
  if (a === 'dense')  return '#F5A623';
  return '#EF5350';
}
function alertBg(a?: string) {
  if (a === 'normal') return '#EDF8EE';
  if (a === 'dense')  return '#FFF4E4';
  return '#FFF0F0';
}
function alertMsg(a?: string) {
  if (a === 'normal')      return '✓  All zones are evenly distributed';
  if (a === 'dense')       return '⚠️  Dense zones detected — monitor closely';
  if (a === 'overcrowded') return '🔴  Overcrowded — redistribute birds now';
  return '—';
}

export default function CrowdingDetectionScreen() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'ai_results', 'crowding'),
      snap => { setData(snap.exists() ? snap.data() : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const zones   = data?.zones   ?? [];
  const history = data?.history ?? [];
  const last8   = history.slice(-8);

  function zoneStyle(status: string) {
    if (status === 'overcrowded') return { bg: '#FFF0F0', border: '#EF535055', text: '#EF5350' };
    if (status === 'dense')       return { bg: '#FFF4E4', border: '#F5A62355', text: '#F5A623' };
    return                               { bg: '#EDF8EE', border: '#66BB6A55', text: '#66BB6A' };
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#EF5350" />
      <View style={[s.header, { backgroundColor: '#EF5350' }]}>
        <Text style={s.headerTitle}>⚠️  Crowding Detection</Text>
        <Text style={s.headerSub}>CanNet v1  ·  3 × 3 zone grid</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EF5350" />
          <Text style={s.loadingText}>Waiting for model results…</Text>
        </View>
      ) : !data ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>No data yet</Text>
          <Text style={s.emptySub}>Run the crowding model on the web dashboard.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ALERT BANNER */}
          <View style={[s.alertBanner, { backgroundColor: alertBg(data.alert) }]}>
            <Text style={[s.alertText, { color: alertColor(data.alert) }]}>
              {alertMsg(data.alert)}
            </Text>
          </View>

          {/* STAT ROW */}
          <View style={s.statRow}>
            <View style={[s.statCard, { backgroundColor: '#FFF4E4' }]}>
              <Text style={s.statIcon}>🐔</Text>
              <Text style={[s.statVal, { color: '#F5A623' }]}>{data.totalCount?.toLocaleString() ?? '—'}</Text>
              <Text style={s.statLbl}>Total count</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#FFF0F0' }]}>
              <Text style={s.statIcon}>🔴</Text>
              <Text style={[s.statVal, { color: '#EF5350' }]}>{data.nOvercrowded ?? '—'}</Text>
              <Text style={s.statLbl}>Overcrowded</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#FFF4E4' }]}>
              <Text style={s.statIcon}>🟠</Text>
              <Text style={[s.statVal, { color: '#F5A623' }]}>{data.nDense ?? '—'}</Text>
              <Text style={s.statLbl}>Dense zones</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#EDF8EE' }]}>
              <Text style={s.statIcon}>📊</Text>
              <Text style={[s.statVal, { color: '#66BB6A' }]}>{data.expectedPerZone ?? '—'}</Text>
              <Text style={s.statLbl}>Exp / zone</Text>
            </View>
          </View>

          {/* ── CROWDING OVERLAY FRAME ── */}
          {data.overlay_url ? (
            <View style={s.imageCard}>
              <Text style={s.imageTitle}>
                {data.alert === 'overcrowded' ? '🚨 Crowding detected — live frame' :
                 data.alert === 'dense'        ? '⚠️ Dense zones — live frame' :
                 '✓ Zone overlay — live frame'}
              </Text>
              <Text style={s.imageSub}>Updated {timeAgo(data.updatedAt)}</Text>
              <Image
                source={{ uri: data.overlay_url }}
                style={s.frameImg}
                resizeMode="contain"
              />
            </View>
          ) : null}

          {/* ZONE GRID */}
          <View style={s.card}>
            <Text style={s.cardTitle}>3 × 3 Zone breakdown</Text>
            <Text style={s.cardSub}>Each cell = ~170×170 px of the shed frame</Text>
            <View style={s.zoneGrid}>
              {zones.length > 0 ? zones.map((z: any, i: number) => {
                const st = zoneStyle(z.status);
                return (
                  <View key={i} style={[s.zoneCell, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <Text style={[s.zoneCnt, { color: st.text }]}>{z.count}</Text>
                    <Text style={[s.zoneSt,  { color: st.text }]}>{z.status}</Text>
                    <Text style={s.zoneRatio}>{z.ratio}×</Text>
                  </View>
                );
              }) : (
                <Text style={s.noZones}>Zone data not available</Text>
              )}
            </View>
            <View style={s.legend}>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#66BB6A' }]} /><Text style={s.legendLbl}>Normal</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#F5A623' }]} /><Text style={s.legendLbl}>Dense</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#EF5350' }]} /><Text style={s.legendLbl}>Overcrowded</Text></View>
            </View>
          </View>

          {/* HISTORY CHART */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Alert history (last {last8.length} runs)</Text>
            {last8.length >= 2 ? (
              <BarChart
                data={{
                  labels: last8.map((_: any, i: number) => String(i + 1)),
                  datasets: [{ data: last8.map((h: any) => (h.nOvercrowded ?? 0) + (h.nDense ?? 0)) }],
                }}
                width={W - 64}
                height={160}
                chartConfig={{
                  backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
                  color: (op = 1) => `rgba(239,83,80,${op})`,
                  labelColor: () => '#999', decimalPlaces: 0, barPercentage: 0.6,
                }}
                style={{ borderRadius: 12, marginLeft: -8 }}
                showValuesOnTopOfBars
                yAxisLabel="" yAxisSuffix=" zones"
              />
            ) : (
              <View style={s.chartEmpty}>
                <Text style={s.chartEmptyText}>Run the model 2+ times to see history</Text>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FFF8E7' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:      { padding: 16, paddingBottom: 40 },
  header:      { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginTop: 12 },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText:    { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#999' },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySub:    { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  alertBanner: { borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 12 },
  alertText:   { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  statRow:     { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:    { flex: 1, borderRadius: 18, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statIcon:    { fontSize: 18, marginBottom: 4 },
  statVal:     { fontSize: 18, fontWeight: '800' },
  statLbl:     { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },
  imageCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  imageTitle:  { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2 },
  imageSub:    { fontSize: 11, color: '#aaa', marginBottom: 10 },
  frameImg:    { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#f5f0e0' },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  cardSub:     { fontSize: 12, color: '#aaa', marginBottom: 14 },
  zoneGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneCell:    { width: '31%', borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', marginBottom: 4 },
  zoneCnt:     { fontSize: 20, fontWeight: '800' },
  zoneSt:      { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  zoneRatio:   { fontSize: 11, color: '#aaa', marginTop: 2 },
  noZones:     { fontSize: 13, color: '#aaa', padding: 20, textAlign: 'center' },
  legend:      { flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendLbl:   { fontSize: 11, color: '#666' },
  chartEmpty:  { backgroundColor: '#FFF8E7', borderRadius: 12, padding: 20, alignItems: 'center' },
  chartEmptyText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
});