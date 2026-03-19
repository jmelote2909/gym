import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseWeight, setNewExerciseWeight] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    fetchExercises();
    
    // Suscribirse a cambios en tiempo real para ejercicios
    const channel = supabase
      .channel('exercises-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ejercicios' },
        () => fetchExercises()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchExercises() {
    setLoading(true);
    const { data, error } = await supabase
      .from('ejercicios')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) Alert.alert('Error', error.message);
    else setExercises(data || []);
    setLoading(false);
  }

  async function addExercise() {
    if (!newExerciseName || selectedDays.length === 0) {
      Alert.alert('Incompleto', 'Por favor, añade un nombre y al menos un día.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isEditing && selectedExercise) {
      const { error } = await supabase
        .from('ejercicios')
        .update({
          nombre: newExerciseName,
          peso: parseFloat(newExerciseWeight) || 0,
          dias_semana: selectedDays,
        })
        .eq('id', selectedExercise.id);

      if (error) Alert.alert('Error', error.message);
      else closeModal();
    } else {
      const { error } = await supabase.from('ejercicios').insert([
        { 
          nombre: newExerciseName, 
          peso: parseFloat(newExerciseWeight) || 0,
          dias_semana: selectedDays,
          id_usuario: user.id 
        }
      ]);

      if (error) Alert.alert('Error', error.message);
      else closeModal();
    }
  }

  function closeModal() {
    setNewExerciseName('');
    setNewExerciseWeight('');
    setSelectedDays([]);
    setModalVisible(false);
    setIsEditing(false);
    setSelectedExercise(null);
    fetchExercises();
  }

  async function deleteExercise() {
    if (!selectedExercise) return;
    
    Alert.alert('Eliminar', '¿Estás seguro de que quieres borrar este ejercicio?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('ejercicios').delete().eq('id', selectedExercise.id);
          if (error) Alert.alert('Error', error.message);
          setOptionsModalVisible(false);
          fetchExercises();
      }}
    ]);
  }

  function openEdit() {
    setNewExerciseName(selectedExercise.nombre);
    setNewExerciseWeight(selectedExercise.peso?.toString() || '');
    setSelectedDays(selectedExercise.dias_semana || []);
    setIsEditing(true);
    setOptionsModalVisible(false);
    setModalVisible(true);
  }

  const toggleDay = (day: string) => {
    setSelectedDays(current => 
      current.includes(day) 
        ? current.filter(d => d !== day) 
        : [...current, day]
    );
  };

  const exercisesByDay = DAYS.map(day => ({
    day,
    data: exercises.filter(ex => ex.dias_semana?.includes(day))
  })).filter(section => section.data.length > 0);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
        <Text style={styles.title}>Mis Ejercicios</Text>
        <Text style={styles.subtitle}>Crea y gestiona tu repertorio</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#E8FB4B" style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
           {exercisesByDay.length > 0 ? exercisesByDay.map((section) => (
             <View key={section.day} style={styles.daySection}>
                <Text style={styles.dayTitle}>{section.day}</Text>
                {section.data.map((item) => (
                  <View key={`${section.day}-${item.id}`} style={styles.exerciseCard}>
                    <View>
                      <Text style={styles.exerciseName}>{item.nombre}</Text>
                      <Text style={styles.exerciseMuscle}>{item.peso || 0} KG</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                        setSelectedExercise(item);
                        setOptionsModalVisible(true);
                    }}>
                      <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                ))}
             </View>
           )) : (
             <Text style={styles.emptyText}>No tienes ejercicios creados todavía.</Text>
           )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#000" />
      </TouchableOpacity>

      {/* Add Exercise Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEditing ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre (ej. Press Militar)"
              placeholderTextColor="#666"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Peso (Kg)"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={newExerciseWeight}
              onChangeText={setNewExerciseWeight}
            />

            <Text style={styles.daySelectorTitle}>Días de la semana:</Text>
            <View style={styles.daySelector}>
              {DAYS.map(day => (
                <TouchableOpacity 
                  key={day}
                  style={[styles.dayBubble, selectedDays.includes(day) && styles.dayBubbleSelected]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayBubbleText, selectedDays.includes(day) && styles.dayBubbleTextSelected]}>
                    {day.substring(0, 1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={addExercise}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={optionsModalVisible}
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.optionsContent}>
            <Text style={styles.optionsTitle}>{selectedExercise?.nombre}</Text>
            
            <TouchableOpacity style={styles.optionItem} onPress={openEdit}>
              <Ionicons name="create-outline" size={22} color="#fff" />
              <Text style={styles.optionText}>Editar Ejercicio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 0 }]} onPress={deleteExercise}>
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
              <Text style={[styles.optionText, { color: '#ff4444' }]}>Eliminar Ejercicio</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    padding: 30,
    paddingTop: 60,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    marginTop: 5,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  exerciseCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#262626',
  },
  exerciseName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  exerciseMuscle: {
    color: '#E8FB4B',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#E8FB4B',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#E8FB4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
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
  cancelButton: {
    backgroundColor: '#262626',
  },
  saveButton: {
    backgroundColor: '#E8FB4B',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  daySection: {
    marginBottom: 25,
  },
  dayTitle: {
    color: '#E8FB4B',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  daySelectorTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 5,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  dayBubble: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dayBubbleSelected: {
    backgroundColor: '#E8FB4B',
    borderColor: '#E8FB4B',
  },
  dayBubbleText: {
    color: '#888',
    fontWeight: '800',
    fontSize: 12,
  },
  dayBubbleTextSelected: {
    color: '#000',
  },
  optionsContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignSelf: 'center',
  },
  optionsTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    gap: 15,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
