import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useSettings } from '@/src/context/SettingsContext';

type SocialTab = 'buscar' | 'amigos' | 'solicitudes';

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<SocialTab>('buscar');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { t, colors } = useSettings();

  useEffect(() => {
    if (activeTab === 'amigos') fetchFriends();
    if (activeTab === 'solicitudes') fetchRequests();
  }, [activeTab]);

  useEffect(() => {
    // Carga inicial para los contadores
    fetchFriends();
    fetchRequests();

    // Suscribirse a cambios en tiempo real para actualizaciones instantáneas
    const channel = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amistades' },
        (payload) => {
          console.log('Cambio detectado en amistades:', payload);
          fetchFriends();
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function searchUsers() {
    if (searchQuery.length < 2) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    
    // 1. Buscar perfiles
    const { data: profiles, error: pError } = await supabase
      .from('perfiles')
      .select('id, nombre_usuario, url_avatar')
      .ilike('nombre_usuario', `%${searchQuery}%`)
      .neq('id', user.id) // No buscarse a sí mismo
      .limit(10);

    if (pError) {
      Alert.alert('Error', pError.message);
      setLoading(false);
      return;
    }

    if (!profiles || profiles.length === 0) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    // 2. Buscar relaciones existentes para estos perfiles
    const profileIds = profiles.map(p => p.id);
    const { data: relations, error: rError } = await supabase
      .from('amistades')
      .select('*')
      .filter('id_usuario', 'in', `(${user.id},${profileIds.join(',')})`)
      .filter('id_amigo', 'in', `(${user.id},${profileIds.join(',')})`);

    // Combinar datos
    const results = profiles.map(profile => {
      const relation = relations?.find(r => 
        (r.id_usuario === user.id && r.id_amigo === profile.id) || 
        (r.id_usuario === profile.id && r.id_amigo === user.id)
      );
      return { ...profile, relation };
    });

    setSearchResults(results);
    setLoading(false);
  }

  async function sendFriendRequest(friendId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('amistades').insert([
      { id_usuario: user.id, id_amigo: friendId, estado: 'pendiente' }
    ]);

    if (error) Alert.alert('Error', 'Ya hay una relación pendiente o activa.');
    else {
      Alert.alert('Éxito', 'Solicitud enviada.');
      // Actualizar localmente para mostrar el icono de enviado (?)
      setSearchResults(current => current.map(item => 
        item.id === friendId 
          ? { ...item, relation: { id_usuario: user.id, id_amigo: friendId, estado: 'pendiente' } }
          : item
      ));
    }
  }

  async function fetchFriends() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Obtener amistades aceptadas
    const { data: relations, error: rError } = await supabase
      .from('amistades')
      .select('*')
      .eq('estado', 'aceptada')
      .or(`id_usuario.eq.${user.id},id_amigo.eq.${user.id}`);

    if (rError) {
      Alert.alert('Error', rError.message);
      setLoading(false);
      return;
    }

    if (!relations || relations.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    // 2. Extraer IDs de los amigos (el que NO soy yo)
    const friendIds = relations.map(r => r.id_usuario === user.id ? r.id_amigo : r.id_usuario);

    // 3. Obtener perfiles de esos amigos
    const { data: profiles, error: pError } = await supabase
      .from('perfiles')
      .select('id, nombre_usuario, url_avatar')
      .in('id', friendIds);

    if (pError) {
      Alert.alert('Error', pError.message);
      setLoading(false);
      return;
    }

    // 4. Combinar datos para el renderizado
    const combined = relations.map(relation => {
      const friendId = relation.id_usuario === user.id ? relation.id_amigo : relation.id_usuario;
      const profile = profiles.find(p => p.id === friendId);
      return {
        ...relation,
        displayUser: profile?.nombre_usuario || 'Usuario desconocido',
        url_avatar: profile?.url_avatar
      };
    });

    setFriends(combined);
    setLoading(false);
  }

  async function fetchRequests() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Obtener solicitudes pendientes enviadas A MÍ
    const { data: relations, error: rError } = await supabase
      .from('amistades')
      .select('*')
      .eq('id_amigo', user.id)
      .eq('estado', 'pendiente');

    if (rError) {
      Alert.alert('Error', rError.message);
      setLoading(false);
      return;
    }

    if (!relations || relations.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // 2. Extraer IDs de quién envía
    const senderIds = relations.map(r => r.id_usuario);

    // 3. Obtener perfiles de los que envían
    const { data: profiles, error: pError } = await supabase
      .from('perfiles')
      .select('id, nombre_usuario, url_avatar')
      .in('id', senderIds);

    if (pError) {
      Alert.alert('Error', pError.message);
      setLoading(false);
      return;
    }

    // 4. Combinar
    const combined = relations.map(relation => {
      const profile = profiles.find(p => p.id === relation.id_usuario);
      return {
        ...relation,
        nombre_usuario: profile?.nombre_usuario || 'Alguien',
        url_avatar: profile?.url_avatar
      };
    });

    setRequests(combined);
    setLoading(false);
  }

  async function handleRequest(requestId: string, accept: boolean) {
    if (accept) {
      await supabase.from('amistades').update({ estado: 'aceptada' }).eq('id', requestId);
    } else {
      await supabase.from('amistades').delete().eq('id', requestId);
    }
    fetchRequests();
  }

  async function removeFriend(requestId: string) {
    Alert.alert('Eliminar Amigo', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('amistades').delete().eq('id', requestId);
          fetchFriends();
      }}
    ]);
  }

  const renderTabButton = (tab: SocialTab, title: string) => (
    <TouchableOpacity 
      style={[styles.tabButton, { backgroundColor: colors.card }, activeTab === tab && { backgroundColor: colors.primary }]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, { color: colors.secondary }, activeTab === tab && { color: colors.background }]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Social</Text>
        <View style={styles.tabContainer}>
          {renderTabButton('buscar', t('search').toUpperCase())}
          {renderTabButton('amigos', `${t('my_friends').toUpperCase()} (${friends.length})`)}
          {renderTabButton('solicitudes', `${t('requests').toUpperCase()} (${requests.length})`)}
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'buscar' && (
          <View style={{ flex: 1 }}>
            <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
              <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('search_warriors')}
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchUsers}
              />
            </View>
            {loading ? <ActivityIndicator color="#E8FB4B" style={{marginTop: 20}} /> : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.avatarSmall, { backgroundColor: colors.muted }]}>
                      {item.url_avatar ? (
                        <Image source={{ uri: item.url_avatar }} style={styles.avatarFull} />
                      ) : (
                        <Text style={[styles.avatarLetter, { color: colors.text }]}>{item.nombre_usuario?.[0]}</Text>
                      )}
                    </View>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.nombre_usuario}</Text>
                    {item.relation ? (
                      item.relation.estado === 'pendiente' ? (
                        <View style={[styles.addButton, { backgroundColor: colors.muted }]}>
                          <Ionicons 
                            name={item.relation.id_usuario === item.id ? "person-add" : "help-circle"} 
                            size={20} 
                            color={colors.text} 
                          />
                        </View>
                      ) : (
                        <View style={[styles.addButton, { backgroundColor: '#2e7d32' }]}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )
                    ) : (
                      <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => sendFriendRequest(item.id)}>
                        <Ionicons name="person-add" size={20} color={colors.background} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery.length < 2 ? 'Escribe al menos 2 letras' : 'No se han encontrado usuarios'}</Text>}
              />
            )}
          </View>
        )}

        {activeTab === 'amigos' && (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const displayUser = item.displayUser;
              return (
                <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                   <View style={[styles.avatarSmall, { backgroundColor: colors.muted }]}>
                      {item.url_avatar ? (
                        <Image source={{ uri: item.url_avatar }} style={styles.avatarFull} />
                      ) : (
                        <Text style={[styles.avatarLetter, { color: colors.text }]}>{displayUser?.[0]}</Text>
                      )}
                   </View>
                   <Text style={[styles.userName, { color: colors.text }]}>{displayUser}</Text>
                   <TouchableOpacity onPress={() => removeFriend(item.id)}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                   </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>Aún no tienes amigos agregados.</Text>}
          />
        )}

        {activeTab === 'solicitudes' && (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                 <View style={styles.avatarSmall}>
                    {item.url_avatar ? (
                      <Image source={{ uri: item.url_avatar }} style={styles.avatarFull} />
                    ) : (
                      <Text style={styles.avatarLetter}>{item.nombre_usuario?.[0]}</Text>
                    )}
                 </View>
                 <Text style={styles.userName}>{item.nombre_usuario} te ha invitado</Text>
                 <View style={styles.actionRow}>
                   <TouchableOpacity style={styles.acceptButton} onPress={() => handleRequest(item.id, true)}>
                      <Ionicons name="checkmark" size={20} color="#000" />
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.rejectButton} onPress={() => handleRequest(item.id, false)}>
                      <Ionicons name="close" size={20} color="#fff" />
                   </TouchableOpacity>
                 </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No tienes solicitudes pendientes.</Text>}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 25, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#262626' },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 20 },
  tabContainer: { flexDirection: 'row', gap: 10 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#262626' },
  tabButtonActive: { backgroundColor: '#E8FB4B' },
  tabButtonText: { color: '#888', fontWeight: '800', fontSize: 12 },
  tabButtonTextActive: { color: '#000' },
  searchBar: { flexDirection: 'row', backgroundColor: '#262626', borderRadius: 15, alignItems: 'center', paddingHorizontal: 15, marginBottom: 20 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 50, color: '#fff', fontSize: 16 },
  content: { flex: 1, padding: 20 },
  userCard: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#262626', gap: 15 },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '800' },
  avatarFull: { width: '100%', height: '100%', borderRadius: 20 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  addButton: { backgroundColor: '#E8FB4B', padding: 8, borderRadius: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  acceptButton: { backgroundColor: '#E8FB4B', padding: 8, borderRadius: 10 },
  rejectButton: { backgroundColor: '#333', padding: 8, borderRadius: 10 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40 },
});
