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
  id: string;
  exerciseId: string;
  name: string;
  previousWeight?: number;
  sets: Set[];
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<any[]>([]);
  const [muscles, setMuscles] = useState<string[]>(['Todos']);
  const [selectedMuscle, setSelectedMuscle] = useState('Todos');
  const { t, colors } = useSettings();

  useEffect(() => {
    fetchExercises();
  }, []);

  async function fetchExercises() {
    const { data } = await supabase.from('catalogo_ejercicios').select('*').order('nombre');
    if (data) {
      setAvailableExercises(data);
      setFilteredExercises(data);
      
      const uniqueMuscles = Array.from(new Set(data.map(item => item.musculo_principal)))
        .filter(Boolean)
        .sort()
        .map(m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
      setMuscles(['Todos', ...uniqueMuscles]);
    }
  }

  useEffect(() => {
    const filtered = availableExercises.filter(ex => {
      const matchesSearch = ex.nombre.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
                          (ex.musculo_principal && ex.musculo_principal.toLowerCase().includes(exerciseSearchQuery.toLowerCase()));
      const matchesMuscle = selectedMuscle === 'Todos' || 
                           (ex.musculo_principal && ex.musculo_principal.toLowerCase() === selectedMuscle.toLowerCase());
      return matchesSearch && matchesMuscle;
    });
    setFilteredExercises(filtered);
  }, [exerciseSearchQuery, availableExercises, selectedMuscle]);

  async function addExerciseToWorkout(exercise: any) {
    const { data: userEx } = await supabase
      .from('ejercicios')
      .select('peso')
      .eq('nombre', exercise.nombre)
      .limit(1)
      .single();

    const newLog: ExerciseLog = {
      id: Math.random().toString(36).substr(2, 9),
      exerciseId: exercise.id,
      name: exercise.nombre,
      previousWeight: userEx?.peso || 0,
      sets: [{ id: Math.random().toString(), weight: '', reps: '' }]
    };
    setExerciseLogs([...exerciseLogs, newLog]);
    setIsModalVisible(false);
    setExerciseSearchQuery('');
    setSelectedMuscle('Todos');
  }

  function removeExercise(id: string) {
    setExerciseLogs(exerciseLogs.filter(log => log.id !== id));
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

    // 3. Update records (records reside in the 'ejercicios' personal table)
    try {
      const { data: currentRecords } = await supabase
        .from('ejercicios')
        .select('nombre, peso')
        .eq('id_usuario', user.id);

      const recordUpdates = exerciseLogs.map(async (log) => {
        const maxWeight = Math.max(...log.sets.map(s => parseFloat(s.weight) || 0));
        const existingRecord = currentRecords?.find(r => r.nombre === log.name);

        if (!existingRecord) {
          // New exercise for the user, create record
          return supabase.from('ejercicios').insert([{
            id_usuario: user.id,
            nombre: log.name,
            peso: maxWeight,
            musculo_objetivo: availableExercises.find(ex => ex.id === log.exerciseId)?.musculo_principal || ''
          }]);
        } else if (maxWeight > (existingRecord.peso || 0)) {
          // Update existing record with new personal best
          return supabase.from('ejercicios').update({ peso: maxWeight }).eq('id_usuario', user.id).eq('nombre', log.name);
        }
        return null;
      });

      await Promise.all(recordUpdates.filter(u => u !== null));

      // 4. Update Profile: racha and last trained date
      const { data: profile } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        const sync = calculateStreakAndLives(
          profile.ultima_fecha_entreno,
          profile.racha,
          profile.vidas,
          profile.siguiente_vida_en,
          profile.dias_vida_gastada || []
        );

        const today = format(new Date(), 'yyyy-MM-dd');
        let finalizedStreak = sync.streak;
        
        if (profile.ultima_fecha_entreno !== today) {
           finalizedStreak += 1;
        }

        await supabase.from('perfiles').update({
          ultima_fecha_entreno: today,
          racha: finalizedStreak,
          vidas: sync.lives,
          siguiente_vida_en: sync.nextLifeAt,
          dias_vida_gastada: sync.missedDaysWithLife
        }).eq('id', user.id);
      }

      setLoading(false);
      Alert.alert(t('success'), t('workout_saved_subtitle'), [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
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
          <View key={log.id} style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseTitleContainer}>
                <Text style={[styles.exerciseName, { color: colors.primary }]}>{log.name}</Text>
                {log.previousWeight && log.previousWeight > 0 ? (
                  <View style={[styles.previousWeightBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="trophy" size={12} color={colors.primary} />
                    <Text style={[styles.previousWeightText, { color: colors.primary }]}>
                      {t('previous')}: {log.previousWeight}kg
                    </Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => removeExercise(log.id)}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            
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

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('select_exercise')}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.modalSearchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
               <Ionicons name="search" size={20} color={colors.muted} />
               <TextInput
                 style={[styles.modalSearchInput, { color: colors.text }]}
                 placeholder={t('search_exercises')}
                 placeholderTextColor={colors.muted}
                 value={exerciseSearchQuery}
                 onChangeText={setExerciseSearchQuery}
               />
            </View>

            <View style={styles.modalFilterContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.muscleScroll}>
                {muscles.map((muscle) => (
                  <TouchableOpacity
                    key={muscle}
                    style={[
                      styles.muscleChip,
                      { backgroundColor: colors.muted + '20', borderColor: colors.border },
                      selectedMuscle === muscle && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setSelectedMuscle(muscle)}
                  >
                    <Text style={[
                      styles.muscleChipText,
                      { color: colors.text },
                      selectedMuscle === muscle && { color: '#000' }
                    ]}>
                      {t(muscle)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <FlatList
              data={filteredExercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.exerciseSelectItem, { borderBottomColor: colors.border }]} onPress={() => addExerciseToWorkout(item)}>
                  <Text style={[styles.exerciseSelectName, { color: colors.text }]}>{item.nombre}</Text>
                  <Text style={[styles.exerciseSelectMuscle, { color: colors.secondary }]}>{t(item.musculo_principal)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.muted }]}>{t('no_results_found')}</Text>}
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: '800',
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
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    height: 45,
    marginBottom: 20,
    gap: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  modalFilterContainer: {
    marginBottom: 15,
  },
  muscleScroll: {
    paddingHorizontal: 2,
    gap: 8,
  },
  muscleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  muscleChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseTitleContainer: {
    flex: 1,
    gap: 4,
  },
  previousWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  previousWeightText: {
    fontSize: 11,
    fontWeight: '800',
  }
});
