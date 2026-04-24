import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const OFFLINE_WORKOUTS_KEY = 'pending_workouts';

export interface PendingWorkout {
  id: string;
  payload: {
    workout: any;
    series: any[];
    records: any[];
    notes?: any;
    profileUpdate: any;
  };
  timestamp: number;
}

export async function saveWorkoutOffline(workoutData: any) {
  try {
    const existing = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
    const pending: PendingWorkout[] = existing ? JSON.parse(existing) : [];
    
    pending.push({
      id: Math.random().toString(36).substr(2, 9),
      payload: workoutData,
      timestamp: Date.now()
    });

    await AsyncStorage.setItem(OFFLINE_WORKOUTS_KEY, JSON.stringify(pending));
    return true;
  } catch (e) {
    console.error('Error saving offline workout', e);
    return false;
  }
}

export async function hasPendingWorkouts() {
    const existing = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
    const pending: PendingWorkout[] = existing ? JSON.parse(existing) : [];
    return pending.length > 0;
}

export async function syncPendingWorkouts() {
  try {
    const existing = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
    if (!existing) return;
    
    const pending: PendingWorkout[] = JSON.parse(existing);
    if (pending.length === 0) return;

    for (const item of pending) {
      const { workout, series, records, notes, profileUpdate } = item.payload;
      
      // 1. Save Session
      const { data: session, error: sErr } = await supabase.from('sesiones_entrenamiento').insert([workout]).select().single();
      if (sErr) continue;

      // 2. Save Series (update ID)
      const seriesWithId = series.map(s => ({ ...s, id_sesion: session.id }));
      await supabase.from('series_entrenamiento').insert(seriesWithId);

      // 3. Save Records
      for (const rec of records) {
          if (rec.type === 'insert') {
              await supabase.from('ejercicios').insert([rec.data]);
          } else {
              await supabase.from('ejercicios').update(rec.data).eq('id_usuario', rec.userId).eq('nombre', rec.name);
          }
      }

      // 4. Save Notes
      if (notes) {
          await supabase.from('notas_entrenamiento').insert([{ ...notes, id_entrenamiento: session.id }]);
      }

      // 5. Update Profile
      if (profileUpdate) {
          await supabase.from('perfiles').update(profileUpdate).eq('id', workout.id_usuario);
      }
    }

    // Clear queue after success
    await AsyncStorage.removeItem(OFFLINE_WORKOUTS_KEY);
    return true;
  } catch (e) {
    console.error('Error syncing workouts', e);
    return false;
  }
}
