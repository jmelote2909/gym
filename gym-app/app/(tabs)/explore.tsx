import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState('');

  useEffect(() => {
    fetchExercises();
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
    if (!newExerciseName) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('ejercicios').insert([
      { 
        nombre: newExerciseName, 
        musculo_objetivo: newExerciseMuscle,
        id_usuario: user.id 
      }
    ]);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewExerciseName('');
      setNewExerciseMuscle('');
      setModalVisible(false);
      fetchExercises();
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
        <Text style={styles.title}>Mis Ejercicios</Text>
        <Text style={styles.subtitle}>Crea y gestiona tu repertorio</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#E8FB4B" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.exerciseCard}>
              <View>
                <Text style={styles.exerciseName}>{item.nombre}</Text>
                <Text style={styles.exerciseMuscle}>{item.musculo_objetivo || 'Cuerpo completo'}</Text>
              </View>
              <TouchableOpacity>
                <Ionicons name="ellipsis-vertical" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes ejercicios creados todavía.</Text>
          }
        />
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
            <Text style={styles.modalTitle}>Nuevo Ejercicio</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre (ej. Press Militar)"
              placeholderTextColor="#666"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Músculo (ej. Hombros)"
              placeholderTextColor="#666"
              value={newExerciseMuscle}
              onChangeText={setNewExerciseMuscle}
            />

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
});
