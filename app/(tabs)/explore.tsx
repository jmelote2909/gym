import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/context/SettingsContext';

export default function ExercisesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [catalogExercises, setCatalogExercises] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [userWeights, setUserWeights] = useState<Map<string, number>>(new Map());
  const [muscles, setMuscles] = useState<string[]>(['Todos']);
  const { t, colors } = useSettings();


  useEffect(() => {
    fetchMuscles();
    fetchInitialCatalog();
  }, []);

  async function fetchMuscles() {
    const { data, error } = await supabase
      .from('catalogo_ejercicios')
      .select('musculo_principal');

    if (!error && data) {
      const uniqueMuscles = Array.from(new Set(data.map(item => item.musculo_principal)))
        .filter(Boolean)
        .sort()
        .map(m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
      
      setMuscles(['Todos', ...uniqueMuscles]);
    }
  }

  async function fetchInitialCatalog() {
    setLoadingCatalog(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userRecords } = await supabase.from('ejercicios').select('nombre, peso').eq('id_usuario', user.id);
    const weightMap = new Map<string, number>();
    userRecords?.forEach(record => weightMap.set(record.nombre, record.peso));
    setUserWeights(weightMap);

    const { data, error } = await supabase
      .from('catalogo_ejercicios')
      .select('*')
      .order('nombre', { ascending: true });

    if (!error && data) {
      const mappedData = data.map(ex => ({ ...ex, previousWeight: weightMap.get(ex.nombre) || 0 }));
      setCatalogExercises(mappedData);
    }
    setLoadingCatalog(false);
  }

  async function searchExercises(query: string, muscle: string | null = selectedMuscle) {
    setSearchQuery(query);
    setLoadingCatalog(true);
    
    let dbQuery = supabase.from('catalogo_ejercicios').select('*');

    if (query && query.length > 1) {
      dbQuery = dbQuery.ilike('nombre', `%${query}%`);
    }

    if (muscle) {
      dbQuery = dbQuery.ilike('musculo_principal', `%${muscle}%`);
    }

    const { data, error } = await dbQuery.order('nombre', { ascending: true });

    if (!error && data) {
      const mappedData = data.map(ex => ({ ...ex, previousWeight: userWeights.get(ex.nombre) || 0 }));
      setCatalogExercises(mappedData);
    }
    setLoadingCatalog(false);
  }

  function handleMuscleSelect(muscle: string) {
    const newMuscle = (muscle === 'Todos' || selectedMuscle === muscle) ? null : muscle;
    setSelectedMuscle(newMuscle);
    searchExercises(searchQuery, newMuscle);
  }




  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('exercises')}</Text>
        
        <View style={styles.searchBox}>
          <View style={[styles.searchInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('search_exercises')}
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={searchExercises}
            />
          </View>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.muscleContainer}
        >
          {muscles.map(muscle => (
            <TouchableOpacity 
              key={muscle} 
              onPress={() => handleMuscleSelect(muscle)}
              style={[
                styles.muscleChip, 
                { backgroundColor: colors.background, borderColor: colors.border },
                (selectedMuscle === muscle || (muscle === 'Todos' && selectedMuscle === null)) && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
            >
              <Text style={[
                styles.muscleChipText, 
                { color: colors.secondary },
                (selectedMuscle === muscle || (muscle === 'Todos' && selectedMuscle === null)) && { color: colors.background }
              ]}>
                {t(muscle)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loadingCatalog ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
           {catalogExercises.length > 0 ? (
              catalogExercises.map((item) => (
                <View
                  key={item.id} 
                  style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                   <View style={styles.exerciseCardLeft}>
                     <View style={[styles.exerciseImageMini, { backgroundColor: colors.background }]}>
                       {item.imagen_url ? (
                         <Image source={{ uri: item.imagen_url }} style={styles.miniExerciseImg} />
                       ) : (
                         <Ionicons name="barbell-outline" size={20} color={colors.primary} />
                       )}
                     </View>
                     <View style={{ flex: 1 }}>
                       <Text style={[styles.exerciseName, { color: colors.text }]}>{item.nombre}</Text>
                       <Text style={[styles.exerciseDetails, { color: colors.secondary }]}>
                         {t(item.musculo_principal)} • {t(item.equipamiento)}
                       </Text>
                     </View>
                   </View>
                   {item.previousWeight > 0 && (
                     <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                       <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                         Último peso
                       </Text>
                       <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '900' }}>
                         {item.previousWeight}kg
                       </Text>
                     </View>
                   )}
                </View>
              ))
           ) : (
             <View style={styles.emptyContainer}>
               <Ionicons name="search-outline" size={60} color={colors.muted} />
               <Text style={[styles.emptyText, { color: colors.secondary }]}>
                 No se encontraron ejercicios
               </Text>
             </View>
           )}
        </ScrollView>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    paddingHorizontal: 20,
    fontSize: 28,
    fontWeight: '800',
  },
  searchBox: {
    padding: 20,
    paddingBottom: 15,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  muscleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  muscleChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  muscleChipText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 100,
  },
  exerciseCard: {
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
    borderWidth: 1,
  },
  exerciseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseImageMini: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniExerciseImg: {
    width: '100%',
    height: '100%',
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
  },
  exerciseDetails: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  adoptIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {},
  saveButton: {},
  cancelButtonText: {
    fontWeight: '600',
  },
  saveButtonText: {
    fontWeight: '700',
  },
});
