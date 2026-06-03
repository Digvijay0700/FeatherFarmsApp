// app/index.tsx — pulls live data from daily_records collection

import { useRouter } from 'expo-router';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../firebaseConfig';

const FEATURES = [
  { id:'daily-record',       title:'Daily Record',       desc:'Feed, mortality and weight entries',  icon:'📋', color:'#F5A623', light:'#FFF4E4' },
  { id:'counting',           title:'Bird Count',         desc:'AI-powered bird counting',            icon:'🐔', color:'#8D6E63', light:'#F5EFEC' },
  { id:'weight-tracker',     title:'Weight Tracker',     desc:'Track weekly bird growth',            icon:'⚖️', color:'#66BB6A', light:'#EDF8EE' },
  { id:'crowding-detection', title:'Crowding Detection', desc:'Detect stress and crowd density',     icon:'⚠️', color:'#EF5350', light:'#FFF0F0' },
  { id:'feeding-patterns',   title:'Feed Analysis',      desc:'Feeder occupancy monitoring',         icon:'🌾', color:'#AB47BC', light:'#F8F0FB' },
  { id:'alerts',             title:'Alerts',             desc:'Live farm alerts',                    icon:'🔔', color:'#42A5F5', light:'#EEF6FF' },
];

export default function HomeScreen() {
  const router = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;

  const [info, setInfo] = useState({
    farmName:     "Digvijay's Farm",
    totalBirds:   4794,
    currentBirds: 4794,
    currentDay:   1,
    lastABW:      '—',
    lastFCR:      '—',
    cumMort:      0,
    mortPct:      '0.00',
    cumFeed:      0,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:500, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:500, useNativeDriver:true }),
    ]).start();

    loadLiveData();
  }, []);

  function loadLiveData() {
    // Listen to latest daily_record (highest day number)
    const q = query(
      collection(db, 'farms', 'farm_001', 'batches', 'batch_001', 'daily_records'),
      orderBy('day', 'desc'),
      limit(1),
    );

    onSnapshot(q, async snap => {
      // Also get batch info for totalBirds
      const batchSnap = await getDoc(doc(db, 'farms', 'farm_001', 'batches', 'batch_001'));
      const batch = batchSnap.exists() ? batchSnap.data() : {};
      const totalBirds = batch.totalBirds ?? rec.op_bal ?? 1000;
      const farmName   = batch.name ?? "Digvijay's Farm";

      if (snap.empty) {
        // No records yet — show batch defaults
        setInfo(prev => ({
          ...prev,
          farmName,
          totalBirds,
          currentBirds: batch.currentOpeningBalance ?? totalBirds,
          currentDay:   batch.lastDay ?? 1,
        }));
        return;
      }

      const latest = snap.docs[0].data();
      const currentBirds = (latest.op_bal ?? totalBirds) - (latest.mortality_daily ?? 0);
      const cumMort = latest.mortality_cum ?? 0;
      const mortPct = ((cumMort / totalBirds) * 100).toFixed(2);

      setInfo({
        farmName,
        totalBirds,
        currentBirds,
        currentDay:   latest.day ?? 1,
        lastABW:      latest.abw_act ? `${latest.abw_act}g` : '—',
        lastFCR:      latest.fcr_act ? String(latest.fcr_act) : '—',
        cumMort,
        mortPct,
        cumFeed:      latest.cum_consume ?? 0,
      });
    });
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8E7" />

      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.appName}>FeatherFarms</Text>
            <Text style={s.farmName}>{info.farmName}</Text>
          </View>
          <View style={s.dayBox}>
            <Text style={s.dayNumber}>{info.currentDay}</Text>
            <Text style={s.dayText}>DAY</Text>
          </View>
        </View>

        {/* STAT CARDS */}
        <View style={s.statsRow}>
          <StatCard label="Total"    value={info.totalBirds.toLocaleString()} />
          <StatCard label="Live"     value={info.currentBirds.toLocaleString()} />
          <StatCard label="Mort %"   value={`${info.mortPct}%`} />
          <StatCard label="ABW"      value={info.lastABW} />
        </View>

        {/* SECOND ROW */}
        <View style={s.statsRow}>
          <StatCard label="Cum Mort"  value={String(info.cumMort)} />
          <StatCard label="FCR"       value={info.lastFCR} />
          <StatCard label="Feed bags" value={String(info.cumFeed)} />
          <StatCard label="Days left" value={String(45 - info.currentDay)} />
        </View>
      </View>

      {/* BODY */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>

          <Text style={s.sectionTitle}>Farm Tools</Text>

          <View style={s.grid}>
            {FEATURES.map(item => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                style={[s.card, { backgroundColor:item.light }]}
                onPress={() => router.push(`/${item.id}` as any)}
              >
                <View style={[s.iconBox, { backgroundColor:item.color }]}>
                  <Text style={s.cardIcon}>{item.icon}</Text>
                </View>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.cardDesc}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* BATCH PROGRESS */}
          <View style={s.progressCard}>
            <View style={s.progressHeader}>
              <Text style={s.progressTitle}>Batch Progress</Text>
              <Text style={s.progressDay}>Day {info.currentDay} / 45</Text>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width:`${(info.currentDay/45)*100}%` }]} />
            </View>
            <Text style={s.progressSub}>{45 - info.currentDay} days remaining to slaughter</Text>
          </View>

          {/* QUICK STATS */}
          <View style={s.quickRow}>
            <View style={[s.quickCard, { backgroundColor:'#EDF8EE' }]}>
              <Text style={s.quickVal}>{info.lastFCR}</Text>
              <Text style={s.quickLbl}>Latest FCR</Text>
            </View>
            <View style={[s.quickCard, { backgroundColor:'#FFF4E4' }]}>
              <Text style={s.quickVal}>{info.cumFeed}</Text>
              <Text style={s.quickLbl}>Feed bags used</Text>
            </View>
            <View style={[s.quickCard, { backgroundColor:'#FFF0F0' }]}>
              <Text style={s.quickVal}>{info.cumMort}</Text>
              <Text style={s.quickLbl}>Total mortality</Text>
            </View>
          </View>

          <View style={{ height:40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label:string; value:string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex:1, backgroundColor:'#FFF8E7' },
  scroll: { padding:18 },

  header: { backgroundColor:'#F5A623', paddingTop:55, paddingHorizontal:20, paddingBottom:20, borderBottomLeftRadius:30, borderBottomRightRadius:30 },
  headerRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  appName:    { fontSize:26, fontWeight:'800', color:'#fff' },
  farmName:   { fontSize:13, color:'rgba(255,255,255,0.8)', marginTop:4 },
  dayBox:     { backgroundColor:'#fff', width:72, height:72, borderRadius:20, justifyContent:'center', alignItems:'center' },
  dayNumber:  { fontSize:26, fontWeight:'800', color:'#F5A623' },
  dayText:    { fontSize:10, fontWeight:'700', color:'#F5A623', letterSpacing:1 },
  statsRow:   { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  statCard:   { flex:1, backgroundColor:'rgba(255,255,255,0.22)', paddingVertical:10, borderRadius:14, marginHorizontal:3, alignItems:'center' },
  statValue:  { fontSize:14, fontWeight:'800', color:'#fff' },
  statLabel:  { fontSize:10, color:'rgba(255,255,255,0.85)', marginTop:2 },

  sectionTitle: { fontSize:20, fontWeight:'700', color:'#222', marginBottom:16, marginTop:8 },
  grid:  { flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between' },
  card:  { width:'48%', borderRadius:22, padding:16, marginBottom:14, minHeight:150, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, elevation:2 },
  iconBox:   { width:48, height:48, borderRadius:16, justifyContent:'center', alignItems:'center', marginBottom:12 },
  cardIcon:  { fontSize:22 },
  cardTitle: { fontSize:15, fontWeight:'700', color:'#222', marginBottom:6 },
  cardDesc:  { fontSize:12, color:'#666', lineHeight:18 },

  progressCard:   { backgroundColor:'#fff', borderRadius:20, padding:18, marginTop:4, marginBottom:12, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:8, elevation:2 },
  progressHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom:12 },
  progressTitle:  { fontSize:15, fontWeight:'700', color:'#222' },
  progressDay:    { fontSize:13, fontWeight:'600', color:'#F5A623' },
  progressBg:     { height:8, backgroundColor:'#ECECEC', borderRadius:20, overflow:'hidden' },
  progressFill:   { height:'100%', backgroundColor:'#F5A623', borderRadius:20 },
  progressSub:    { marginTop:8, fontSize:12, color:'#777' },

  quickRow:  { flexDirection:'row', gap:10, marginBottom:8 },
  quickCard: { flex:1, borderRadius:16, padding:14, alignItems:'center' },
  quickVal:  { fontSize:18, fontWeight:'800', color:'#333' },
  quickLbl:  { fontSize:10, color:'#888', marginTop:4, textAlign:'center' },
});