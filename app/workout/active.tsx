import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { calculateStreakAndLives } from '@/src/lib/streakLogic';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSettings } from '@/src/context/SettingsContext';

interface Set {
  id: string;
  weight: string;
  reps: string;
}

interface ExerciseLog {
  logId: string;
  exerciseId: string;
  name: string;
  sets: Set[];
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t, colors } = useSettings();

  useEffect(() => {
    fetchExercises();
  }, []);

  async function fetchExercises() {
    const { data } = await supabase.from('ejercicios').select('*').order('nombre');
    setAvailableExercises(data || []);
  }

  function addExerciseToWorkout(exercise: any) {
    const newLog: ExerciseLog = {
      logId: Math.random().toString(),
      exerciseId: exercise.id,
      name: exercise.nombre,
      sets: [{ id: Math.random().toString(), weight: '', reps: '' }]
    };
    setExerciseLogs([...exerciseLogs, newLog]);
    setIsModalVisible(false);
  }

  function addSet(exerciseIndex: number) {
    const newLogs = [...exerciseLogs];
    newLogs[exerciseIndex].sets.push({ id: Math.random().toString(), weight: '', reps: '' });
    setExerciseLogs(newLogs);
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) {
    const newLogs = [...exerciseLogs];
    newLogs[exerciseIndex].sets[setIndex][field] = value;
    setExerciseLogs(newLogs);
  }

  async function finishWorkout() {
    if (exerciseLogs.length === 0) {
      Alert.alert(t('empty_workout'), t('add_exercise_hint'));
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Create the workout
    const { data: workout, error: wError } = await supabase
      .from('entrenamientos')
      .insert([{ id_usuario: user.id, nombre: t('todays_workout') }])
      .select()
      .single();

    if (wError) {
      Alert.alert('Error', wError.message);
      setLoading(false);
      return;
    }

    // 2. Create the sets
    const setsToInsert = exerciseLogs.flatMap(log => 
      log.sets.map(set => ({
        id_entrenamiento: workout.id,
        id_ejercicio: log.exerciseId,
        peso: parseFloat(set.weight) || 0,
        repeditciones: parseInt(set.reps) || 0 // NOTE: Checking typo in original schema column name if present or fixing it below
      }))
    );
    
    // Check column names (Wait, I used 'repeticiones' in schema.sql, let me check)
    // In schema.sql I used: repeticiones INTEGER NOT NULL
    
    const setsFormatted = exerciseLogs.flatMap(log => 
      log.sets.map(set => ({
        id_entrenamiento: workout.id,
        id_ejercicio: log.exerciseId,
        peso: parseFloat(set.weight) || 0,
        repeticiones: parseInt(set.reps) || 0
      }))
    );

    const { error: sError } = await supabase.from('series_entrenamiento').insert(setsFormatted);

    if (sError) {
      Alert.alert('Error al guardar series', sError.message);
      setLoading(false);
      return;
    }

    // 3. Update exercise records (if weight is higher) and user profile (streak)
    try {
      // Get current exercises to compare weights
      const { data: currentExercises } = await supabase
        .from('ejercicios')
        .select('id, peso');

      const weightUpdates = exerciseLogs.map(log => {
        const maxWeight = Math.max(...log.sets.map(s => parseFloat(s.weight) || 0));
        const existingEx = currentExercises?.find(e => e.id === log.exerciseId);
        if (existingEx && maxWeight > (existingEx.peso || 0)) {
          return supabase.from('ejercicios').update({ peso: maxWeight }).eq('id', log.exerciseId);
        }
        return null;
      }).filter(Boolean);

      if (weightUpdates.length > 0) {
        await Promise.all(weightUpdates);
      }

      // Update Profile: racha and ultima_fecha_entreno using unified logic
      const { data: profile } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        // First, check for missed days and sync lives/streak
        const sync = calculateStreakAndLives(
          profile.ultima_fecha_entreno,
          profile.racha,
          profile.vidas,
          profile.siguiente_vida_en,
          profile.dias_vida_gastada || []
        );

        // Now, add today's workout to the streak
        const today = format(new Date(), 'yyyy-MM-dd');
        let finalizedStreak = sync.streak;
        
        // If it's a new day and wasn't trained yet
        if (profile.ultima_fecha_entreno !== today) {
           finalizedStreak += 1;
        }

        await supabase
          .from('perfiles')
          .update({ 
            ultima_fecha_entreno: today,
            racha: finalizedStreak,
            vidas: sync.lives,
            siguiente_vida_en: sync.nextLifeAt,
            dias_vida_gastada: sync.missedDaysWithLife
          })
          .eq('id', user.id);
      }

      Alert.alert(t('workout_saved'), t('workout_saved_subtitle'));
      router.replace('/(tabs)');
    } catch (err) {
      console.error(err);
      Alert.alert(t('workout_saved'), t('workout_saved_error'));
      router.replace('/(tabs)');
    }
    setLoading(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.card, colors.background]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('training')}</Text>
          <TouchableOpacity onPress={finishWorkout} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.finishText, { color: colors.primary }]}>{t('finish').toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {exerciseLogs.map((log, exIdx) => (
          <View key={log.logId} style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.exerciseName, { color: colors.primary }]}>{log.name}</Text>
            
            <View style={styles.setRowHeader}>
              <Text style={[styles.setHeaderText, { color: colors.muted }]}>{t('set').toUpperCase()}</Text>
              <Text style={[styles.setHeaderText, { color: colors.muted }]}>KG</Text>
              <Text style={[styles.setHeaderText, { color: colors.muted }]}>REPS</Text>
            </View>

            {log.sets.map((set, setIdx) => (
              <View key={set.id} style={styles.setRow}>
                <View style={[styles.setNumberBadge, { backgroundColor: colors.background }]}>
                  <Text style={[styles.setNumberText, { color: colors.secondary }]}>{setIdx + 1}</Text>
                </View>
                <TextInput
                  style={[styles.setInput, { backgroundColor: colors.background, color: colors.text }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={set.weight}
                  onChangeText={(val) => updateSet(exIdx, setIdx, 'weight', val)}
                />
                <TextInput
                  style={[styles.setInput, { backgroundColor: colors.background, color: colors.text }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={set.reps}
                  onChangeText={(val) => updateSet(exIdx, setIdx, 'reps', val)}
                />
              </View>
            ))}

            <TouchableOpacity style={[styles.addSetButton, { backgroundColor: colors.background }]} onPress={() => addSet(exIdx)}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[styles.addSetText, { color: colors.primary }]}>{t('add_set')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addExerciseButton, { backgroundColor: colors.primary }]} onPress={() => setIsModalVisible(true)}>
          <Ionicons name="barbell-outline" size={24} color={colors.background} />
          <Text style={[styles.addExerciseText, { color: colors.background }]}>{t('add_exercise').toUpperCase()}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise Selector Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('select_exercise')}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableExercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.exerciseSelectItem, { borderBottomColor: colors.border }]} onPress={() => addExerciseToWorkout(item)}>
                  <Text style={[styles.exerciseSelectName, { color: colors.text }]}>{item.nombre}</Text>
                  <Text style={[styles.exerciseSelectMuscle, { color: colors.secondary }]}>{item.musculo_objetivo}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.muted }]}>{t('no_exercises_created')}</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  finishText: {
    color: '#E8FB4B',
    fontWeight: '800',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  exerciseCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  exerciseName: {
    color: '#E8FB4B',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 15,
  },
  setRowHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  setHeaderText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  setNumberBadge: {
    backgroundColor: '#262626',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  setNumberText: {
    color: '#888',
    fontWeight: 'bold',
  },
  setInput: {
    backgroundColor: '#262626',
    flex: 1,
    height: 40,
    borderRadius: 8,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#262626',
    borderRadius: 10,
    gap: 5,
  },
  addSetText: {
    color: '#E8FB4B',
    fontWeight: '700',
  },
  addExerciseButton: {
    backgroundColor: '#E8FB4B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 15,
    gap: 10,
    marginTop: 10,
  },
  addExerciseText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    padding: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  exerciseSelectItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  exerciseSelectName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  exerciseSelectMuscle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  }
});
