import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface Set {
  id: string;
  weight: string;
  reps: string;
}

interface ExerciseLog {
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

  useEffect(() => {
    fetchExercises();
  }, []);

  async function fetchExercises() {
    const { data } = await supabase.from('ejercicios').select('*').order('nombre');
    setAvailableExercises(data || []);
  }

  function addExerciseToWorkout(exercise: any) {
    const newLog: ExerciseLog = {
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
      Alert.alert('Entrenamiento vacío', 'Añade al menos un ejercicio.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Create the workout
    const { data: workout, error: wError } = await supabase
      .from('entrenamientos')
      .insert([{ id_usuario: user.id, nombre: 'Entrenamiento de hoy' }])
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
    } else {
      Alert.alert('¡Entrenamiento guardado!', 'Buen trabajo, guerrero.');
      router.replace('/(tabs)');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Entrenando</Text>
          <TouchableOpacity onPress={finishWorkout} disabled={loading}>
            {loading ? <ActivityIndicator color="#E8FB4B" /> : <Text style={styles.finishText}>FINALIZAR</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {exerciseLogs.map((log, exIdx) => (
          <View key={log.exerciseId} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{log.name}</Text>
            
            <View style={styles.setRowHeader}>
              <Text style={styles.setHeaderText}>SERIE</Text>
              <Text style={styles.setHeaderText}>KG</Text>
              <Text style={styles.setHeaderText}>REPS</Text>
            </View>

            {log.sets.map((set, setIdx) => (
              <View key={set.id} style={styles.setRow}>
                <View style={styles.setNumberBadge}>
                  <Text style={styles.setNumberText}>{setIdx + 1}</Text>
                </View>
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#444"
                  value={set.weight}
                  onChangeText={(val) => updateSet(exIdx, setIdx, 'weight', val)}
                />
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#444"
                  value={set.reps}
                  onChangeText={(val) => updateSet(exIdx, setIdx, 'reps', val)}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.addSetButton} onPress={() => addSet(exIdx)}>
              <Ionicons name="add" size={18} color="#E8FB4B" />
              <Text style={styles.addSetText}>Añadir Serie</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addExerciseButton} onPress={() => setIsModalVisible(true)}>
          <Ionicons name="barbell-outline" size={24} color="#000" />
          <Text style={styles.addExerciseText}>AÑADIR EJERCICIO</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise Selector Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Ejercicio</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableExercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.exerciseSelectItem} onPress={() => addExerciseToWorkout(item)}>
                  <Text style={styles.exerciseSelectName}>{item.nombre}</Text>
                  <Text style={styles.exerciseSelectMuscle}>{item.musculo_objetivo}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No tienes ejercicios. Créalos en la pestaña Ejercicios primero.</Text>}
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
