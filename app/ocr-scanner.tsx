import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export function OCRScanner() {
  const router = useRouter();
  return (
    <View style={ph.root}>
      <TouchableOpacity onPress={() => router.back()} style={ph.back}>
        <Text style={ph.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={ph.icon}>📷</Text>
      <Text style={ph.title}>OCR Scanner</Text>
      <Text style={ph.sub}>स्कॅनर — Coming Soon</Text>
      <Text style={ph.desc}>Scan handwritten reports and auto-extract values using AI vision.</Text>
    </View>
  );
}