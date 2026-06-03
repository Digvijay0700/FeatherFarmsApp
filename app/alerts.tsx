// app/alerts.tsx — with Supabase image display in alert cards

import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { db } from '../firebaseConfig';

const FARM_ID  = 'farm_001';
const BATCH_ID = 'batch_001';

function timeAgo(ts: any): string {
  if (!ts) return 'Just now';
  let date: Date;
  if (ts?.toDate)              date = ts.toDate();
  else if (typeof ts==='string') date = new Date(ts);
  else                         date = new Date(ts);
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10)   return 'Just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

function alertConfig(type: string) {
  const map: Record<string,any> = {
    crowding:     { icon:'🚨', title:'Crowding Alert',      color:'#EF5350', bg:'#FFF0F0', border:'#EF535033', action:'Redistribute birds in the flagged zones immediately.' },
    empty_feeder: { icon:'⚠️', title:'Empty Feeder Alert',  color:'#F5A623', bg:'#FFF4E4', border:'#F5A62333', action:'Refill feeders — birds missing feeding window.' },
    lame_bird:    { icon:'🐔', title:'Lame Bird Detected',  color:'#AB47BC', bg:'#F8F0FB', border:'#AB47BC33', action:'Inspect and isolate the affected bird.' },
    sick_bird:    { icon:'🔴', title:'Sick Bird Alert',     color:'#EF5350', bg:'#FFF0F0', border:'#EF535033', action:'Most feeders unused — check flock health urgently.' },
  };
  return map[type] ?? { icon:'🔔', title:'Farm Alert', color:'#42A5F5', bg:'#EEF6FF', border:'#42A5F533', action:'Check the dashboard for details.' };
}

function AlertCard({ alert, onAck }: { alert: any; onAck: () => void }) {
  const cfg      = alertConfig(alert.type);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, { toValue:1, useNativeDriver:true, tension:80, friction:8 }).start();
  }, []);

  const sevLabel = alert.severity>=3 ? 'HIGH' : alert.severity>=2 ? 'MED' : 'LOW';

  return (
    <Animated.View style={[
      s.alertCard,
      { backgroundColor:cfg.bg, borderColor:cfg.border },
      { opacity:fadeAnim, transform:[{ scale:fadeAnim }] },
      alert.acknowledged && s.alertAcked,
    ]}>
      <View style={[s.stripe, { backgroundColor:cfg.color }]} />
      <View style={s.cardBody}>

        {/* Header */}
        <View style={s.cardHeader}>
          <Text style={s.cardIcon}>{cfg.icon}</Text>
          <View style={{ flex:1 }}>
            <Text style={[s.cardTitle, { color:cfg.color }]}>{cfg.title}</Text>
            <Text style={s.cardTime}>{timeAgo(alert.timestamp)}</Text>
          </View>
          <View style={[s.sevBadge, { backgroundColor:cfg.color }]}>
            <Text style={s.sevText}>{sevLabel}</Text>
          </View>
        </View>

        {/* Message */}
        <Text style={s.cardMsg}>{alert.message || 'No details provided.'}</Text>

        {/* Meta chips */}
        <View style={s.metaRow}>
          {alert.cam && (
            <View style={s.chip}><Text style={s.chipText}>📷 {String(alert.cam).toUpperCase()}</Text></View>
          )}
          {Array.isArray(alert.zones) && alert.zones.length > 0 && (
            <View style={s.chip}>
              <Text style={s.chipText}>📍 Zone {alert.zones.map((z:any)=>`(${z.row},${z.col})`).join(' ')}</Text>
            </View>
          )}
        </View>

        {/* ── FRAME AT TIME OF ALERT ── */}
        {alert.overlay_url ? (
          <View style={s.frameBox}>
            <Text style={s.frameLabel}>FRAME AT TIME OF ALERT</Text>
            <Image
              source={{ uri: alert.overlay_url }}
              style={s.frameImg}
              resizeMode="contain"
            />
          </View>
        ) : alert.frame_url ? (
          <View style={s.frameBox}>
            <Text style={s.frameLabel}>FRAME AT TIME OF ALERT</Text>
            <Image
              source={{ uri: alert.frame_url }}
              style={s.frameImg}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {/* Action */}
        <View style={[s.actionBox, { borderLeftColor:cfg.color }]}>
          <Text style={s.actionLabel}>RECOMMENDED ACTION</Text>
          <Text style={s.actionText}>{cfg.action}</Text>
        </View>

        {/* Ack */}
        {!alert.acknowledged ? (
          <TouchableOpacity style={[s.ackBtn, { backgroundColor:cfg.color }]} onPress={onAck} activeOpacity={0.8}>
            <Text style={s.ackBtnText}>✓  Mark as Handled</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.ackedRow}><Text style={s.ackedText}>✓ Handled</Text></View>
        )}
      </View>
    </Animated.View>
  );
}

