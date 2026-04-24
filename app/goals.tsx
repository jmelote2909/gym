import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/context/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

interface Goal {
  id: string;
  tipo: 'peso_corporal' | 'frecuencia_semanal' | 'sesiones_totales' | 'pr_ejercicio';
  valor_objetivo: number;
  valor_actual: number;
  nombre_ejercicio?: string;
  completado: boolean;
}

export default function GoalsScreen() {
  const router = useRouter();
  const { t, colors } = useSettings();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGoalType, setNewGoalType] = useState<Goal['tipo']>('peso_corporal');
  const [newGoalValue, setNewGoalValue] = useState('');
  const [newGoalExercise, setNewGoalExercise] = useState('');

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('objetivos')
      .select('*')
      .eq('id_usuario', user.id)
      .order('creado_el', { ascending: false });
    
    setGoals(data || []);
    setLoading(false);
  }

  async function createGoal() {
    const val = parseFloat(newGoalValue);
    if (isNaN(val)) {
      Alert.alert('Error', 'Introduce un valor numérico válido');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('objetivos').insert([{
      id_usuario: user.id,
      tipo: newGoalType,
      valor_objetivo: val,
      nombre_ejercicio: newGoalType === 'pr_ejercicio' ? newGoalExercise : null,
      valor_actual: 0 // Will be synced later or manually
    }]);

    if (!error) {
      setModalVisible(false);
      setNewGoalValue('');
      setNewGoalExercise('');
      fetchGoals();
    }
  }

  async function deleteGoal(id: string) {
    Alert.alert('Eliminar objetivo', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('objetivos').delete().eq('id', id);
        fetchGoals();
      }}
    ]);
  }

  const getIcon = (type: Goal['tipo']) => {
    switch (type) {
      case 'peso_corporal': return 'scale-outline';
      case 'frecuencia_semanal': return 'calendar-outline';
      case 'sesiones_totales': return 'barbell-outline';
      case 'pr_ejercicio': return 'trophy-outline';
      default: return 'flag-outline';
    }
  };

  const getTitle = (goal: Goal) => {
    switch (goal.tipo) {
      case 'peso_corporal': return 'Peso Corporal';
      case 'frecuencia_semanal': return 'Días por Semana';
      case 'sesiones_totales': return 'Sesiones Totales';
      case 'pr_ejercicio': return goal.nombre_ejercicio || 'PR Ejercicio';
    }
  };

  const getProgress = (goal: Goal) => {
     if (goal.valor_objetivo === 0) return 0;
     const p = (goal.valor_actual / goal.valor_objetivo);
     return Math.min(Math.max(p, 0), 1);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.card, colors.background]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Mis Objetivos</Text>
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={24} color={colors.background} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {goals.length === 0 ? (
            <View style={styles.emptyContainer}>
               <Ionicons name="flag-outline" size={80} color={colors.muted} />
               <Text style={[styles.emptyTitle, { color: colors.text }]}>No tienes metas activas</Text>
               <Text style={[styles.emptySub, { color: colors.secondary }]}>Define tu próximo gran reto y hazle seguimiento aquí</Text>
               <TouchableOpacity 
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={() => setModalVisible(true)}
               >
                 <Text style={[styles.createBtnText, { color: colors.background }]}>NUEVO OBJETIVO</Text>
               </TouchableOpacity>
            </View>
          ) : (
            goals.map((goal, index) => (
              <Animated.View 
                key={goal.id} 
                entering={FadeInRight.delay(index * 100).springify()}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.goalTop}>
                  <View style={[styles.goalIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name={getIcon(goal.tipo)} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={[styles.goalTitle, { color: colors.text }]}>{getTitle(goal)}</Text>
                    <Text style={[styles.goalTarget, { color: colors.secondary }]}>
                      Meta: {goal.valor_objetivo}{goal.tipo === 'peso_corporal' ? 'kg' : goal.tipo === 'pr_ejercicio' ? 'kg' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteGoal(goal.id)}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>

                <View style={styles.progressSection}>
                  <View style={styles.progressLabels}>
                     <Text style={[styles.progressText, { color: colors.muted }]}>{Math.round(getProgress(goal) * 100)}% Completado</Text>
                     <Text style={[styles.progressValue, { color: colors.primary }]}>{goal.valor_actual} / {goal.valor_objetivo}</Text>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
                    <View style={[styles.progressFill, { width: `${getProgress(goal) * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* New Goal Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo Objetivo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.secondary }]}>Tipo de objetivo</Text>
            <View style={styles.typeGrid}>
              {[
                { type: 'peso_corporal', label: 'Peso', icon: 'scale-outline' },
                { type: 'frecuencia_semanal', label: 'Frecuencia', icon: 'calendar-outline' },
                { type: 'sesiones_totales', label: 'Sesiones', icon: 'barbell-outline' },
                { type: 'pr_ejercicio', label: 'Récord (PR)', icon: 'trophy-outline' }
              ].map(item => (
                <TouchableOpacity 
                  key={item.type}
                  style={[
                    styles.typeBtn, 
                    { borderColor: colors.border },
                    newGoalType === item.type && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
                  ]}
                  onPress={() => setNewGoalType(item.type as any)}
                >
                  <Ionicons name={item.icon as any} size={20} color={newGoalType === item.type ? colors.primary : colors.muted} />
                  <Text style={[styles.typeLabel, { color: newGoalType === item.type ? colors.primary : colors.secondary }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {newGoalType === 'pr_ejercicio' && (
              <>
                <Text style={[styles.label, { color: colors.secondary }]}>Nombre del ejercicio</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Ej: Press de banca"
                  placeholderTextColor={colors.muted}
                  value={newGoalExercise}
                  onChangeText={setNewGoalExercise}
                />
              </>
            )}

            <Text style={[styles.label, { color: colors.secondary }]}>Valor objetivo</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="0.0"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={newGoalValue}
              onChangeText={setNewGoalValue}
            />

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={createGoal}
            >
              <Text style={[styles.saveBtnText, { color: colors.background }]}>CREAR OBJETIVO</Text>
            </TouchableOpacity>
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
  title: { fontSize: 22, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  emptyContainer: { alignItems: 'center', paddingVertical: 100, gap: 15 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 40 },
  createBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 10 },
  createBtnText: { fontWeight: '900', letterSpacing: 1 },
  goalCard: { borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1 },
  goalTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  goalIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 18, fontWeight: '800' },
  goalTarget: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  progressSection: { gap: 10 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 11, fontWeight: '700' },
  progressValue: { fontSize: 13, fontWeight: '900' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  typeBtn: { width: '48%', padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 6 },
  typeLabel: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20, fontWeight: '600' },
  saveBtn: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontWeight: '900', letterSpacing: 1, fontSize: 15 },
});
