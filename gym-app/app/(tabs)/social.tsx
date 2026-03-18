import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type SocialTab = 'buscar' | 'amigos' | 'solicitudes';

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<SocialTab>('buscar');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'amigos') fetchFriends();
    if (activeTab === 'solicitudes') fetchRequests();
  }, [activeTab]);

  async function searchUsers() {
    if (searchQuery.length < 2) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre_usuario, url_avatar')
      .ilike('nombre_usuario', `%${searchQuery}%`)
      .neq('id', user?.id) // No buscarse a sí mismo
      .limit(10);

    if (error) Alert.alert('Error', error.message);
    else setSearchResults(data || []);
    setLoading(false);
  }

  async function sendFriendRequest(friendId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('amistades').insert([
      { id_usuario: user.id, id_amigo: friendId, estado: 'pendiente' }
    ]);

    if (error) Alert.alert('Error', 'Ya hay una relación pendiente o activa.');
    else Alert.alert('Éxito', 'Solicitud enviada.');
  }

  async function fetchFriends() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('amistades')
      .select(`
        id,
        estado,
        perfiles!amistades_id_amigo_fkey (id, nombre_usuario),
        sender:perfiles!amistades_id_usuario_fkey (id, nombre_usuario)
      `)
      .eq('estado', 'aceptada')
      .or(`id_usuario.eq.${user.id},id_amigo.eq.${user.id}`);

    if (error) Alert.alert('Error', error.message);
    else setFriends(data || []);
    setLoading(false);
  }

  async function fetchRequests() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('amistades')
      .select('*, perfiles!amistades_id_usuario_fkey(nombre_usuario)')
      .eq('id_amigo', user.id)
      .eq('estado', 'pendiente');

    if (error) Alert.alert('Error', error.message);
    else setRequests(data || []);
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
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
        <Text style={styles.title}>Social</Text>
        <View style={styles.tabContainer}>
          {renderTabButton('buscar', 'BUSCAR')}
          {renderTabButton('amigos', 'MIS AMIGOS')}
          {renderTabButton('solicitudes', `SOLICITUDES (${requests.length})`)}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {activeTab === 'buscar' && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Busca guerreros por nickname..."
                placeholderTextColor="#666"
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
                  <View style={styles.userCard}>
                    <View style={styles.avatarSmall}><Text style={styles.avatarLetter}>{item.nombre_usuario?.[0]}</Text></View>
                    <Text style={styles.userName}>{item.nombre_usuario}</Text>
                    <TouchableOpacity style={styles.addButton} onPress={() => sendFriendRequest(item.id)}>
                      <Ionicons name="person-add" size={20} color="#000" />
                    </TouchableOpacity>
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
              // Decide whose name to show (the one that isn't me)
              const displayUser = item.perfiles?.nombre_usuario || item.sender?.nombre_usuario;
              return (
                <View style={styles.userCard}>
                   <View style={styles.avatarSmall}><Text style={styles.avatarLetter}>{displayUser?.[0]}</Text></View>
                   <Text style={styles.userName}>{displayUser}</Text>
                   <TouchableOpacity onPress={() => removeFriend(item.id)}>
                      <Ionicons name="trash-outline" size={20} color="#ff4444" />
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
                 <View style={styles.avatarSmall}><Text style={styles.avatarLetter}>{item.perfiles?.nombre_usuario?.[0]}</Text></View>
                 <Text style={styles.userName}>{item.perfiles?.nombre_usuario} te ha invitado</Text>
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
  userCard: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderHeight: 1, borderColor: '#262626', gap: 15 },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '800' },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  addButton: { backgroundColor: '#E8FB4B', padding: 8, borderRadius: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  acceptButton: { backgroundColor: '#E8FB4B', padding: 8, borderRadius: 10 },
  rejectButton: { backgroundColor: '#333', padding: 8, borderRadius: 10 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40 },
});
