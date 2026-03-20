import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [initialNickname, setInitialNickname] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      const { data: profile } = await supabase
        .from('perfiles')
        .select('nombre_usuario, peso, estatura')
        .eq('id', user.id)
        .single();
      if (profile) {
        setNickname(profile.nombre_usuario || '');
        setInitialNickname(profile.nombre_usuario || '');
        setPeso(profile.peso ? profile.peso.toString() : '');
        setEstatura(profile.estatura ? profile.estatura.toString() : '');
      }
    }
  }

  async function handleUpdateProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Update Email/Password in Auth (if changed)
    const authUpdates: any = {};
    if (email !== user.email) authUpdates.email = email;
    if (newPassword) authUpdates.password = newPassword;

    if (Object.keys(authUpdates).length > 0) {
      const { error } = await supabase.auth.updateUser(authUpdates);
      if (error) {
        Alert.alert('Error Auth', error.message);
        setLoading(false);
        return;
      }
    }

    // 2. Update Nickname, Weight, Height in 'perfiles' table
    const updateData: any = {
      peso: parseFloat(peso) || null,
      estatura: parseFloat(estatura) || null
    };
    
    // Only update nickname if it changed to avoid unique constraint false positives
    if (nickname !== initialNickname) {
      updateData.nombre_usuario = nickname;
    }

    const { error: pError } = await supabase
      .from('perfiles')
      .update(updateData)
      .eq('id', user.id);

    if (pError) {
      if (pError.code === '23505') {
        Alert.alert('Error', 'Este nombre de usuario ya está en uso. Por favor, elige otro.');
      } else {
        Alert.alert('Error al actualizar', pError.message);
      }
      setLoading(false);
      return;
    }

    Alert.alert('Éxito', 'Perfil actualizado correctamente');
    setInitialNickname(nickname);
    setIsEditing(false);
    setNewPassword('');
    setLoading(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={60} color="#E8FB4B" />
          </View>
          {!isEditing && (
            <>
              <Text style={styles.emailText}>{nickname || 'Sin nombre'}</Text>
              <Text style={styles.memberSince}>{email}</Text>
            </>
          )}
        </View>

        {isEditing ? (
          <View style={styles.editForm}>
            <Text style={styles.label}>NICKNAME</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Tu nombre de usuario"
              placeholderTextColor="#666"
            />
            
            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Escribe para cambiar"
              placeholderTextColor="#666"
              secureTextEntry
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>PESO (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={peso}
                  onChangeText={setPeso}
                  placeholder="0.0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ESTATURA (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={estatura}
                  onChangeText={setEstatura}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.buttonGroup}>
               <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile} disabled={loading}>
                  {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
               </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={24} color="#888" />
              <Text style={styles.menuText}>Editar Perfil</Text>
              <Ionicons name="chevron-forward" size={20} color="#444" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="settings-outline" size={24} color="#888" />
              <Text style={styles.menuText}>Privacidad</Text>
              <Ionicons name="chevron-forward" size={20} color="#444" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>CERRAR SESIÓN</Text>
              <Ionicons name="log-out-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.versionText}>V 1.1.0 - GYM PRO GOLD</Text>
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
    padding: 30,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#262626',
  },
  emailText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  memberSince: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
  },
  menu: {
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    padding: 10,
    marginBottom: 40,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  menuText: {
    color: '#ccc',
    fontSize: 16,
    flex: 1,
    marginLeft: 15,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '800',
  },
  editForm: {
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    padding: 20,
  },
  label: {
    color: '#E8FB4B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  row: {
    flexDirection: 'row',
  },
  buttonGroup: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#262626',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#E8FB4B',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '800',
  },
  versionText: {
    color: '#333',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
  }
});
