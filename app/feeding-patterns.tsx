// app/feeding-patterns.tsx — with Supabase image display

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
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function alertMsg(a?: string) {
  if (a === 'normal')    return { icon: '✓',  text: 'All feeders active — feeding normal',      color: '#66BB6A', bg: '#EDF8EE' };
  if (a === 'warning')   return { icon: '⚠️', text: 'Low feeder activity — check feeders',       color: '#F5A623', bg: '#FFF4E4' };
  if (a === 'sick_bird') return { icon: '🔴', text: 'Sick bird alert — most feeders unused',     color: '#EF5350', bg: '#FFF0F0' };
  return                        { icon: '—',  text: 'No data',                                   color: '#aaa',    bg: '#f5f5f5' };
}

function feederColor(status: string) {
  if (status === 'empty')    return { text: '#EF5350', bg: '#FFF0F0', border: '#EF535044' };
  if (status === 'low')      return { text: '#F5A623', bg: '#FFF4E4', border: '#F5A62344' };
  if (status === 'crowded')  return { text: '#42A5F5', bg: '#EEF6FF', border: '#42A5F544' };
  return                            { text: '#66BB6A', bg: '#EDF8EE', border: '#66BB6A44' };
}

export default function FeedingPatternsScreen() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'ai_results', 'feeding'),
      snap => { setData(snap.exists() ? snap.data() : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const feeders     = data?.feeders ?? [];
  const history     = data?.history ?? [];
  const last8       = history.slice(-8);
  const alert       = alertMsg(data?.alert);
  const activityPct = data?.nFeeders
    ? Math.round(((data.nActive ?? 0) / data.nFeeders) * 100)
    : 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#AB47BC" />
      <View style={[s.header, { backgroundColor: '#AB47BC' }]}>
        <Text style={s.headerTitle}>🌾  Feed Analysis</Text>
        <Text style={s.headerSub}>HSV + CanNet ring method  ·  CV pipeline</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#AB47BC" />
          <Text style={s.loadingText}>Waiting for model results…</Text>
        </View>
      ) : !data ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>No data yet</Text>
          <Text style={s.emptySub}>Run the feeding model on the web dashboard.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ALERT */}
          <View style={[s.alertBanner, { backgroundColor: alert.bg }]}>
            <Text style={[s.alertText, { color: alert.color }]}>{alert.icon}  {alert.text}</Text>
          </View>

          {/* BIG ACTIVITY CIRCLE */}
          <View style={s.bigCard}>
            <Text style={s.bigLabel}>Feeder Activity</Text>
            <View style={[s.activityCircle, {
              borderColor: activityPct >= 70 ? '#66BB6A' : activityPct >= 40 ? '#F5A623' : '#EF5350'
            }]}>
              <Text style={[s.activityPct, {
                color: activityPct >= 70 ? '#66BB6A' : activityPct >= 40 ? '#F5A623' : '#EF5350'
              }]}>{activityPct}%</Text>
              <Text style={s.activitySub}>active</Text>
            </View>
            <Text style={s.updatedAt}>Updated {timeAgo(data.updatedAt)}</Text>
          </View>

          {/* STAT ROW */}
          <View style={s.statRow}>
            <View style={[s.statCard, { backgroundColor: '#F8F0FB' }]}>
              <Text style={s.statIcon}>🌾</Text>
              <Text style={[s.statVal, { color: '#AB47BC' }]}>{data.nFeeders ?? '—'}</Text>
              <Text style={s.statLbl}>Total feeders</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#EDF8EE' }]}>
              <Text style={s.statIcon}>✅</Text>
              <Text style={[s.statVal, { color: '#66BB6A' }]}>{data.nActive ?? '—'}</Text>
              <Text style={s.statLbl}>Active</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#FFF0F0' }]}>
              <Text style={s.statIcon}>❌</Text>
              <Text style={[s.statVal, { color: '#EF5350' }]}>{data.nInactive ?? '—'}</Text>
              <Text style={s.statLbl}>Inactive</Text>
            </View>
          </View>

          {/* ── FEEDER OVERLAY FRAME ── */}
          {data.overlay_url ? (
            <View style={s.imageCard}>
              <Text style={s.imageTitle}>🌾 Feeder detection overlay</Text>
              <Text style={s.imageSub}>
                {data.nActive ?? 0} of {data.nFeeders ?? 0} feeders occupied  ·  Updated {timeAgo(data.updatedAt)}
              </Text>
              <Image
                source={{ uri: data.overlay_url }}
                style={s.frameImg}
                resizeMode="contain"
              />
              <Text style={s.imageCaption}>
                Green = birds eating  ·  Blue = low activity  ·  Red = empty
              </Text>
            </View>
          ) : null}

          {/* PER FEEDER STATUS */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Per-feeder status</Text>
            <Text style={s.cardSub}>Bird activity score near each feeder</Text>
            <View style={s.feederGrid}>
              {feeders.length > 0 ? feeders.map((f: any, i: number) => {
                const c = feederColor(f.status);
                return (
                  <View key={i} style={[s.feederChip, { backgroundColor: c.bg, borderColor: c.border }]}>
                    <Text style={[s.feederNum,   { color: c.text }]}>F{f.feeder}</Text>
                    <Text style={[s.feederRatio, { color: c.text }]}>{f.ratio?.toFixed(2)}×</Text>
                    <Text style={[s.feederSt,    { color: c.text }]}>{f.status}</Text>
                  </View>
                );
              }) : (
                <Text style={s.noData}>No feeder data available</Text>
              )}
            </View>
            <View style={s.legend}>
              {[{ label:'Normal',color:'#66BB6A'},{ label:'Low',color:'#F5A623'},{ label:'Empty',color:'#EF5350'},{ label:'Crowded',color:'#42A5F5'}].map((l,i)=>(
                <View key={i} style={s.legendItem}>
                  <View style={[s.legendDot,{backgroundColor:l.color}]} />
                  <Text style={s.legendLbl}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* HISTORY CHART */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Active feeders over time</Text>
            {last8.length >= 2 ? (
              <BarChart
                data={{
                  labels: last8.map((_:any,i:number)=>String(i+1)),
                  datasets:[{data:last8.map((h:any)=>h.nActive??0)}],
                }}
                width={W-64} height={160}
                chartConfig={{ backgroundGradientFrom:'#fff', backgroundGradientTo:'#fff', color:(op=1)=>`rgba(171,71,188,${op})`, labelColor:()=>'#999', decimalPlaces:0, barPercentage:0.6 }}
                style={{ borderRadius:12, marginLeft:-8 }}
                showValuesOnTopOfBars yAxisLabel="" yAxisSuffix=" feeders"
              />
            ) : (
              <View style={s.chartEmpty}><Text style={s.chartEmptyText}>Run the model 2+ times to see history.</Text></View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#FFF8E7' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:        { padding: 16, paddingBottom: 40 },
  header:        { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTitle:   { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:     { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginTop: 12 },
  liveDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText:      { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  loadingText:   { marginTop: 12, fontSize: 14, color: '#999' },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySub:      { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  alertBanner:   { borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 12 },
  alertText:     { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  bigCard:       { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  bigLabel:      { fontSize: 13, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  activityCircle:{ width: 130, height: 130, borderRadius: 65, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  activityPct:   { fontSize: 34, fontWeight: '800' },
  activitySub:   { fontSize: 12, color: '#aaa', marginTop: 2 },
  updatedAt:     { fontSize: 11, color: '#bbb', marginTop: 14 },
  statRow:       { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:      { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statIcon:      { fontSize: 20, marginBottom: 6 },
  statVal:       { fontSize: 20, fontWeight: '800' },
  statLbl:       { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },
  imageCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  imageTitle:    { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2 },
  imageSub:      { fontSize: 11, color: '#aaa', marginBottom: 10 },
  frameImg:      { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#f5f0e0' },
  imageCaption:  { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8 },
  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  cardSub:       { fontSize: 12, color: '#aaa', marginBottom: 14 },
  feederGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feederChip:    { width: '30%', borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center' },
  feederNum:     { fontSize: 12, fontWeight: '700' },
  feederRatio:   { fontSize: 20, fontWeight: '800', marginTop: 2 },
  feederSt:      { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  noData:        { fontSize: 13, color: '#aaa', padding: 20, textAlign: 'center' },
  legend:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 10, height: 10, borderRadius: 5 },
  legendLbl:     { fontSize: 11, color: '#666' },
  chartEmpty:    { backgroundColor: '#FFF8E7', borderRadius: 12, padding: 20, alignItems: 'center' },
  chartEmptyText:{ fontSize: 13, color: '#aaa', textAlign: 'center' },
});