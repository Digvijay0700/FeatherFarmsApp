import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={s.root}>
      <Text style={s.title}>FeatherFarms</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.btn}>
        <Text style={s.btnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8E7' },
  title:   { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 20 },
  btn:     { backgroundColor: '#F5A623', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});