import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { calculateStreakAndLives } from '@/src/lib/streakLogic';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSettings } from '@/src/context/SettingsContext';
import * as Haptics from 'expo-haptics';
import { saveWorkoutOffline } from '@/src/lib/offlineSync';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Audio } from 'expo-av';

interface Set {
  id: string;
  weight: string;
  reps: string;
  minutes?: string;
  seconds?: string;
  distance?: string;
}

interface ExerciseLog {
  id: string;
  exerciseId: string;
  name: string;
  previousWeight?: number;
  isCardio?: boolean;
  sets: Set[];
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<any[]>([]);
  const [muscles, setMuscles] = useState<string[]>(['Todos']);
  const [selectedMuscle, setSelectedMuscle] = useState('Todos');
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [workoutNote, setWorkoutNote] = useState('');
  const [moodSelected, setMoodSelected] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState(3);
  const { t, colors } = useSettings();

  // Rest Timer State
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerPreset, setTimerPreset] = useState(60);
  const [autoStartTimer, setAutoStartTimer] = useState(false);

  const [isTimerSettingsVisible, setIsTimerSettingsVisible] = useState(false);
  const [isTimerFinishedVisible, setIsTimerFinishedVisible] = useState(false);
  const [customTimerMinutes, setCustomTimerMinutes] = useState('');
  const [customTimerSeconds, setCustomTimerSeconds] = useState('');

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      translateX.value = context.value.x + event.translationX;
      translateY.value = context.value.y + event.translationY;
    });

  const animatedTimerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timerRemaining > 0) {
      interval = setInterval(() => {
        setTimerRemaining(prev => prev - 1);
      }, 1000);
    } else if (timerRemaining === 0 && isTimerActive) {
      setIsTimerActive(false);
      triggerTimerEndNotification();
      setIsTimerFinishedVisible(true);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timerRemaining]);

  async function triggerTimerEndNotification() {
    // 1. Multiple Strong Vibrations
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 800);
    } catch (_) {}

    // 2. Clear & Noticeable Sound
    // 2. Clear & Noticeable Sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://docs.expo.dev/static/sounds/hello.mp3' }, // Documented stable sample
        { shouldPlay: true, volume: 1.0 }
      );
      await sound.playAsync();
      // Clean up sound after playing
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (err) {
      console.warn('Error playing timer sound', err);
    }
  }

  const startTimer = (seconds: number) => {
    setTimerRemaining(seconds);
    setIsTimerActive(true);
    setTimerPreset(seconds);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stopTimer = () => {
    setIsTimerActive(false);
    setTimerRemaining(0);
  };

  useEffect(() => {
    fetchExercises();
    fetchRoutines();
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  async function fetchRoutines() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('rutinas').select('*').eq('id_usuario', user.id);
    setRoutines(data || []);
  }

  async function loadSession(id: string) {
    setLoading(true);
    try {
      const { data: session } = await supabase
        .from('sesiones_entrenamiento')
        .select('*')
        .eq('id', id)
        .single();
      
      if (session) {
        setWorkoutNote(session.nota || '');
        setMoodSelected(session.estado_animo);
        setEnergyLevel(session.nivel_energia || 3);

        const { data: series } = await supabase
          .from('series_entrenamiento')
          .select('*, catalogo_ejercicios(nombre, musculo_principal, categoria)')
          .eq('id_sesion', id)
          .order('creado_el');

        if (series) {
          // Group series by exercise
          const logsMap = new Map<string, ExerciseLog>();
          series.forEach(s => {
            const exName = (s.catalogo_ejercicios as any).nombre;
            const exId = s.id_ejercicio_catalogo;
            if (!logsMap.has(exId)) {
              logsMap.set(exId, {
                id: Math.random().toString(36).substr(2, 9),
                exerciseId: exId,
                name: exName,
                isCardio: (s.catalogo_ejercicios as any).categoria === 'cardio',
                sets: []
              });
            }
            logsMap.get(exId)?.sets.push({
              id: s.id,
              weight: s.peso?.toString() || '',
              reps: s.repeticiones?.toString() || '',
              minutes: s.tiempo_minutos?.toString() || '',
              seconds: s.tiempo_segundos?.toString() || '',
              distance: s.distancia_km?.toString() || ''
            });
          });
          setExerciseLogs(Array.from(logsMap.values()));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoutine(routineId: string) {
    setLoading(true);
    try {
      const { data: rutEx } = await supabase
        .from('rutinas_ejercicios')
        .select('*, catalogo_ejercicios(nombre, musculo_principal, categoria)')
        .eq('id_rutina', routineId)
        .order('orden');
      
      if (rutEx) {
        const newLogs: ExerciseLog[] = rutEx.map(re => ({
          id: Math.random().toString(36).substr(2, 9),
          exerciseId: re.id_ejercicio_catalogo,
          name: (re.catalogo_ejercicios as any).nombre,
          isCardio: (re.catalogo_ejercicios as any).categoria === 'cardio',
          sets: Array.from({ length: re.series_sugeridas || 3 }).map(() => ({
            id: Math.random().toString(),
            weight: re.peso_sugerido?.toString() || '',
            reps: re.repeticiones_sugeridas?.toString() || '',
            minutes: '',
            seconds: '',
            distance: ''
          }))
        }));
        setExerciseLogs([...exerciseLogs, ...newLogs]);
        setRoutineModalVisible(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userEx } = await supabase
      .from('ejercicios')
      .select('peso')
      .eq('nombre', exercise.nombre)
      .eq('id_usuario', user.id)
      .limit(1)
      .single();

    const isCardio = exercise.categoria?.toLowerCase() === 'cardio' || exercise.musculo_principal?.toLowerCase() === 'cardio';

    const newLog: ExerciseLog = {
      id: Math.random().toString(36).substr(2, 9),
      exerciseId: exercise.id,
      name: exercise.nombre,
      previousWeight: userEx?.peso || 0,
      isCardio,
      sets: [{ id: Math.random().toString(), weight: '', reps: '', minutes: '', seconds: '', distance: '' }]
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
    const prevSet = newLogs[exerciseIndex].sets[newLogs[exerciseIndex].sets.length - 1];
    newLogs[exerciseIndex].sets.push({ 
      id: Math.random().toString(), 
      weight: prevSet?.weight || '', 
      reps: prevSet?.reps || '',
      minutes: prevSet?.minutes || '',
      seconds: prevSet?.seconds || '',
      distance: prevSet?.distance || ''
    });
    setExerciseLogs(newLogs);
    if (autoStartTimer) {
      startTimer(timerPreset);
    }
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: keyof Set, value: string) {
    const newLogs = [...exerciseLogs];
    newLogs[exerciseIndex].sets[setIndex][field] = value;
    setExerciseLogs(newLogs);
  }

  async function finishWorkout() {
    if (exerciseLogs.length === 0) {
      Alert.alert(t('empty_workout'), t('add_exercise_hint'));
      return;
    }
    // Show notes modal first
    setNotesModalVisible(true);
  }

  async function saveWorkout() {
    setNotesModalVisible(false);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: session, error: sError } = sessionId 
      ? await supabase.from('sesiones_entrenamiento').update({
          nota: workoutNote.trim(),
          estado_animo: moodSelected,
          nivel_energia: energyLevel
        }).eq('id', sessionId).select().single()
      : await supabase.from('sesiones_entrenamiento').insert([{
          id_usuario: user.id,
          nombre: t('todays_workout'),
          nota: workoutNote.trim(),
          estado_animo: moodSelected,
          nivel_energia: energyLevel
        }]).select().single();

    if (sError) {
      Alert.alert('Error', sError.message);
      setLoading(false);
      return;
    }

    if (sessionId) {
      // Clear old rows for this session before inserting new ones
      await supabase.from('series_entrenamiento').delete().eq('id_sesion', sessionId);
    }

    const setsFormatted = exerciseLogs.flatMap(log => 
      log.sets.map(set => ({
        id_sesion: session.id,
        id_ejercicio_catalogo: log.exerciseId,
        peso: log.isCardio ? 0 : (parseFloat(set.weight) || 0),
        repeticiones: log.isCardio ? 0 : (parseInt(set.reps) || 0),
        tiempo_minutos: log.isCardio ? (parseInt(set.minutes || '0') || 0) : null,
        tiempo_segundos: log.isCardio ? (parseInt(set.seconds || '0') || 0) : null,
        distancia_km: log.isCardio ? (parseFloat(set.distance || '0') || null) : null,
      }))
    );

    const { error: seriesErr } = await supabase.from('series_entrenamiento').insert(setsFormatted);
    
    if (seriesErr) {
       Alert.alert('Error al guardar series', seriesErr.message);
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

      // 5. Save workout notes if provided
      if (workoutNote.trim() || moodSelected) {
        try {
          await supabase.from('notas_entrenamiento').insert([{
            id_entrenamiento: workout.id,
            nota: workoutNote.trim() || '',
            estado_animo: moodSelected,
            nivel_energia: energyLevel,
          }]);
        } catch (_) {} // Non-blocking
      }

      setLoading(false);
      Alert.alert(t('success'), t('workout_saved_subtitle'), [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (err: any) {
      console.error(err);
      
      // OFFLINE FALLBACK
      // If we are here, something went wrong, possibly connection.
      // Let's try to save offline.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         const offlineData = {
            workout: {
                id_usuario: user.id,
                nombre: t('todays_workout'),
                nota: workoutNote.trim(),
                estado_animo: moodSelected,
                nivel_energia: energyLevel
            },
            series: exerciseLogs.flatMap(log => 
                log.sets.map(set => ({
                  id_ejercicio_catalogo: log.exerciseId,
                  peso: log.isCardio ? 0 : (parseFloat(set.weight) || 0),
                  repeticiones: log.isCardio ? 0 : (parseInt(set.reps) || 0),
                  tiempo_minutos: log.isCardio ? (parseInt(set.minutes || '0') || 0) : null,
                  tiempo_segundos: log.isCardio ? (parseInt(set.seconds || '0') || 0) : null,
                  distancia_km: log.isCardio ? (parseFloat(set.distance || '0') || null) : null,
                }))
            ),
            records: exerciseLogs.map(log => {
                const maxWeight = Math.max(...log.sets.map(s => parseFloat(s.weight) || 0));
                return {
                    name: log.name,
                    userId: user.id,
                    data: { id_usuario: user.id, nombre: log.name, peso: maxWeight }
                }
            }),
            notes: workoutNote.trim() || moodSelected ? {
                nota: workoutNote.trim() || '',
                estado_animo: moodSelected,
                nivel_energia: energyLevel,
            } : null,
         };

         const saved = await saveWorkoutOffline(offlineData);
         if (saved) {
             Alert.alert("Trabajo guardado offline", "No hay conexión, pero tu entrenamiento se ha guardado localmente. Se sincronizará automáticamente cuando vuelvas a tener internet.");
             router.replace('/(tabs)');
             return;
         }
      }

      Alert.alert(t('workout_saved'), t('workout_saved_error'));
      router.replace('/(tabs)');
    }
    setLoading(false);
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.card, colors.background]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{sessionId ? 'Editar Entrenamiento' : t('training')}</Text>
          <TouchableOpacity onPress={finishWorkout} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.finishText, { color: colors.primary }]}>{t('finish').toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.topActions}>
        <TouchableOpacity 
          style={[styles.routineCardHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setRoutineModalVisible(true)}
        >
          <View style={[styles.routineIconCircle, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="list" size={24} color={colors.primary} />
          </View>
          <View style={styles.routineBtnInfo}>
            <Text style={[styles.routineBtnTitle, { color: colors.text }]}>Cargar Rutina</Text>
            <Text style={[styles.routineBtnSub, { color: colors.secondary }]}>Añade ejercicios de una rutina guardada</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

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
              {!log.isCardio ? (
                 <>
                   <Text style={[styles.setHeaderText, { color: colors.muted }]}>KG</Text>
                   <Text style={[styles.setHeaderText, { color: colors.muted }]}>REPS</Text>
                 </>
              ) : (
                 <>
                   <Text style={[styles.setHeaderText, { color: colors.muted }]}>MIN</Text>
                   <Text style={[styles.setHeaderText, { color: colors.muted }]}>SEG</Text>
                   <Text style={[styles.setHeaderText, { color: colors.muted }]}>KM (Opc)</Text>
                 </>
              )}
            </View>

            {log.sets.map((set, setIdx) => (
              <View key={set.id} style={styles.setRow}>
                <View style={[styles.setNumberBadge, { backgroundColor: colors.background }]}>
                  <Text style={[styles.setNumberText, { color: colors.secondary }]}>{setIdx + 1}</Text>
                </View>
                {!log.isCardio ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <TextInput
                      style={[styles.setInput, { backgroundColor: colors.background, color: colors.text }]}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={set.minutes}
                      onChangeText={(val) => updateSet(exIdx, setIdx, 'minutes', val)}
                    />
                    <TextInput
                      style={[styles.setInput, { backgroundColor: colors.background, color: colors.text }]}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={set.seconds}
                      onChangeText={(val) => updateSet(exIdx, setIdx, 'seconds', val)}
                    />
                    <TextInput
                      style={[styles.setInput, { backgroundColor: colors.background, color: colors.text }]}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={colors.muted}
                      value={set.distance}
                      onChangeText={(val) => updateSet(exIdx, setIdx, 'distance', val)}
                    />
                  </>
                )}
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

      {/* Notes Modal */}
      <Modal visible={notesModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>¿Cómo fue el entreno?</Text>
              <TouchableOpacity onPress={() => setNotesModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Mood selector */}
            <Text style={[styles.notesLabel, { color: colors.secondary }]}>Estado de ánimo</Text>
            <View style={styles.moodRow}>
              {[{ icon: '😫', key: 'mal' }, { icon: '😔', key: 'cansado' }, { icon: '😐', key: 'normal' }, { icon: '😊', key: 'bien' }, { icon: '🔥', key: 'excelente' }].map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.moodBtn, moodSelected === m.key && { backgroundColor: colors.primary + '30', borderColor: colors.primary, borderWidth: 2 }]}
                  onPress={() => setMoodSelected(moodSelected === m.key ? null : m.key)}
                >
                  <Text style={styles.moodEmoji}>{m.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Energy level */}
            <Text style={[styles.notesLabel, { color: colors.secondary }]}>Nivel de energía: {energyLevel}/5</Text>
            <View style={styles.energyRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.energyBtn, { backgroundColor: n <= energyLevel ? colors.primary : colors.background }]}
                  onPress={() => setEnergyLevel(n)}
                />
              ))}
            </View>

            {/* Notes text */}
            <Text style={[styles.notesLabel, { color: colors.secondary }]}>Notas (opcional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="¿Algo que destacar de hoy?"
              placeholderTextColor={colors.muted}
              value={workoutNote}
              onChangeText={setWorkoutNote}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={saveWorkout}
            >
              <Text style={[styles.saveBtnText, { color: colors.background }]}>Guardar Entrenamiento</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveWorkout} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: colors.muted }]}>Saltar y guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                  <View style={[styles.exerciseImageMini, { backgroundColor: colors.background }]}>
                    {item.imagen_url ? (
                      <Image source={{ uri: item.imagen_url }} style={styles.miniExerciseImg} />
                    ) : (
                      <Ionicons name="barbell-outline" size={20} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.exerciseSelectInfo}>
                    <Text style={[styles.exerciseSelectName, { color: colors.text }]}>{item.nombre}</Text>
                    <Text style={[styles.exerciseSelectMuscle, { color: colors.secondary }]}>
                      {t(item.musculo_principal)} {item.equipamiento ? `· ${item.equipamiento}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.muted }]}>{t('no_results_found')}</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Routine Selection Modal */}
      <Modal visible={routineModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, height: '60%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Tus Rutinas</Text>
                <Text style={[styles.modalSub, { color: colors.secondary }]}>Selecciona una para cargar sus ejercicios</Text>
              </View>
              <TouchableOpacity onPress={() => setRoutineModalVisible(false)} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={routines}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                   style={[styles.routineSelectItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                   onPress={() => loadRoutine(item.id)}
                >
                  <View style={[styles.routineSelectIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="barbell" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.routineSelectInfo}>
                    <Text style={[styles.routineItemName, { color: colors.text }]}>{item.nombre}</Text>
                    <Text style={[styles.routineItemDesc, { color: colors.secondary }]} numberOfLines={1}>
                      {item.descripcion || 'Sin descripción'}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={26} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="clipboard-outline" size={60} color={colors.muted} />
                  <Text style={[styles.emptyText, { color: colors.muted, marginTop: 15 }]}>No tienes rutinas guardadas</Text>
                  <TouchableOpacity 
                    style={[styles.createRoutineBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { setRoutineModalVisible(false); router.push('/routines' as any); }}
                  >
                    <Text style={[styles.createRoutineText, { color: colors.background }]}>CREAR RUTINA</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Draggable Timer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.timerToggle, { backgroundColor: isTimerActive ? colors.card : colors.primary, borderColor: colors.primary, borderWidth: isTimerActive ? 2 : 0 }, animatedTimerStyle]}>
          <TouchableOpacity 
            style={{flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%'}} 
            onPress={() => {
              if (isTimerActive) {
                stopTimer();
              } else {
                setIsTimerSettingsVisible(true);
              }
            }}
          >
            {isTimerActive ? (
              <Text style={{color: colors.primary, fontWeight: '900', fontSize: 16}}>
                {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')}
              </Text>
            ) : (
              <Ionicons name="stopwatch" size={30} color={colors.background} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      {/* Timer Settings Modal */}
      <Modal visible={isTimerSettingsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, height: 'auto', paddingBottom: 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Temporizador</Text>
              <TouchableOpacity onPress={() => setIsTimerSettingsVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.notesLabel, { color: colors.secondary }]}>Opciones Rápidas</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20}}>
              {[{l: '30s', v: 30}, {l: '1 min', v: 60}, {l: '1:30 min', v: 90}, {l: '2 min', v: 120}, {l: '2:30 min', v: 150}].map(opt => (
                <TouchableOpacity 
                  key={opt.v}
                  style={[styles.presetBtn, { backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 }]}
                  onPress={() => {
                    startTimer(opt.v);
                    setIsTimerSettingsVisible(false);
                  }}
                >
                  <Text style={[styles.presetText, { color: colors.primary, fontSize: 14 }]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.notesLabel, { color: colors.secondary }]}>Personalizado</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20}}>
              <TextInput
                style={[styles.setInput, { backgroundColor: colors.background, color: colors.text, flex: 1, fontSize: 18 }]}
                keyboardType="numeric"
                placeholder="Min"
                placeholderTextColor={colors.muted}
                value={customTimerMinutes}
                onChangeText={setCustomTimerMinutes}
              />
              <Text style={{color: colors.text, fontSize: 20, fontWeight: 'bold'}}>:</Text>
              <TextInput
                style={[styles.setInput, { backgroundColor: colors.background, color: colors.text, flex: 1, fontSize: 18 }]}
                keyboardType="numeric"
                placeholder="Seg"
                placeholderTextColor={colors.muted}
                value={customTimerSeconds}
                onChangeText={setCustomTimerSeconds}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                const m = parseInt(customTimerMinutes) || 0;
                const s = parseInt(customTimerSeconds) || 0;
                if (m > 0 || s > 0) {
                  startTimer(m * 60 + s);
                  setIsTimerSettingsVisible(false);
                }
              }}
            >
              <Text style={[styles.saveBtnText, { color: colors.background }]}>Iniciar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Timer Finished Modal */}
      <Modal visible={isTimerFinishedVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ backgroundColor: colors.card, padding: 30, borderRadius: 20, alignItems: 'center', width: '80%', borderWidth: 2, borderColor: colors.primary }}>
            <TouchableOpacity style={{ position: 'absolute', top: 10, right: 10 }} onPress={() => setIsTimerFinishedVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Ionicons name="checkmark-circle" size={60} color={colors.primary} style={{ marginBottom: 15 }} />
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>Entrenamiento finalizado</Text>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  exerciseSelectInfo: {
    flex: 1,
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
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 16,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodEmoji: {
    fontSize: 28,
  },
  energyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  energyBtn: {
    flex: 1,
    height: 10,
    borderRadius: 5,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '900',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  floatingTimer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 150,
    padding: 15,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    alignItems: 'center',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
    width: '100%',
    justifyContent: 'space-between',
  },
  timerTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timerValue: {
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 5,
  },
  timerPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'center',
    marginTop: 5,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timerToggle: {
    position: 'absolute',
    bottom: 110,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  topActions: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  routineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 15,
  },
  routineIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineBtnInfo: {
    flex: 1,
  },
  routineBtnTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  routineBtnSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  modalSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    gap: 15,
  },
  routineSelectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineSelectInfo: {
    flex: 1,
  },
  routineItemName: {
    fontSize: 16,
    fontWeight: '800',
  },
  routineItemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  createRoutineBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  createRoutineText: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  exerciseImageMini: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  exerciseImageMini: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniExerciseImg: {
    width: '100%',
    height: '100%',
  },
  skipBtn: {
    alignItems: 'center',
    padding: 10,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
