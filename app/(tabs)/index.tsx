import { calculateStreakAndLives } from '@/src/lib/streakLogic';
import { useSettings } from '@/src/context/SettingsContext';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
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
  const [userName, setUserName] = useState('user');
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [weight, setWeight] = useState('--');
  const [height, setHeight] = useState('--');
  const [hasTrainedToday, setHasTrainedToday] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [friendActivities, setFriendActivities] = useState<any[]>([]);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { t, colors, language } = useSettings();
  const dateLocale = language === 'es' ? es : enUS;
  const [currentBannerMessage, setCurrentBannerMessage] = useState<string | null>(null);

  const bannerOpacity = useSharedValue(0);
  const bannerTranslateY = useSharedValue(-100);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ translateY: bannerTranslateY.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      let channel: any = null;
      let alertChannel: any = null;

      async function getProfileAndActivity() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          // 1. Fetch user profile
          const { data, error } = await supabase
            .from('perfiles')
            .select('*, url_avatar')
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

            setUserName(data.nombre_usuario || user.email?.split('@')[0] || 'user');
            setStreak(sync.streak);
            setLives(sync.lives);
            setWeight(data.peso ? `${data.peso}kg` : '--');
            setHeight(data.estatura ? `${data.estatura}cm` : '--');
            setHasTrainedToday(sync.todayTrained);
            setEsAdmin(!!data.es_admin);
            setAvatarUrl(data.url_avatar || null);

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

          // 4. Setup Alert Subscription
          alertChannel = supabase
            .channel('global-alerts')
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'alertas_globales' },
              (payload: any) => {
                if (isMounted) {
                  setHasNewAlert(true);
                  setCurrentBannerMessage(payload.new.mensaje);
                  bannerTranslateY.value = withTiming(0, { duration: 500 });
                  bannerOpacity.value = withTiming(1, { duration: 500 });

                  setTimeout(() => {
                    bannerTranslateY.value = withTiming(-100, { duration: 500 });
                    bannerOpacity.value = withTiming(0, { duration: 500 });
                  }, 5000);
                }
              }
            )
            .subscribe();

          // 5. Check for unread alerts
          const { data: latestAlert } = await supabase
            .from('alertas_globales')
            .select('id, mensaje')
            .order('creado_el', { ascending: false })
            .limit(1)
            .single();

          if (latestAlert && isMounted) {
            const lastSeenId = await AsyncStorage.getItem('lastSeenAlertId');
            if (lastSeenId !== latestAlert.id.toString()) {
              setHasNewAlert(true);
              
              // Also show banner if it's new (user just opened app and hasn't seen it)
              setCurrentBannerMessage(latestAlert.mensaje);
              bannerTranslateY.value = withTiming(0, { duration: 500 });
              bannerOpacity.value = withTiming(1, { duration: 500 });

              setTimeout(() => {
                bannerTranslateY.value = withTiming(-100, { duration: 500 });
                bannerOpacity.value = withTiming(0, { duration: 500 });
              }, 5000);
            }
          }
        }
      }

      async function fetchFriendActivity(userId: string) {
        const { data: friendsData } = await supabase
          .from('amistades')
          .select('id_usuario, id_amigo')
          .or(`id_usuario.eq.${userId},id_amigo.eq.${userId}`)
          .eq('estado', 'aceptada');

        if (friendsData && friendsData.length > 0) {
          const friendIds = friendsData.map(f => f.id_usuario === userId ? f.id_amigo : f.id_usuario);
          const todayStr = format(new Date(), 'yyyy-MM-dd');

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
        if (alertChannel) supabase.removeChannel(alertChannel);
      };
    }, [])
  );

  const closeBanner = () => {
    bannerTranslateY.value = withTiming(-100, { duration: 500 });
    bannerOpacity.value = withTiming(0, { duration: 500 });
  };

  async function openAlert() {
    // Mark latest as seen
    const { data } = await supabase
      .from('alertas_globales')
      .select('id')
      .order('creado_el', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      await AsyncStorage.setItem('lastSeenAlertId', data.id.toString());
    }

    setHasNewAlert(false);
    router.push('/notifications' as any);
  }

  const formattedDate = language === 'es' 
    ? format(new Date(), "EEEE, d 'de' MMMM", { locale: es })
    : format(new Date(), "EEEE, MMMM d", { locale: enUS });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating Banner */}
      <Animated.View style={[styles.bannerContainer, bannerStyle]}>
        <LinearGradient 
          colors={['rgba(38, 38, 38, 0.95)', 'rgba(0, 0, 0, 0.95)']} 
          style={styles.bannerGradient}
        >
          <Ionicons name="megaphone" size={20} color="#E8FB4B" />
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Nueva Alerta</Text>
            <Text style={styles.bannerMessage} numberOfLines={2}>{currentBannerMessage}</Text>
          </View>
          <TouchableOpacity onPress={closeBanner} style={styles.bannerCloseButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.secondary }]}>{t('dashboard')}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{userName || 'Guerrero'} 🔥</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.profileButton, { marginRight: 10 }]} 
              onPress={openAlert}
            >
              <Ionicons name="notifications-outline" size={28} color={hasNewAlert ? colors.primary : colors.text} />
              {hasNewAlert && <View style={[styles.redDot, { borderColor: colors.background }]} />}
            </TouchableOpacity>
 
            {esAdmin && (
              <TouchableOpacity 
                style={[styles.profileButton, { marginRight: 10, borderColor: colors.primary, borderWidth: 1 }]} 
                onPress={() => router.push('/(admin)/admin' as any)}
              >
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile' as any)}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarMini} />
              ) : (
                <Ionicons name="person-circle-outline" size={32} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, flex: 1 }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{weight}</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>{t('weight')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{height}</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>{t('height')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
             <Ionicons name="flame" size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.primary }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>{t('streak')}</Text>
          </View>
        </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          <Text style={[styles.dateLabel, { color: colors.primary }]}>{capitalizedDate}</Text>
          <TouchableOpacity
            style={[styles.mainButton, hasTrainedToday && styles.disabledButton]}
            onPress={() => !hasTrainedToday && router.push('/workout/active')}
            disabled={hasTrainedToday}
          >
            <LinearGradient
              colors={hasTrainedToday ? ['#333', '#222'] : ['#E8FB4B', '#C9D93B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Ionicons
                name={hasTrainedToday ? "checkmark-circle" : "add-circle"}
                size={24}
                color={hasTrainedToday ? "#666" : "#000"}
              />
              <Text style={[styles.buttonText, hasTrainedToday && styles.disabledButtonText]}>
                {hasTrainedToday ? t('already_trained').toUpperCase() : t('train_today').toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('friend_activity')}</Text>
        </View>

        {friendActivities.length > 0 ? (
          friendActivities.map((activity) => (
            <View key={activity.id} style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={[styles.friendAvatar, { backgroundColor: colors.muted }]}>
                {activity.url_avatar ? (
                  <Image source={{ uri: activity.url_avatar }} style={styles.avatarMini} />
                ) : (
                  <Text style={[styles.friendLetter, { color: colors.text }]}>{activity.nombre_usuario?.[0]}</Text>
                )}
              </View>
              <View style={styles.friendInfo}>
                <Text style={[styles.friendName, { color: colors.text }]}>{activity.nombre_usuario}</Text>
                <Text style={[styles.friendStatus, { color: colors.primary }]}>{t('trained_today')}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            </View>
          ))
        ) : (
          <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.activityInfo}>
              <Text style={[styles.activityText, { color: colors.secondary }]}>
                {t('no_friends_activity')}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    padding: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#000',
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
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    color: '#E8FB4B',
    fontSize: 14,
  },
  activityCard: {
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
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
  bannerContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  bannerGradient: {
    padding: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 251, 75, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    color: '#E8FB4B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerMessage: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  bannerCloseButton: {
    padding: 5,
    marginLeft: 10,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  friendCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  friendLetter: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendStatus: {
    fontSize: 12,
    marginTop: 2,
  },
});
