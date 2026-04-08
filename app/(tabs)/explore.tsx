import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/context/SettingsContext';

export default function ExercisesScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseWeight, setNewExerciseWeight] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [catalogExercises, setCatalogExercises] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
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
    const { data, error } = await supabase
      .from('catalogo_ejercicios')
      .select('*')
      .limit(50)
      .order('nombre', { ascending: true });

    if (!error) setCatalogExercises(data || []);
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

    const { data, error } = await dbQuery.limit(50).order('nombre', { ascending: true });

    if (!error) {
      setCatalogExercises(data || []);
    }
    setLoadingCatalog(false);
  }

  function handleMuscleSelect(muscle: string) {
    const newMuscle = (muscle === 'Todos' || selectedMuscle === muscle) ? null : muscle;
    setSelectedMuscle(newMuscle);
    searchExercises(searchQuery, newMuscle);
  }

  function adoptExercise(item: any) {
    setNewExerciseName(item.nombre);
    setModalVisible(true);
    setIsEditing(false);
  }

  async function addExercise() {
    if (!newExerciseName) {
      Alert.alert('Incompleto', 'Por favor, añade un nombre.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('ejercicios').insert([
      { 
        nombre: newExerciseName, 
        peso: parseFloat(newExerciseWeight) || 0,
        id_usuario: user.id 
      }
    ]);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      closeModal();
      Alert.alert('Éxito', 'Ejercicio añadido a tu rutina.');
    }
  }

  function closeModal() {
    setNewExerciseName('');
    setNewExerciseWeight('');
    setModalVisible(false);
    setIsEditing(false);
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
               <TouchableOpacity 
                 key={item.id} 
                 style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                 onPress={() => adoptExercise(item)}
               >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>{item.nombre}</Text>
                    <Text style={[styles.exerciseDetails, { color: colors.secondary }]}>
                      {t(item.musculo_principal)} • {t(item.equipamiento)}
                    </Text>
                  </View>
                  <View style={[styles.adoptIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={20} color={colors.background} />
                  </View>
               </TouchableOpacity>
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

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]} 
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color={colors.background} />
      </TouchableOpacity>

      {/* Add Exercise Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{isEditing ? t('edit_exercise') : t('new_exercise')}</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              placeholder={t('name_hint')}
              placeholderTextColor={colors.muted}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
            />
            
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              placeholder={`${t('weight')} (Kg)`}
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={newExerciseWeight}
              onChangeText={setNewExerciseWeight}
            />


            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.background }]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]} 
                onPress={addExercise}
              >
                <Text style={[styles.saveButtonText, { color: colors.background }]}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
    borderWidth: 1,
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
