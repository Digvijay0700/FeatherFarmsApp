export function WeightTracker() {
  const router = useRouter();
  return (
    <View style={ph.root}>
      <TouchableOpacity onPress={() => router.back()} style={ph.back}>
        <Text style={ph.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={ph.icon}>⚖️</Text>
      <Text style={ph.title}>Weight Tracker</Text>
      <Text style={ph.sub}>वजन ट्रॅकर — Coming Soon</Text>
      <Text style={ph.desc}>Weekly weigh-in of 20 birds, growth curve vs standard.</Text>
    </View>
  );
}