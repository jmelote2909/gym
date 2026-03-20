import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateStreakAndLives } from '@/src/lib/streakLogic';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  withDelay
} from 'react-native-reanimated';

const AnimatedFire = () => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
    rotate.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 200 }),
        withTiming(5, { duration: 200 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` }
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={{ fontSize: 32 }}>🔥</Text>
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const [userName, setUserName] = useState('Guerrero');
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [weight, setWeight] = useState('--');
  const [height, setHeight] = useState('--');
  const [hasTrainedToday, setHasTrainedToday] = useState(false);
  const [friendActivities, setFriendActivities] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      let channel: any = null;

      async function getProfileAndActivity() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          // 1. Fetch user profile
          const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (!error && data) {
             const sync = calculateStreakAndLives(
              data.ultima_fecha_entreno,
              data.racha,
              data.vidas,
              data.siguiente_vida_en,
              data.dias_vida_gastada || []
            );

            setUserName(data.nombre_usuario || user.email?.split('@')[0] || 'Guerrero');
            setStreak(sync.streak);
            setLives(sync.lives);
            setWeight(data.peso ? `${data.peso}kg` : '--');
            setHeight(data.estatura ? `${data.estatura}cm` : '--');
            setHasTrainedToday(sync.todayTrained);

            if (sync.streak !== data.racha || sync.lives !== data.vidas) {
               await supabase.from('perfiles').update({
                 racha: sync.streak,
                 vidas: sync.lives,
                 siguiente_vida_en: sync.nextLifeAt,
                 dias_vida_gastada: sync.missedDaysWithLife
               }).eq('id', user.id);
            }
          }

          // 2. Fetch Friend Activity
          await fetchFriendActivity(user.id);
          
          // 3. Setup Realtime Subscription
          channel = supabase
            .channel('friend-activity')
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'perfiles' },
              async (payload) => {
                if (isMounted) {
                  // Check if the updated user is a friend
                  const { data: isFriend } = await supabase
                    .from('amistades')
                    .select('id')
                    .or(`and(id_usuario.eq.${user.id},id_amigo.eq.${payload.new.id}),and(id_usuario.eq.${payload.new.id},id_amigo.eq.${user.id})`)
                    .eq('estado', 'aceptada')
                    .single();

                  if (isFriend) {
                    await fetchFriendActivity(user.id);
                  }
                }
              }
            )
            .subscribe();
        }
      }

      async function fetchFriendActivity(userId: string) {
        // Find all accepted friends
        const { data: friendsData } = await supabase
          .from('amistades')
          .select('id_usuario, id_amigo')
          .or(`id_usuario.eq.${userId},id_amigo.eq.${userId}`)
          .eq('estado', 'aceptada');

        if (friendsData && friendsData.length > 0) {
          const friendIds = friendsData.map(f => f.id_usuario === userId ? f.id_amigo : f.id_usuario);
          const todayStr = format(new Date(), 'yyyy-MM-dd');

          // Get profiles of friends who trained today
          const { data: profiles } = await supabase
            .from('perfiles')
            .select('id, nombre_usuario, racha, ultima_fecha_entreno')
            .in('id', friendIds)
            .eq('ultima_fecha_entreno', todayStr);

          if (isMounted) {
            setFriendActivities(profiles || []);
          }
        } else {
          if (isMounted) setFriendActivities([]);
        }
      }

      getProfileAndActivity();

      return () => {
        isMounted = false;
        if (channel) supabase.removeChannel(channel);
      };
    }, [])
  );

  const formattedDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola,</Text>
            <Text style={styles.name}>{userName} 🔥</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
             <Ionicons name="person-circle-outline" size={40} color="#E8FB4B" />
          </TouchableOpacity>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <LinearGradient colors={['#262626', '#1a1a1a']} style={styles.statCard}>
            <AnimatedFire />
            <Text style={styles.statNumber}>{streak} DÍAS</Text>
            <Text style={styles.statLabel}>Mi Racha</Text>
          </LinearGradient>
          <LinearGradient colors={['#262626', '#1a1a1a']} style={styles.statCard}>
            <Text style={styles.statNumber}>{weight} / {height}</Text>
            <Text style={styles.statLabel}>Peso / Estatura</Text>
          </LinearGradient>
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          <Text style={styles.dateLabel}>{capitalizedDate}</Text>
          <TouchableOpacity 
            style={[styles.mainButton, hasTrainedToday && styles.disabledButton]} 
            onPress={() => !hasTrainedToday && router.push('/workout/active')}
            disabled={hasTrainedToday}
          >
             <LinearGradient 
               colors={hasTrainedToday ? ['#333', '#222'] : ['#E8FB4B', '#C9D93B']} 
               start={{x:0, y:0}} 
               end={{x:1, y:0}}
               style={styles.gradientButton}
             >
               <Ionicons 
                 name={hasTrainedToday ? "checkmark-circle" : "add-circle"} 
                 size={24} 
                 color={hasTrainedToday ? "#666" : "#000"} 
               />
               <Text style={[styles.buttonText, hasTrainedToday && styles.disabledButtonText]}>
                 {hasTrainedToday ? 'HOY YA HAS ENTRENADO' : 'REGISTRAR ENTRENAMIENTO DE HOY'}
               </Text>
             </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad de amigos</Text>
        </View>

        {friendActivities.length > 0 ? (
          friendActivities.map((activity) => (
            <View key={activity.id} style={styles.activityCard}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {activity.nombre_usuario?.substring(0, 2).toUpperCase() || '??'}
                </Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityText}>
                  <Text style={styles.boldText}>{activity.nombre_usuario}</Text> ha reanudado su racha a <Text style={styles.boldText}>{activity.racha} días</Text>
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.activityCard}>
            <View style={styles.activityInfo}>
              <Text style={styles.activityText}>
                Aún no hay actividad de tus amigos hoy. ¡Anímalos a entrenar!
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: {
    color: '#888',
    fontSize: 18,
  },
  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  profileButton: {
    padding: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statNumber: {
    color: '#E8FB4B',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
  },
  mainButton: {
    marginBottom: 40,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 15,
    gap: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  dateLabel: {
    color: '#E8FB4B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  disabledButton: {
    opacity: 0.8,
  },
  disabledButtonText: {
    color: '#666',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    color: '#E8FB4B',
    fontSize: 14,
  },
  activityCard: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#262626',
  },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#E8FB4B',
    fontWeight: 'bold',
  },
  activityInfo: {
    flex: 1,
  },
  activityText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  boldText: {
    color: '#fff',
    fontWeight: '700',
  },
  activityTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
});
