// ─────────────────────────────────────────────────────────────
// Clean Modern Dashboard UI
// app/index.tsx
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';

import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─────────────────────────────────────────────────────────────
// Features
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────

const FEATURES = [
  {
    id: 'daily-record',
    title: 'Daily Record',
    desc: 'Feed, mortality and weight entries',
    icon: '📋',
    color: '#F5A623',
    light: '#FFF4E4',
  },
  {
    id: 'poop-detector',
    title: 'Poop Detector',
    desc: 'Analyze poultry droppings',
    icon: '💩',
    color: '#8D6E63',
    light: '#F5EFEC',
  },
  {
    id: 'weight-tracker',
    title: 'Weight Tracker',
    desc: 'Track weekly bird growth',
    icon: '⚖️',
    color: '#66BB6A',
    light: '#EDF8EE',
  },
  {
    id: 'ocr-scanner',
    title: 'OCR Scanner',
    desc: 'Scan handwritten reports',
    icon: '📷',
    color: '#42A5F5',
    light: '#EEF6FF',
  },
  {
    id: 'crowding-detection',
    title: 'Crowding Detection',
    desc: 'Detect stress and crowd density',
    icon: '⚠️',
    color: '#EF5350',
    light: '#FFF0F0',
  },
  {
    id: 'feeding-patterns',
    title: 'Feed Analysis',
    desc: 'Analyze feed consumption',
    icon: '🌾',
    color: '#AB47BC',
    light: '#F8F0FB',
  },
];

// ─────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;

  const [batchInfo, setBatchInfo] = useState({
    totalBirds: 3800,
    currentBirds: 3800,
    day: 1,
    lastABW: '—',
    farmName: "Digvijay's Farm",
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    loadBatchSummary();
  }, []);

  async function loadBatchSummary() {
    try {
      const batchRef = doc(
        db,
        'farms',
        'farm_001',
        'batches',
        'batch_001'
      );

      const snap = await getDoc(batchRef);

      if (snap.exists()) {
        const d = snap.data();

        const startDate = d.startDate?.toDate() ?? new Date();

        const dayNum = Math.max(
          1,
          Math.ceil(
            (new Date().getTime() - startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );

        setBatchInfo({
          totalBirds: d.totalBirds ?? 3800,
          currentBirds: d.currentOpeningBalance ?? 3800,
          day: dayNum,
          lastABW: d.lastABW ? `${d.lastABW}g` : '—',
          farmName: "Digvijay's Farm",
        });
      }
    } catch (e) {
      console.log(e);
    }
  }

  const mortality =
    batchInfo.totalBirds - batchInfo.currentBirds;

  const mortPct = (
    (mortality / batchInfo.totalBirds) *
    100
  ).toFixed(2);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF8E7"
      />

      {/* Header */}

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appName}>
              FeatherFarms
            </Text>

            <Text style={styles.farmName}>
              {batchInfo.farmName}
            </Text>
          </View>

          <View style={styles.dayBox}>
            <Text style={styles.dayNumber}>
              {batchInfo.day}
            </Text>

            <Text style={styles.dayText}>
              DAY
            </Text>
          </View>
        </View>

        {/* Stats */}

        <View style={styles.statsContainer}>
          <StatCard
            label="Total"
            value={String(batchInfo.totalBirds)}
          />

          <StatCard
            label="Live"
            value={String(batchInfo.currentBirds)}
          />

          <StatCard
            label="Mortality"
            value={`${mortPct}%`}
          />

          <StatCard
            label="ABW"
            value={batchInfo.lastABW}
          />
        </View>
      </View>

      {/* Body */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={styles.sectionTitle}>
            Farm Tools
          </Text>

          {/* Grid */}

          <View style={styles.grid}>
            {FEATURES.map((item) => (
              <FeatureCard
                key={item.id}
                item={item}
                onPress={() =>
                  router.push(`/${item.id}` as any)
                }
              />
            ))}
          </View>

          {/* Progress */}

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                Batch Progress
              </Text>

              <Text style={styles.progressDay}>
                Day {batchInfo.day} / 45
              </Text>
            </View>

            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      (batchInfo.day / 45) * 100
                    }%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.progressSub}>
              {45 - batchInfo.day} days remaining
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Feature Card
// ─────────────────────────────────────────────────────────────

function FeatureCard({
  item,
  onPress,
}: {
  item: (typeof FEATURES)[0];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[
        styles.card,
        { backgroundColor: item.light }
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: item.color }
        ]}
      >
        <Text style={styles.cardIcon}>
          {item.icon}
        </Text>
      </View>

      <Text style={styles.cardTitle}>
        {item.title}
      </Text>

      <Text style={styles.cardDesc}>
        {item.desc}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF8E7',
  },

  // Header

  header: {
    backgroundColor: '#F5A623',
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },

  farmName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  dayBox: {
    backgroundColor: '#fff',
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dayNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F5A623',
  },

  dayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F5A623',
    letterSpacing: 1,
  },

  // Stats

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },

  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },

  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  statLabel: {
    fontSize: 11,
    color: '#fff',
    marginTop: 4,
  },

  // Scroll

  scroll: {
    padding: 18,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 18,
  },
iconContainer: {
  width: 52,
  height: 52,
  borderRadius: 18,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 16,
},

cardIcon: {
  fontSize: 24,
},

  // Grid

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

card: {
  width: '48%',
  borderRadius: 24,
  padding: 18,
  marginBottom: 16,
  minHeight: 165,

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},



  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },

  cardDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#666',
  },

  // Progress

  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    marginTop: 8,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },

  progressDay: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F5A623',
  },

  progressBg: {
    height: 8,
    backgroundColor: '#ECECEC',
    borderRadius: 20,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#F5A623',
    borderRadius: 20,
  },

  progressSub: {
    marginTop: 10,
    fontSize: 12,
    color: '#777',
  },
});