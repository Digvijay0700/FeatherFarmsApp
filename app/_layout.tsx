import { Stack, router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StatusBar, StyleSheet, Text, TouchableOpacity, Vibration } from 'react-native';

import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const FARM_ID  = 'farm_001';
const BATCH_ID = 'batch_001';

function GlobalAlertBanner() {
  const [alert, setAlert]   = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const q = query(
      collection(db, 'farms', FARM_ID, 'batches', BATCH_ID, 'alerts'),
      where('acknowledged', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1),
    );

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setAlert(data);
        setVisible(true);
        Vibration.vibrate([0, 400, 100, 400]);
        // Slide in
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, tension: 80
        }).start();
      } else {
        // Slide out
        Animated.timing(slideAnim, {
          toValue: -100, duration: 300, useNativeDriver: true
        }).start(() => { setVisible(false); setAlert(null); });
      }
    });

    return () => unsub();
  }, []);

  if (!visible || !alert) return null;

  const color = alert.type === 'crowding' ? '#EF5350'
              : alert.type === 'empty_feeder' ? '#F5A623'
              : '#AB47BC';
  const icon  = alert.type === 'crowding' ? '🚨'
              : alert.type === 'empty_feeder' ? '⚠️' : '🐔';

  return (
    <Animated.View style={[b.banner, { backgroundColor: color, transform: [{ translateY: slideAnim }] }]}>
      <Text style={b.icon}>{icon}</Text>
      <Text style={b.msg} numberOfLines={1}>{alert.message}</Text>
      <TouchableOpacity onPress={() => router.push('/alerts')} style={b.viewBtn}>
        <Text style={b.viewText}>View</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const b = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, gap: 10,
  },
  icon:    { fontSize: 20 },
  msg:     { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
  viewBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  viewText:{ color: '#fff', fontWeight: '700', fontSize: 12 },
});

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8E1" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFF8E1' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="daily-record" />
        <Stack.Screen name="weight-tracker" />
        <Stack.Screen name="counting" />
        <Stack.Screen name="crowding-detection" />
        <Stack.Screen name="feeding-patterns" />
        <Stack.Screen name="alerts" />
      </Stack>
      <GlobalAlertBanner />
    </>
  );
}