export default function AlertsScreen() {
  const [alerts, setAlerts]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const prevUnacked           = useRef(0);

  useEffect(() => {
    const q = query(
      collection(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q,
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAlerts(docs);
        setLoading(false);
        const unackedNow = docs.filter((a:any) => !a.acknowledged).length;
        if (unackedNow > prevUnacked.current) Vibration.vibrate([0, 300, 100, 300]);
        prevUnacked.current = unackedNow;
      },
      err => { console.error('Alerts error:', err); setLoading(false); },
    );
    return () => unsub();
  }, []);

  async function acknowledge(docId: string) {
    try {
      await updateDoc(doc(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'alerts', docId), { acknowledged: true });
    } catch(e) { console.error('Ack failed:', e); }
  }

  const unacked   = alerts.filter(a => !a.acknowledged);
  const displayed = showAll ? alerts : unacked;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#EF5350" />
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>🔔  Alerts</Text>
          {unacked.length > 0 && (
            <View style={s.countBadge}><Text style={s.countText}>{unacked.length}</Text></View>
          )}
        </View>
        <Text style={s.headerSub}>
          {unacked.length === 0 ? 'All clear — no active alerts'
            : `${unacked.length} alert${unacked.length>1?'s':''} need attention`}
        </Text>
        <TouchableOpacity style={s.toggleBtn} onPress={() => setShowAll(v=>!v)}>
          <Text style={s.toggleText}>
            {showAll ? `Active only (${unacked.length})` : `Show all (${alerts.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EF5350" />
          <Text style={s.loadingText}>Listening for alerts…</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize:52, marginBottom:12 }}>✅</Text>
          <Text style={s.emptyTitle}>{showAll ? 'No alerts yet' : 'No active alerts'}</Text>
          <Text style={s.emptySub}>
            {showAll ? 'Alerts appear when triggered from the dashboard.'
              : `${alerts.length - unacked.length} resolved. Tap "Show all" to view.`}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {displayed.map(alert => (
            <AlertCard key={alert.id} alert={alert} onAck={() => acknowledge(alert.id)} />
          ))}
          <View style={s.hint}>
            <Text style={s.hintText}>
              💡  Trigger from laptop:{'\n'}
              Ctrl+Shift+A → Crowding{'\n'}
              Ctrl+Shift+F → Empty feeder{'\n'}
              Ctrl+Shift+L → Lame bird
            </Text>
          </View>
          <View style={{ height:40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:'#FFF8E7' },
  center:      { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  scroll:      { padding:16, paddingBottom:40 },
  header:      { backgroundColor:'#EF5350', paddingTop:55, paddingHorizontal:20, paddingBottom:24, borderBottomLeftRadius:28, borderBottomRightRadius:28 },
  headerRow:   { flexDirection:'row', alignItems:'center', gap:10 },
  headerTitle: { fontSize:24, fontWeight:'800', color:'#fff' },
  headerSub:   { fontSize:13, color:'rgba(255,255,255,0.85)', marginTop:4 },
  countBadge:  { backgroundColor:'#fff', borderRadius:12, paddingHorizontal:8, paddingVertical:2 },
  countText:   { fontSize:13, fontWeight:'800', color:'#EF5350' },
  toggleBtn:   { marginTop:12, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:20, paddingHorizontal:14, paddingVertical:6, alignSelf:'flex-start' },
  toggleText:  { fontSize:12, color:'#fff', fontWeight:'600' },
  loadingText: { marginTop:12, fontSize:14, color:'#999' },
  emptyTitle:  { fontSize:18, fontWeight:'700', color:'#333', marginBottom:8 },
  emptySub:    { fontSize:14, color:'#888', textAlign:'center', lineHeight:22 },
  alertCard:   { borderRadius:20, borderWidth:1.5, flexDirection:'row', marginBottom:14, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, elevation:3 },
  alertAcked:  { opacity:0.5 },
  stripe:      { width:5 },
  cardBody:    { flex:1, padding:16 },
  cardHeader:  { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:10 },
  cardIcon:    { fontSize:26, marginTop:2 },
  cardTitle:   { fontSize:15, fontWeight:'800' },
  cardTime:    { fontSize:11, color:'#aaa', marginTop:2 },
  sevBadge:    { paddingHorizontal:8, paddingVertical:3, borderRadius:10, alignSelf:'flex-start' },
  sevText:     { fontSize:10, fontWeight:'800', color:'#fff', letterSpacing:0.5 },
  cardMsg:     { fontSize:13, color:'#444', lineHeight:20, marginBottom:10 },
  metaRow:     { flexDirection:'row', gap:8, marginBottom:10, flexWrap:'wrap' },
  chip:        { backgroundColor:'rgba(0,0,0,0.06)', borderRadius:10, paddingHorizontal:10, paddingVertical:4 },
  chipText:    { fontSize:11, color:'#555', fontWeight:'600' },
  frameBox:    { marginBottom:12 },
  frameLabel:  { fontSize:10, fontWeight:'700', color:'#aaa', letterSpacing:0.5, marginBottom:6 },
  frameImg:    { width:'100%', height:180, borderRadius:12, backgroundColor:'#f5f0e0' },
  actionBox:   { borderLeftWidth:3, paddingLeft:10, marginBottom:14 },
  actionLabel: { fontSize:10, fontWeight:'700', color:'#aaa', letterSpacing:0.5, marginBottom:3 },
  actionText:  { fontSize:13, color:'#333', lineHeight:19 },
  ackBtn:      { borderRadius:14, paddingVertical:11, alignItems:'center' },
  ackBtnText:  { fontSize:13, fontWeight:'700', color:'#fff' },
  ackedRow:    { alignItems:'center', paddingVertical:6 },
  ackedText:   { fontSize:12, color:'#aaa', fontWeight:'600' },
  hint:        { backgroundColor:'#F5F0E0', borderRadius:14, padding:14, marginTop:8 },
  hintText:    { fontSize:12, color:'#888', lineHeight:20 },
});