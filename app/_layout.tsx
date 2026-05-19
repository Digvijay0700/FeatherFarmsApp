// app/_layout.tsx
// Root layout — stack navigation, no tabs

import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

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
        <Stack.Screen name="ocr-scanner" />
        <Stack.Screen name="weight-tracker" />
        <Stack.Screen name="camera-monitor" />
        <Stack.Screen name="crowding-detection" />
        <Stack.Screen name="feeding-patterns" />
        <Stack.Screen name="ml-insights" />
      </Stack>
    </>
  );
}