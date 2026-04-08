import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/context/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ProgressChart from '@/components/ProgressChart';

export default function ProgressScreen() {
  const router = useRouter();
  const { t, colors } = useSettings();
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [avgWeekly, setAvgWeekly] = useState(0);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchExercisesWithHistory();
  }, []);

  async function fetchStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: workouts } = await supabase
      .from('entrenamientos')
      .select('id, creado_el')
      .eq('id_usuario', user.id);

    const { data: series } = await supabase
      .from('series_entrenamiento')
      .select('peso, repeticiones, id_entrenamiento')
      .in('id_entrenamiento', workouts?.map(w => w.id) || []);

    const vol = series?.reduce((acc, s) => acc + (s.peso * s.repeticiones), 0) || 0;
    setTotalVolume(vol);
    setTotalWorkouts(workouts?.length || 0);

    // Avg workouts per week (last 4 weeks)
    const last4w = workouts?.filter(w => {
      const wDate = new Date(w.creado_el);
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      return wDate >= fourWeeksAgo;
    });
    setAvgWeekly(Math.round((last4w?.length || 0) / 4 * 10) / 10);
    setLoading(false);
  }

  async function fetchExercisesWithHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('ejercicios')
      .select('nombre, peso')
      .eq('id_usuario', user.id)
      .order('peso', { ascending: false });
    setExercises(data || []);
  }

  async function fetchExerciseHistory(exerciseName: string) {
    setLoadingChart(true);
    setSelectedExercise(exerciseName);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: workouts } = await supabase
      .from('entrenamientos')
      .select('id, creado_el')
      .eq('id_usuario', user.id)
      .order('creado_el', { ascending: true });

    if (!workouts || workouts.length === 0) {
      setChartData([]);
      setLoadingChart(false);
      return;
    }

    const { data: series } = await supabase
      .from('series_entrenamiento')
      .select('peso, repeticiones, id_entrenamiento, catalogo_ejercicios(nombre)')
      .in('id_entrenamiento', workouts.map(w => w.id));

    const filtered = series?.filter(s => 
      (s.catalogo_ejercicios as any)?.nombre === exerciseName
    ) || [];

    // Group by workout date and take max weight
    const byDate = new Map<string, number>();
    filtered.forEach(s => {
      const workout = workouts.find(w => w.id === s.id_entrenamiento);
      if (!workout) return;
      const date = new Date(workout.creado_el).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      const current = byDate.get(date) || 0;
      if (s.peso > current) byDate.set(date, s.peso);
    });

    const chartPoints = Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
    setChartData(chartPoints);
    setLoadingChart(false);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.card, colors.background]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Mi Progreso</Text>
          <View style={{ width: 28 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Summary Stats */}
          <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="barbell" size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`}
              </Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Volumen total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.primary }]}>{totalWorkouts}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Sesiones</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calendar" size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.primary }]}>{avgWeekly}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>/ semana</Text>
            </View>
          </Animated.View>

          {/* Exercise selector */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Evolución por ejercicio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exChips}>
              {exercises.slice(0, 15).map(ex => (
                <TouchableOpacity
                  key={ex.nombre}
                  style={[
                    styles.exChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedExercise === ex.nombre && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => fetchExerciseHistory(ex.nombre)}
                >
                  <Text style={[
                    styles.exChipText,
                    { color: colors.secondary },
                    selectedExercise === ex.nombre && { color: colors.background }
                  ]}>
                    {ex.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Chart */}
          {selectedExercise && (
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              {loadingChart ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ProgressChart
                  data={chartData}
                  title={selectedExercise}
                  unit=" kg"
                  color={colors.primary}
                />
              )}
            </Animated.View>
          )}

          {/* Personal Records */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Récords Personales</Text>
            {exercises.slice(0, 10).map((ex, idx) => (
              <View
                key={ex.nombre}
                style={[styles.recordRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.rankBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.rankText, { color: colors.primary }]}>#{idx + 1}</Text>
                </View>
                <Text style={[styles.recordName, { color: colors.text }]} numberOfLines={1}>{ex.nombre}</Text>
                <Text style={[styles.recordWeight, { color: colors.primary }]}>{ex.peso}kg</Text>
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 6
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  exChips: { gap: 8, paddingRight: 20, marginBottom: 20 },
  exChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  exChipText: { fontSize: 12, fontWeight: '700' },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12
  },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontWeight: '900', fontSize: 12 },
  recordName: { flex: 1, fontSize: 15, fontWeight: '700' },
  recordWeight: { fontSize: 17, fontWeight: '900' },
});
