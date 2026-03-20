import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, SafeAreaView, Alert, Modal } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isSaturday, isSunday, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateStreakAndLives } from '@/src/lib/streakLogic';
import { useFocusEffect } from 'expo-router';

export default function CalendarScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [dayWorkouts, setDayWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Summary Modal state
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [workoutDetails, setWorkoutDetails] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfileAndSync();
      fetchMonthWorkouts();
    }, [currentDate])
  );

  async function fetchProfileAndSync() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      const sync = calculateStreakAndLives(
        data.ultima_fecha_entreno,
        data.racha,
        data.vidas,
        data.siguiente_vida_en,
        data.dias_vida_gastada || []
      );
      setProfile({ ...data, ...sync });
      
      if (sync.streak !== data.racha || sync.lives !== data.vidas || sync.nextLifeAt !== data.siguiente_vida_en) {
         await supabase.from('perfiles').update({
            racha: sync.streak,
            vidas: sync.lives,
            siguiente_vida_en: sync.nextLifeAt,
            dias_vida_gastada: sync.missedDaysWithLife
         }).eq('id', user.id);
      }
    }
  }

  useEffect(() => {
    filterWorkoutsForSelectedDate();
  }, [selectedDate, workouts]);

  async function fetchMonthWorkouts() {
    setLoading(true);
    const firstDay = startOfMonth(currentDate);
    const lastDay = endOfMonth(currentDate);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('entrenamientos')
      .select('*')
      .eq('id_usuario', user.id)
      .gte('fecha', firstDay.toISOString())
      .lte('fecha', lastDay.toISOString());

    if (error) {
        console.error('Error fetching workouts:', error);
    } else {
        setWorkouts(data || []);
    }
    setLoading(false);
  }

  function filterWorkoutsForSelectedDate() {
    const filtered = workouts.filter(w => isSameDay(new Date(w.fecha), selectedDate));
    setDayWorkouts(filtered);
  }

  async function showWorkoutSummary(workout: any) {
    setSelectedWorkout(workout);
    setIsSummaryVisible(true);
    setDetailsLoading(true);

    const { data, error } = await supabase
      .from('series_entrenamiento')
      .select(`
        id,
        peso,
        repeticiones,
        ejercicios (
          nombre
        )
      `)
      .eq('id_entrenamiento', workout.id);

    if (error) {
      console.error('Error fetching workout details:', error);
      Alert.alert('Error', 'No se pudieron cargar los detalles del entrenamiento.');
    } else {
      // Group by exercise name
      const grouped: any = {};
      data?.forEach((set: any) => {
        const exerciseName = set.ejercicios?.nombre || 'Ejercicio desconocido';
        if (!grouped[exerciseName]) {
          grouped[exerciseName] = [];
        }
        grouped[exerciseName].push(set);
      });
      
      const formatted = Object.keys(grouped).map(name => ({
        name,
        sets: grouped[name]
      }));
      
      setWorkoutDetails(formatted);
    }
    setDetailsLoading(false);
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  // Calculate empty days at the start (to align with week days)
  const firstDayOfWeek = startOfMonth(currentDate).getDay(); // 0 (Sun) to 6 (Sat)
  // Adjust to start Monday (Lunes) if preferred, but standard JS is Sun. 
  // Latino/Spanish often start Monday. Let's adjust to Monday = 0.
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const emptyDays = Array(adjustedFirstDay).fill(null);

  const renderDay = (day: Date | null, index: number) => {
    if (!day) return <View key={`empty-${index}`} style={styles.dayContainer} />;

    const hasWorkout = workouts.some(w => isSameDay(new Date(w.fecha), day));
    const isSelected = isSameDay(day, selectedDate);
    const isCurrentToday = isToday(day);
    const dateStr = format(day, 'yyyy-MM-dd');
    const isLifeSpent = profile?.missed_days_with_life?.includes(dateStr) || profile?.dias_vida_gastada?.includes(dateStr);
    const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
    const isMF = !isSaturday(day) && !isSunday(day);

    let dayStyle = {};
    let textStyle = {};

    if (hasWorkout) {
      dayStyle = styles.greenDay;
      textStyle = styles.whiteText;
    } else if (isCurrentToday) {
      dayStyle = styles.yellowDay;
      textStyle = styles.blackText;
    } else if (isLifeSpent) {
      dayStyle = styles.blueDay;
      textStyle = styles.whiteText;
    } else if (isPast && isMF) {
      dayStyle = styles.redDay;
      textStyle = styles.whiteText;
    }

    return (
      <TouchableOpacity 
        key={day.toString()} 
        style={[
            styles.dayContainer, 
            dayStyle,
            isSelected && styles.selectedDay,
            isCurrentToday && !isSelected && !hasWorkout && styles.todayMarker
        ]}
        onPress={() => setSelectedDate(day)}
      >
        <Text style={[
            styles.dayText, 
            textStyle,
            isSelected && styles.selectedDayText
        ]}>
          {format(day, 'd')}
        </Text>
        {hasWorkout && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
            <Ionicons name="chevron-back" size={24} color="#E8FB4B" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
          </Text>
          <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))}>
            <Ionicons name="chevron-forward" size={24} color="#E8FB4B" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekDays}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
            <Text key={day} style={styles.weekDayText}>{day}</Text>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.calendarGrid}>
          {emptyDays.concat(daysInMonth).map((day, index) => renderDay(day, index))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
           <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#4CAF50'}]} /><Text style={styles.legendText}>Entrenado</Text></View>
           <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#FFEB3B'}]} /><Text style={styles.legendText}>Hoy</Text></View>
           <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#3399FF'}]} /><Text style={styles.legendText}>Vida usada</Text></View>
           <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#F44336'}]} /><Text style={styles.legendText}>Faltado</Text></View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
           <LinearGradient colors={['#262626', '#1a1a1a']} style={styles.statCard}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statValue}>{profile?.streak || 0}</Text>
              <Text style={styles.statLabel}>Racha</Text>
           </LinearGradient>
           <LinearGradient colors={['#262626', '#1a1a1a']} style={styles.statCard}>
              <Text style={styles.statEmoji}>🧊</Text>
              <Text style={styles.statValue}>{profile?.lives ?? 3}</Text>
              <Text style={styles.statLabel}>Vidas</Text>
           </LinearGradient>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>
            {format(selectedDate, "eeee d 'de' MMMM", { locale: es })}
          </Text>
          
          {loading ? (
            <ActivityIndicator color="#E8FB4B" style={{ marginTop: 20 }} />
          ) : dayWorkouts.length > 0 ? (
            dayWorkouts.map(workout => (
              <TouchableOpacity 
                key={workout.id} 
                style={styles.workoutCard}
                onPress={() => showWorkoutSummary(workout)}
              >
                <View style={styles.workoutIcon}>
                  <Ionicons name="barbell" size={20} color="#000" />
                </View>
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutName}>{workout.nombre}</Text>
                  <Text style={styles.workoutTime}>
                    {format(new Date(workout.fecha), 'HH:mm')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#444" />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>No hay entrenamientos este día</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Workout Summary Modal */}
      <Modal visible={isSummaryVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#1a1a1a', '#000']} style={styles.summaryContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.summaryTitle}>{selectedWorkout?.nombre}</Text>
                <Text style={styles.summarySubtitle}>
                  {selectedWorkout && format(new Date(selectedWorkout.fecha), "d 'de' MMMM, HH:mm", { locale: es })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsSummaryVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {detailsLoading ? (
              <ActivityIndicator color="#E8FB4B" style={{ marginTop: 50 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {workoutDetails.map((item, idx) => (
                  <View key={idx} style={styles.summaryExerciseCard}>
                    <Text style={styles.summaryExerciseName}>{item.name}</Text>
                    <View style={styles.summarySetsGrid}>
                      {item.sets.map((set: any, sIdx: number) => (
                        <View key={set.id} style={styles.summarySetRow}>
                          <Text style={styles.summarySetNum}>{sIdx + 1}</Text>
                          <Text style={styles.summarySetWeight}>{set.peso} kg</Text>
                          <Text style={styles.summarySetReps}>{set.repeticiones} reps</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#262626' },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-around' },
  weekDayText: { color: '#666', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, marginBottom: 20 },
  dayContainer: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginVertical: 2 },
  dayText: { color: '#ccc', fontSize: 16, fontWeight: '600' },
  selectedDay: { backgroundColor: '#E8FB4B', borderWidth: 2, borderColor: '#fff' },
  selectedDayText: { color: '#000', fontWeight: '800' },
  todayMarker: { borderWidth: 2, borderColor: '#FFEB3B' },
  greenDay: { backgroundColor: '#4CAF50' },
  yellowDay: { backgroundColor: '#FFEB3B' },
  blueDay: { backgroundColor: '#3399FF' },
  redDay: { backgroundColor: '#F44336' },
  whiteText: { color: '#fff' },
  blackText: { color: '#000' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 15, marginBottom: 20, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#666', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 15, marginBottom: 30 },
  statCard: { flex: 1, padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#262626' },
  statEmoji: { fontSize: 24, marginBottom: 5 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#888', fontSize: 12, fontWeight: '700', marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E8FB4B', marginTop: 2 },
  detailsContainer: { padding: 20, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  detailsTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  workoutCard: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#262626' },
  workoutIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E8FB4B', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  workoutInfo: { flex: 1 },
  workoutName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workoutTime: { color: '#666', fontSize: 12, marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#444', marginTop: 10, fontSize: 16, fontWeight: '600' },
  
  // Summary Modal Styles
  summaryContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    width: '100%',
    padding: 25,
    borderTopWidth: 1,
    borderTopColor: '#262626',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  summarySubtitle: {
    color: '#E8FB4B',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  summaryExerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryExerciseName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
  },
  summarySetsGrid: {
    gap: 8,
  },
  summarySetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    gap: 15,
  },
  summarySetNum: {
    color: '#666',
    fontSize: 12,
    fontWeight: '900',
    width: 20,
  },
  summarySetWeight: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  summarySetReps: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
  },
});
