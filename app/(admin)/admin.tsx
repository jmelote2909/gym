import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function AdminScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('racha', { ascending: false });

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  async function sendAlert() {
    if (!alertMessage.trim()) {
      Alert.alert('Error', 'Escribe un mensaje para la alerta');
      return;
    }

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('alertas_globales')
      .insert([
        { mensaje: alertMessage.trim(), id_autor: user?.id }
      ]);

    if (error) {
      Alert.alert('Error al enviar', error.message);
    } else {
      Alert.alert('Éxito', 'Alerta global enviada correctamente');
      setAlertMessage('');
    }
    setSending(false);
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Panel de Admin</Text>
          <View style={{ width: 28 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color="#E8FB4B" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Resumen de Usuarios ({users.length})</Text>
          
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.nombre_usuario || 'Sin nombre'}</Text>
                <Text style={styles.userStats}>
                  Racha: {user.racha} | Vidas: {user.vidas}
                </Text>
              </View>
              <View style={styles.userRole}>
                {user.es_admin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
          
          <View style={styles.actionsBox}>
            <Text style={styles.sectionTitle}>Enviar Alerta Global 🔔</Text>
            <TextInput
              style={styles.input}
              placeholder="Escribe el mensaje de la alerta..."
              placeholderTextColor="#666"
              value={alertMessage}
              onChangeText={setAlertMessage}
              multiline
            />
            <TouchableOpacity 
              style={[styles.actionButton, sending && { opacity: 0.7 }]} 
              onPress={sendAlert}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="megaphone" size={24} color="#000" />
                  <Text style={styles.actionButtonText}>Enviar a todos los usuarios</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    color: '#E8FB4B',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
    marginTop: 10,
  },
  userCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userStats: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  userRole: {
    marginLeft: 10,
  },
  adminBadge: {
    backgroundColor: '#E8FB4B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  adminBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  actionsBox: {
    marginTop: 30,
    paddingBottom: 50,
  },
  actionButton: {
    backgroundColor: '#E8FB4B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 10,
    marginTop: 10,
  },
  actionButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#262626',
  },
});
