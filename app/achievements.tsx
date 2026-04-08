import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/context/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AchievementDetailModal from '../components/AchievementDetailModal';
import ProgressBar from '../components/ProgressBar';

interface Achievement {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  icono: string;
  categoria: string;
  requisito_valor: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export default function AchievementsScreen() {
  const router = useRouter();
  const { t, colors } = useSettings();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [stats, setStats] = useState({
    total: 0,
    unlocked: 0,
    percentage: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const categories = [
    { key: 'todos', label: 'Todos', icon: 'grid' },
    { key: 'racha', label: 'Racha', icon: 'flame' },
    { key: 'volumen', label: 'Volumen', icon: 'barbell' },
    { key: 'ejercicio', label: 'Ejercicio', icon: 'fitness' },
    { key: 'social', label: 'Social', icon: 'people' }
  ];

  useEffect(() => {
    fetchAchievements();
  }, []);

  async function fetchAchievements() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAchievements([]);
      setLoading(false);
      return;
    }

    // Obtener todos los logros
    const { data: allAchievements } = await supabase
      .from('logros')
      .select('*')
      .order('requisito_valor', { ascending: true });

    // Obtener logros desbloqueados del usuario
    const { data: unlockedAchievements } = await supabase
      .from('logros_usuario')
      .select('id_logro, desbloqueado_el')
      .eq('id_usuario', user.id);

    const unlockedIds = new Set(unlockedAchievements?.map((a: any) => a.id_logro) || []);
    const unlockedMap = new Map((unlockedAchievements || []).map((a: any) => [a.id_logro, a.desbloqueado_el]));

    const combined = (allAchievements || []).map((achievement: any) => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
      unlockedAt: unlockedMap.get(achievement.id)
    }));

    setAchievements(combined);
    
    const unlockedCount = combined.filter((a: any) => a.unlocked).length;
    setStats({
      total: combined.length,
      unlocked: unlockedCount,
      percentage: combined.length > 0 ? Math.round((unlockedCount / combined.length) * 100) : 0
    });

    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchAchievements();
  };

  const filteredAchievements = selectedCategory === 'todos' 
    ? achievements 
    : achievements.filter(a => a.categoria === selectedCategory);

  const openModal = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedAchievement(null);
  };

  async function toggleUnlock(achievement: Achievement) {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (achievement.unlocked) {
        // eliminar registro
        await supabase
          .from('logros_usuario')
          .delete()
          .eq('id_usuario', user.id)
          .eq('id_logro', achievement.id);
      } else {
        // insertar registro
        await supabase
          .from('logros_usuario')
          .insert([{ id_usuario: user.id, id_logro: achievement.id, desbloqueado_el: new Date().toISOString() }]);
      }
    } catch (err) {
      console.warn('toggleUnlock error', err);
    } finally {
      await fetchAchievements();
      setModalVisible(false);
    }
  }

  const renderAchievement = (achievement: Achievement, index: number) => {
    const isLocked = !achievement.unlocked;
    
    return (
      <Animated.View 
        key={achievement.id}
        entering={FadeInDown.delay(index * 50).springify()}
      >
        <TouchableOpacity activeOpacity={0.9} onPress={() => openModal(achievement)}>
          <View style={[
            styles.achievementCard,
            { 
              backgroundColor: colors.card, 
              borderColor: achievement.unlocked ? colors.primary : colors.border,
              opacity: isLocked ? 0.85 : 1
            }
          ]}>
            <View style={[
              styles.iconContainer,
              { 
                backgroundColor: achievement.unlocked ? colors.primary : colors.muted,
              }
            ]}>
              <Ionicons 
                name={achievement.icono as any} 
                size={32} 
                color={achievement.unlocked ? colors.background : colors.secondary} 
              />
            </View>
            
            <View style={styles.achievementInfo}>
              <View style={styles.achievementHeader}>
                <Text style={[styles.achievementName, { color: colors.text }]}>
                  {achievement.nombre}
                </Text>
                {achievement.unlocked && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </View>
              <Text style={[styles.achievementDescription, { color: colors.secondary }]}>
                {achievement.descripcion}
              </Text>
              {achievement.unlocked && achievement.unlockedAt && (
                <Text style={[styles.unlockedDate, { color: colors.primary }]}>
                  Desbloqueado: {new Date(achievement.unlockedAt).toLocaleDateString()}
                </Text>
              )}
              {!achievement.unlocked && (
                <>
                  <View style={styles.progressContainer}>
                    <Text style={[styles.progressText, { color: colors.muted }]}>
                      Objetivo: {achievement.requisito_valor}
                    </Text>
                  </View>

                  {/* ProgressBar placeholder: si más adelante guardas progreso real, pásalo como percentage */}
                  <View style={{ marginTop: 8 }}>
                    <ProgressBar percentage={0} height={8} backgroundColor={colors.border} fillColor={colors.primary} />
                  </View>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient 
        colors={[colors.card, colors.background]} 
        style={[styles.header, { borderBottomColor: colors.border }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Logros</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Stats Summary */}
        <View style={[styles.statsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.unlocked}</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>Desbloqueados</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>Total</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.percentage}%</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>Completado</Text>
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryChip,
                { 
                  backgroundColor: colors.background,
                  borderColor: colors.border 
                },
                selectedCategory === cat.key && { 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary 
                }
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Ionicons 
                name={cat.icon as any} 
                size={16} 
                color={selectedCategory === cat.key ? colors.background : colors.secondary} 
              />
              <Text style={[
                styles.categoryText,
                { color: colors.secondary },
                selectedCategory === cat.key && { color: colors.background }
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Achievements List */}
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filteredAchievements.map((achievement, index) => renderAchievement(achievement, index))}
          
          {filteredAchievements.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.secondary }]}>
                No hay logros en esta categoría
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <AchievementDetailModal
        visible={modalVisible}
        achievement={selectedAchievement}
        onClose={closeModal}
        onToggleUnlock={toggleUnlock}
        colors={colors}
      />
    </SafeAreaView>
  );
}

/* -- estilos (mantener los tuyos, añadí algunos pequeños ajustes si hacen falta) */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  statsCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 10,
  },
  categoriesContainer: {
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginRight: 10,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 15,
    gap: 15,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  achievementName: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  achievementDescription: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  unlockedDate: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
});