import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [volumeHistory, setVolumeHistory] = useState<{ date: string; value: number }[]>([]);
  const [dailyMaxHistory, setDailyMaxHistory] = useState<{ date: string; value: number }[]>([]);
  const [muscleDist, setMuscleDist] = useState<{ muscle: string; series: number }[]>([]);

  useEffect(() => {
    fetchStats();
    fetchExercisesWithHistory();
  }, []);

  async function fetchStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: workouts } = await supabase
      .from('sesiones_entrenamiento')
      .select('id, creado_el, volumen_total')
      .eq('id_usuario', user.id)
      .order('creado_el', { ascending: true });

    if (workouts) {
      const vol = workouts.reduce((acc, w) => acc + (w.volumen_total || 0), 0);
      setTotalVolume(vol);
      setTotalWorkouts(workouts.length);

      // Volume over time (last 10 sessions)
      const last10 = workouts.slice(-10).map(w => ({
        date: new Date(w.creado_el).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        value: Math.round(w.volumen_total || 0)
      }));
      setVolumeHistory(last10);

      // Avg weekly for last 4 weeks
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recent = workouts.filter(w => new Date(w.creado_el) >= fourWeeksAgo);
      setAvgWeekly(Math.round((recent.length / 4) * 10) / 10);

      // --- Peso diario (Max weight per session) ---
      const { data: maxWeights } = await supabase
        .from('series_entrenamiento')
        .select('peso, id_sesion')
        .in('id_sesion', workouts.map(w => w.id));
      
      const sessionMaxMap = new Map();
      maxWeights?.forEach(s => {
        const current = sessionMaxMap.get(s.id_sesion) || 0;
        if (s.peso > current) sessionMaxMap.set(s.id_sesion, s.peso);
      });

      const pesoHistory = workouts.slice(-10).map(w => ({
        date: new Date(w.creado_el).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        value: sessionMaxMap.get(w.id) || 0
      }));
      setDailyMaxHistory(pesoHistory);

      // --- Muscle distribution (Exercise count) ---
      const { data: seriesWithMuscle } = await supabase
        .from('series_entrenamiento')
        .select('id_ejercicio_catalogo, catalogo_ejercicios(musculo_principal)')
        .in('id_sesion', workouts.map(w => w.id));
      
      const muscleExerciseMap = new Map();
      seriesWithMuscle?.forEach(s => {
        const muscle = s.catalogo_ejercicios?.musculo_principal;
        if (!muscle) return;
        if (!muscleExerciseMap.has(muscle)) muscleExerciseMap.set(muscle, new Set());
        muscleExerciseMap.get(muscle).add(s.id_ejercicio_catalogo);
      });

      const muscleDistData = Array.from(muscleExerciseMap.entries()).map(([muscle, exercises]) => ({
        muscle,
        series: exercises.size 
      })).sort((a, b) => b.series - a.series);

      setMuscleDist(muscleDistData);
    }

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
    
    // Sort and map manually if needed, or just use naming convention
    const mapped = data?.map(d => ({
       nombre: d.nombre,
       peso: d.peso
    })) || [];
    setExercises(mapped);
  }

  async function fetchExerciseHistory(exerciseName: string) {
    setLoadingChart(true);
    setSelectedExercise(exerciseName);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: workouts } = await supabase
      .from('sesiones_entrenamiento')
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
      .select('peso, repeticiones, id_sesion, catalogo_ejercicios(nombre)')
      .in('id_sesion', workouts.map(w => w.id));

    const filtered = series?.filter(s => 
      (s.catalogo_ejercicios as any)?.nombre === exerciseName
    ) || [];

    // Group by workout date and take max weight
    const byDate = new Map<string, number>();
    filtered.forEach(s => {
      const workout = workouts.find(w => w.id === s.id_sesion);
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
          <Animated.View entering={FadeInDown.springify()} style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{totalWorkouts}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Sesiones</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{totalVolume.toLocaleString()}kg</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Volumen Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{avgWeekly}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Media/Semana</Text>
            </View>
          </Animated.View>

          {/* Volume Chart */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Volumen de Entrenamiento (10 ses.)</Text>
            <ProgressChart
              data={volumeHistory}
              title="Carga Total por Sesión"
              unit="kg"
              color={colors.primary}
            />
            
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Peso Máximo por Sesión (10 ses.)</Text>
            <ProgressChart
              data={dailyMaxHistory}
              title="Récord de Carga en Sesión"
              unit="kg"
              color={colors.primary}
            />
          </Animated.View>

          {/* Muscle distribution */}
          {muscleDist.length > 0 && (
            <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.muscleSection}>
               <Text style={[styles.sectionTitle, { color: colors.text }]}>Distribución por Músculo</Text>
               <View style={[styles.muscleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {muscleDist.slice(0, 5).map((m, i) => {
                    const maxSeries = Math.max(...muscleDist.map(md => md.series));
                    return (
                      <View key={m.muscle} style={styles.muscleRow}>
                        <Text style={[styles.muscleLabel, { color: colors.secondary }]}>{t(m.muscle)}</Text>
                        <View style={styles.barContainer}>
                          <View style={[styles.barFill, { width: `${(m.series / maxSeries) * 100}%`, backgroundColor: colors.primary }]} />
                        </View>
                        <Text style={[styles.muscleCount, { color: colors.text }]}>{m.series}</Text>
                      </View>
                    );
                  })}
               </View>
            </Animated.View>
          )}

          {/* Exercise selector */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
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
  muscleSection: { marginBottom: 24 },
  muscleCard: { padding: 20, borderRadius: 20, borderWidth: 1, gap: 15 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  muscleLabel: { width: 80, fontSize: 12, fontWeight: '700' },
  barContainer: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  muscleCount: { width: 25, fontSize: 12, fontWeight: '800', textAlign: 'right' },
});
