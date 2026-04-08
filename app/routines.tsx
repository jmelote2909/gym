import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, Modal, FlatList, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/context/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface RoutineExercise {
  id: string;
  id_ejercicio_catalogo: string;
  nombre: string;
  musculo_principal: string;
  orden: number;
  series_sugeridas: number;
  repeticiones_sugeridas: number;
  peso_sugerido: number;
}

interface Routine {
  id: string;
  nombre: string;
  descripcion: string;
  es_favorita: boolean;
  veces_usada: number;
  ejercicios?: RoutineExercise[];
}

export default function RoutinesScreen() {
  const router = useRouter();
  const { t, colors } = useSettings();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [catalogModal, setCatalogModal] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);
  const [catalogExercises, setCatalogExercises] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => { fetchRoutines(); fetchCatalog(); }, []);

  async function fetchRoutines() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('rutinas')
      .select('*')
      .eq('id_usuario', user.id)
      .order('es_favorita', { ascending: false })
      .order('veces_usada', { ascending: false });
    setRoutines(data || []);
    setLoading(false);
  }

  async function fetchCatalog() {
    const { data } = await supabase.from('catalogo_ejercicios').select('*').order('nombre');
    setCatalogExercises(data || []);
  }

  async function fetchRoutineExercises(routineId: string) {
    const { data } = await supabase
      .from('rutinas_ejercicios')
      .select('*, catalogo_ejercicios(nombre, musculo_principal)')
      .eq('id_rutina', routineId)
      .order('orden');
    const mapped = data?.map(d => ({
      id: d.id,
      id_ejercicio_catalogo: d.id_ejercicio_catalogo,
      nombre: d.catalogo_ejercicios?.nombre || '',
      musculo_principal: d.catalogo_ejercicios?.musculo_principal || '',
      orden: d.orden,
      series_sugeridas: d.series_sugeridas,
      repeticiones_sugeridas: d.repeticiones_sugeridas,
      peso_sugerido: d.peso_sugerido,
    })) || [];
    setRoutineExercises(mapped);
  }

  async function createRoutine() {
    if (!newName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('rutinas').insert([{
      id_usuario: user.id,
      nombre: newName.trim(),
      descripcion: newDesc.trim()
    }]).select().single();
    if (!error && data) {
      setModalVisible(false);
      setNewName('');
      setNewDesc('');
      fetchRoutines();
    }
  }

  async function toggleFavorite(routine: Routine) {
    await supabase.from('rutinas').update({ es_favorita: !routine.es_favorita }).eq('id', routine.id);
    fetchRoutines();
  }

  async function deleteRoutine(id: string) {
    Alert.alert('Eliminar rutina', '¿Estás seguro? Se eliminarán todos sus ejercicios.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('rutinas').delete().eq('id', id);
          fetchRoutines();
          setDetailModalVisible(false);
        }
      }
    ]);
  }

  async function addExerciseToRoutine(exercise: any) {
    if (!selectedRoutine) return;
    const orden = routineExercises.length;
    const { error } = await supabase.from('rutinas_ejercicios').insert([{
      id_rutina: selectedRoutine.id,
      id_ejercicio_catalogo: exercise.id,
      orden,
      series_sugeridas: 3,
      repeticiones_sugeridas: 10,
      peso_sugerido: 0
    }]);
    if (!error) {
      fetchRoutineExercises(selectedRoutine.id);
      setCatalogModal(false);
      setCatalogSearch('');
    }
  }

  async function removeExerciseFromRoutine(exerciseId: string) {
    await supabase.from('rutinas_ejercicios').delete().eq('id', exerciseId);
    if (selectedRoutine) fetchRoutineExercises(selectedRoutine.id);
  }

  function openRoutineDetail(routine: Routine) {
    setSelectedRoutine(routine);
    fetchRoutineExercises(routine.id);
    setDetailModalVisible(true);
  }

  const filteredCatalog = catalogExercises.filter(ex =>
    ex.nombre.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (ex.musculo_principal && ex.musculo_principal.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.card, colors.background]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Mis Rutinas</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color={colors.background} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {routines.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={64} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin rutinas todavía</Text>
              <Text style={[styles.emptySubtitle, { color: colors.secondary }]}>
                Crea tu primera rutina y empieza a entrenar con estructura
              </Text>
            </View>
          ) : (
            routines.map((routine, index) => (
              <Animated.View key={routine.id} entering={FadeInDown.delay(index * 60).springify()}>
                <TouchableOpacity
                  style={[styles.routineCard, { backgroundColor: colors.card, borderColor: routine.es_favorita ? colors.primary : colors.border }]}
                  onPress={() => openRoutineDetail(routine)}
                >
                  <View style={styles.routineLeft}>
                    <View style={[styles.routineIcon, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="barbell-outline" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.routineInfo}>
                      <Text style={[styles.routineName, { color: colors.text }]}>{routine.nombre}</Text>
                      {routine.descripcion ? (
                        <Text style={[styles.routineDesc, { color: colors.secondary }]} numberOfLines={1}>
                          {routine.descripcion}
                        </Text>
                      ) : null}
                      <Text style={[styles.routineMeta, { color: colors.muted }]}>
                        Usada {routine.veces_usada} veces
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(routine)}>
                    <Ionicons
                      name={routine.es_favorita ? 'star' : 'star-outline'}
                      size={22}
                      color={routine.es_favorita ? colors.primary : colors.muted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create Routine Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva Rutina</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Nombre (ej: Push Day)"
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Descripción (opcional)"
              placeholderTextColor={colors.muted}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.background }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={createRoutine}>
                <Text style={[styles.modalBtnText, { color: colors.background }]}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Routine Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <LinearGradient colors={[colors.card, colors.background]} style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="arrow-back" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {selectedRoutine?.nombre}
              </Text>
              <TouchableOpacity onPress={() => selectedRoutine && deleteRoutine(selectedRoutine.id)}>
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {routineExercises.map((ex, idx) => (
              <View
                key={ex.id}
                style={[styles.exerciseRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.orderBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.orderText, { color: colors.background }]}>{idx + 1}</Text>
                </View>
                <View style={styles.exInfo}>
                  <Text style={[styles.exName, { color: colors.text }]}>{ex.nombre}</Text>
                  <Text style={[styles.exDetails, { color: colors.secondary }]}>
                    {ex.series_sugeridas} series · {ex.repeticiones_sugeridas} reps · {ex.peso_sugerido}kg
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeExerciseFromRoutine(ex.id)}>
                  <Ionicons name="close-circle" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addExBtn, { backgroundColor: colors.primary }]}
              onPress={() => setCatalogModal(true)}
            >
              <Ionicons name="add" size={20} color={colors.background} />
              <Text style={[styles.addExText, { color: colors.background }]}>Añadir Ejercicio</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Catalog Modal */}
      <Modal visible={catalogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.catalogBox, { backgroundColor: colors.card }]}>
            <View style={styles.catalogHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Catálogo</Text>
              <TouchableOpacity onPress={() => { setCatalogModal(false); setCatalogSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Buscar ejercicio..."
                placeholderTextColor={colors.muted}
                value={catalogSearch}
                onChangeText={setCatalogSearch}
              />
            </View>
            <FlatList
              data={filteredCatalog}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.catalogItem, { borderBottomColor: colors.border }]}
                  onPress={() => addExerciseToRoutine(item)}
                >
                  <Text style={[styles.catalogName, { color: colors.text }]}>{item.nombre}</Text>
                  <Text style={[styles.catalogMuscle, { color: colors.secondary }]}>{item.musculo_principal}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  routineCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: 18, borderWidth: 2, marginBottom: 14
  },
  routineLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  routineIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  routineInfo: { flex: 1 },
  routineName: { fontSize: 17, fontWeight: '800' },
  routineDesc: { fontSize: 13, marginTop: 2 },
  routineMeta: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14 },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontWeight: '800', fontSize: 15 },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12
  },
  orderBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontWeight: '900', fontSize: 13 },
  exInfo: { flex: 1 },
  exName: { fontSize: 15, fontWeight: '700' },
  exDetails: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 18, borderRadius: 14, gap: 8, marginTop: 10
  },
  addExText: { fontWeight: '800', fontSize: 15 },
  catalogBox: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '80%', padding: 25 },
  catalogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 10, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15 },
  catalogItem: { paddingVertical: 16, borderBottomWidth: 1 },
  catalogName: { fontSize: 16, fontWeight: '700' },
  catalogMuscle: { fontSize: 12, marginTop: 3 },
});
