import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="active" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
