import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '@/src/context/SettingsContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

type SocialTab = 'feed' | 'buscar' | 'amigos' | 'solicitudes';

const REACTIONS = [
  { key: 'musculo', icon: '💪' },
  { key: 'fuego', icon: '🔥' },
  { key: 'aplauso', icon: '👏' },
  { key: 'corazon', icon: '❤️' },
];

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<SocialTab>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const { t, colors } = useSettings();

  useEffect(() => {
    fetchFriends();
    fetchRequests();
    fetchFeed();

    const channel = supabase
      .channel('social-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'amistades' }, () => {
        fetchFriends();
        fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reacciones_entrenamiento' }, () => {
        fetchFeed();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === 'amigos') fetchFriends();
    if (activeTab === 'solicitudes') fetchRequests();
    if (activeTab === 'feed') fetchFeed();
  }, [activeTab]);

  async function fetchFeed() {
    setFeedLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: relations } = await supabase
      .from('amistades').select('*').eq('estado', 'aceptada')
      .or(`id_usuario.eq.${user.id},id_amigo.eq.${user.id}`);

    const friendIds = relations?.map(r => r.id_usuario === user.id ? r.id_amigo : r.id_usuario) || [];

    if (friendIds.length === 0) { setFeed([]); setFeedLoading(false); return; }

    const { data: workouts } = await supabase
      .from('entrenamientos').select('id, nombre, creado_el, id_usuario')
      .in('id_usuario', friendIds).order('creado_el', { ascending: false }).limit(20);

    if (!workouts || workouts.length === 0) { setFeed([]); setFeedLoading(false); return; }

    const workoutIds = workouts.map(w => w.id);
    const friendProfileIds = [...new Set(workouts.map(w => w.id_usuario))];

    const [profilesRes, reactionsRes, myReactionsRes] = await Promise.all([
      supabase.from('perfiles').select('id, nombre_usuario, url_avatar, racha').in('id', friendProfileIds),
      supabase.from('reacciones_entrenamiento').select('id_entrenamiento, tipo_reaccion, id_usuario').in('id_entrenamiento', workoutIds),
      supabase.from('reacciones_entrenamiento').select('id_entrenamiento, tipo_reaccion').in('id_entrenamiento', workoutIds).eq('id_usuario', user.id),
    ]);

    const profiles = profilesRes.data || [];
    const allReactions = reactionsRes.data || [];
    const myReactions = myReactionsRes.data || [];

    const feedData = workouts.map(workout => {
      const profile = profiles.find(p => p.id === workout.id_usuario);
      const workoutReactions = allReactions.filter(r => r.id_entrenamiento === workout.id);
      const myReaction = myReactions.find(r => r.id_entrenamiento === workout.id);
      const reactionCounts: Record<string, number> = {};
      workoutReactions.forEach(r => { reactionCounts[r.tipo_reaccion] = (reactionCounts[r.tipo_reaccion] || 0) + 1; });
      return { ...workout, profile, reactionCounts, myReaction: myReaction?.tipo_reaccion || null };
    });

    setFeed(feedData);
    setFeedLoading(false);
  }

  async function toggleReaction(workoutId: string, reactionType: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const feedItem = feed.find(f => f.id === workoutId);
    if (!feedItem) return;

    if (feedItem.myReaction === reactionType) {
      await supabase.from('reacciones_entrenamiento').delete()
        .eq('id_entrenamiento', workoutId).eq('id_usuario', user.id);
    } else {
      if (feedItem.myReaction) {
        await supabase.from('reacciones_entrenamiento').delete()
          .eq('id_entrenamiento', workoutId).eq('id_usuario', user.id);
      }
      await supabase.from('reacciones_entrenamiento').insert([{
        id_entrenamiento: workoutId, id_usuario: user.id, tipo_reaccion: reactionType,
      }]);
    }

    setFeed(prev => prev.map(item => {
      if (item.id !== workoutId) return item;
      const newCounts = { ...item.reactionCounts };
      if (item.myReaction) {
        newCounts[item.myReaction] = Math.max(0, (newCounts[item.myReaction] || 1) - 1);
        if (newCounts[item.myReaction] === 0) delete newCounts[item.myReaction];
      }
      if (item.myReaction !== reactionType) {
        newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
      }
      return { ...item, myReaction: item.myReaction === reactionType ? null : reactionType, reactionCounts: newCounts };
    }));
  }

  function timeAgo(dateStr: string) {
    const diffH = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (diffH < 1) return 'Hace un momento';
    if (diffH < 24) return `Hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return diffD === 1 ? 'Ayer' : `Hace ${diffD} días`;
  }

  async function searchUsers() {
    if (searchQuery.length < 2) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profiles } = await supabase
      .from('perfiles').select('id, nombre_usuario, url_avatar')
      .ilike('nombre_usuario', `%${searchQuery}%`).neq('id', user.id).limit(10);
    const profileIds = profiles?.map(p => p.id) || [];
    const { data: relations } = profileIds.length > 0 ? await supabase
      .from('amistades').select('*')
      .filter('id_usuario', 'in', `(${user.id},${profileIds.join(',')})`)
      .filter('id_amigo', 'in', `(${user.id},${profileIds.join(',')})`) : { data: [] };
    setSearchResults((profiles || []).map(profile => ({
      ...profile,
      relation: relations?.find(r =>
        (r.id_usuario === user.id && r.id_amigo === profile.id) ||
        (r.id_usuario === profile.id && r.id_amigo === user.id)
      )
    })));
    setLoading(false);
  }

  async function sendFriendRequest(friendId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('amistades').insert([{ id_usuario: user.id, id_amigo: friendId, estado: 'pendiente' }]);
    if (error) Alert.alert('Error', 'Ya hay una relación pendiente o activa.');
    else {
      Alert.alert('Éxito', 'Solicitud enviada.');
      setSearchResults(cur => cur.map(item => item.id === friendId
        ? { ...item, relation: { id_usuario: user.id, id_amigo: friendId, estado: 'pendiente' } } : item));
    }
  }

  async function fetchFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: relations } = await supabase.from('amistades').select('*').eq('estado', 'aceptada').or(`id_usuario.eq.${user.id},id_amigo.eq.${user.id}`);
    if (!relations || relations.length === 0) { setFriends([]); return; }
    const friendIds = relations.map(r => r.id_usuario === user.id ? r.id_amigo : r.id_usuario);
    const { data: profiles } = await supabase.from('perfiles').select('id, nombre_usuario, url_avatar').in('id', friendIds);
    setFriends(relations.map(r => {
      const fId = r.id_usuario === user.id ? r.id_amigo : r.id_usuario;
      const p = profiles?.find(p => p.id === fId);
      return { ...r, displayUser: p?.nombre_usuario || 'Usuario', url_avatar: p?.url_avatar };
    }));
  }

  async function fetchRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: relations } = await supabase.from('amistades').select('*').eq('id_amigo', user.id).eq('estado', 'pendiente');
    if (!relations || relations.length === 0) { setRequests([]); return; }
    const { data: profiles } = await supabase.from('perfiles').select('id, nombre_usuario, url_avatar').in('id', relations.map(r => r.id_usuario));
    setRequests(relations.map(r => {
      const p = profiles?.find(p => p.id === r.id_usuario);
      return { ...r, nombre_usuario: p?.nombre_usuario || 'Alguien', url_avatar: p?.url_avatar };
    }));
  }

  async function handleRequest(requestId: string, accept: boolean) {
    if (accept) await supabase.from('amistades').update({ estado: 'aceptada' }).eq('id', requestId);
    else await supabase.from('amistades').delete().eq('id', requestId);
    fetchRequests();
  }

  async function removeFriend(requestId: string) {
    Alert.alert('Eliminar Amigo', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await supabase.from('amistades').delete().eq('id', requestId); fetchFriends(); } }
    ]);
  }

  const tabs: { key: SocialTab; label: string; badge?: number }[] = [
    { key: 'feed', label: 'Feed' },
    { key: 'buscar', label: t('search') },
    { key: 'amigos', label: t('my_friends'), badge: friends.length },
    { key: 'solicitudes', label: t('requests'), badge: requests.length },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Social</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, { backgroundColor: colors.background }, activeTab === tab.key && { backgroundColor: colors.primary }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabButtonText, { color: colors.secondary }, activeTab === tab.key && { color: colors.background }]}>
                {tab.label.toUpperCase()}{tab.badge ? ` (${tab.badge})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeTab === 'feed' && (
          feedLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
          feed.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin actividad</Text>
              <Text style={[styles.emptySubtitle, { color: colors.secondary }]}>
                Cuando tus amigos entrenen, verás su actividad aquí
              </Text>
            </View>
          ) : (
            <FlatList
              data={feed}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
                  <View style={[styles.feedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.feedHeader}>
                      <View style={[styles.feedAvatar, { backgroundColor: colors.muted }]}>
                        {item.profile?.url_avatar
                          ? <Image source={{ uri: item.profile.url_avatar }} style={styles.avatarFull} />
                          : <Text style={[styles.avatarLetter, { color: colors.text }]}>{item.profile?.nombre_usuario?.[0]?.toUpperCase()}</Text>}
                      </View>
                      <View style={styles.feedUserInfo}>
                        <Text style={[styles.feedUserName, { color: colors.text }]}>{item.profile?.nombre_usuario}</Text>
                        <Text style={[styles.feedTime, { color: colors.secondary }]}>{timeAgo(item.creado_el)}</Text>
                      </View>
                      {item.profile?.racha > 0 && (
                        <View style={[styles.streakBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Ionicons name="flame" size={14} color={colors.primary} />
                          <Text style={[styles.streakBadgeText, { color: colors.primary }]}>{item.profile.racha}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.workoutBanner, { backgroundColor: colors.background }]}>
                      <Ionicons name="barbell" size={16} color={colors.primary} />
                      <Text style={[styles.workoutBannerText, { color: colors.text }]}>{item.nombre || 'Entrenamiento'}</Text>
                    </View>
                    <View style={styles.reactionsRow}>
                      {REACTIONS.map(r => {
                        const count = item.reactionCounts?.[r.key] || 0;
                        const isActive = item.myReaction === r.key;
                        return (
                          <TouchableOpacity
                            key={r.key}
                            style={[styles.reactionBtn, { backgroundColor: isActive ? colors.primary + '25' : colors.background, borderColor: isActive ? colors.primary : 'transparent', borderWidth: 1.5 }]}
                            onPress={() => toggleReaction(item.id, r.key)}
                          >
                            <Text style={styles.reactionEmoji}>{r.icon}</Text>
                            {count > 0 && <Text style={[styles.reactionCount, { color: isActive ? colors.primary : colors.secondary }]}>{count}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </Animated.View>
              )}
            />
          )
        )}

        {activeTab === 'buscar' && (
          <View style={{ flex: 1 }}>
            <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
              <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
              <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder={t('search_warriors')} placeholderTextColor={colors.muted} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={searchUsers} />
            </View>
            {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.avatarSmall, { backgroundColor: colors.muted }]}>
                      {item.url_avatar ? <Image source={{ uri: item.url_avatar }} style={styles.avatarFull} /> : <Text style={[styles.avatarLetter, { color: colors.text }]}>{item.nombre_usuario?.[0]}</Text>}
                    </View>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.nombre_usuario}</Text>
                    {item.relation ? (
                      item.relation.estado === 'pendiente'
                        ? <View style={[styles.addButton, { backgroundColor: colors.muted }]}><Ionicons name="time" size={20} color={colors.text} /></View>
                        : <View style={[styles.addButton, { backgroundColor: '#2e7d32' }]}><Ionicons name="checkmark-circle" size={20} color="#fff" /></View>
                    ) : (
                      <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => sendFriendRequest(item.id)}>
                        <Ionicons name="person-add" size={20} color={colors.background} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.secondary }]}>{searchQuery.length < 2 ? t('search_min_chars') : t('no_results_found')}</Text>}
              />
            )}
          </View>
        )}

        {activeTab === 'amigos' && (
          <FlatList
            data={friends}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatarSmall, { backgroundColor: colors.muted }]}>
                  {item.url_avatar ? <Image source={{ uri: item.url_avatar }} style={styles.avatarFull} /> : <Text style={[styles.avatarLetter, { color: colors.text }]}>{item.displayUser?.[0]}</Text>}
                </View>
                <Text style={[styles.userName, { color: colors.text }]}>{item.displayUser}</Text>
                <TouchableOpacity onPress={() => removeFriend(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.secondary }]}>{t('no_friends_added')}</Text>}
          />
        )}

        {activeTab === 'solicitudes' && (
          <FlatList
            data={requests}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatarSmall, { backgroundColor: colors.muted }]}>
                  {item.url_avatar ? <Image source={{ uri: item.url_avatar }} style={styles.avatarFull} /> : <Text style={[styles.avatarLetter, { color: colors.text }]}>{item.nombre_usuario?.[0]}</Text>}
                </View>
                <Text style={[styles.userName, { color: colors.text }]}>{item.nombre_usuario} te ha invitado</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.acceptButton, { backgroundColor: colors.primary }]} onPress={() => handleRequest(item.id, true)}>
                    <Ionicons name="checkmark" size={20} color={colors.background} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectButton, { backgroundColor: colors.muted }]} onPress={() => handleRequest(item.id, false)}>
                    <Ionicons name="close" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.secondary }]}>{t('no_pending_requests')}</Text>}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16 },
  tabContainer: { gap: 8, paddingRight: 10 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  tabButtonText: { fontWeight: '800', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  feedCard: { borderRadius: 20, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  feedAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feedUserInfo: { flex: 1 },
  feedUserName: { fontSize: 15, fontWeight: '800' },
  feedTime: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  streakBadgeText: { fontWeight: '900', fontSize: 13 },
  workoutBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 14, padding: 12, borderRadius: 12, gap: 8 },
  workoutBannerText: { fontSize: 14, fontWeight: '700' },
  reactionsRow: { flexDirection: 'row', padding: 14, paddingTop: 0, gap: 8 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, gap: 5 },
  reactionEmoji: { fontSize: 18 },
  reactionCount: { fontSize: 13, fontWeight: '800' },
  searchBar: { flexDirection: 'row', borderRadius: 15, alignItems: 'center', paddingHorizontal: 15, marginBottom: 16 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 50, fontSize: 16 },
  userCard: { padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, gap: 12 },
  avatarSmall: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLetter: { fontWeight: '800', fontSize: 16 },
  avatarFull: { width: '100%', height: '100%', borderRadius: 999 },
  userName: { fontSize: 15, fontWeight: '700', flex: 1 },
  addButton: { padding: 8, borderRadius: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  acceptButton: { padding: 8, borderRadius: 10 },
  rejectButton: { padding: 8, borderRadius: 10 },
  emptyText: { textAlign: 'center', marginTop: 40, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
