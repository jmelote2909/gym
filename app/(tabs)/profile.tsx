import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { useSettings } from '@/src/context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [initialNickname, setInitialNickname] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { t, colors } = useSettings();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpProgress, setXpProgress] = useState(0);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      const { data: profile } = await supabase
        .from('perfiles')
        .select('nombre_usuario, peso, estatura, url_avatar')
        .eq('id', user.id)
        .single();
      if (profile) {
        setNickname(profile.nombre_usuario || '');
        setInitialNickname(profile.nombre_usuario || '');
        setPeso(profile.peso ? profile.peso.toString() : '');
        setEstatura(profile.estatura ? profile.estatura.toString() : '');
        setAvatarUrl(profile.url_avatar || null);
      }

      // Fetch sessions for leveling
      const { count } = await supabase
        .from('sesiones_entrenamiento')
        .select('*', { count: 'exact', head: true })
        .eq('id_usuario', user.id);
      
      const sessionCount = count || 0;
      setTotalSessions(sessionCount);
      
      // Calculate Level (Square root based scaling)
      // Nivel 1: 0, Nivel 2: 4, Nivel 3: 9... (L = sqrt(S) + 1)
      const currentLevel = Math.floor(Math.sqrt(sessionCount)) + 1;
      setLevel(currentLevel);
      
      // Calculate progress to next level
      const nextLevelSessions = Math.pow(currentLevel, 2);
      const prevLevelSessions = Math.pow(currentLevel - 1, 2);
      const progress = (sessionCount - prevLevelSessions) / (nextLevelSessions - prevLevelSessions);
      setXpProgress(Math.min(Math.max(progress, 0), 1));
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  }

  async function uploadImage(uri: string) {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error: any) {
      Alert.alert('Error al subir imagen', error.message);
    } finally {
      setUploading(false);
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

    // 2. Update Nickname, Weight, Height, Avatar in 'perfiles' table
    const updateData: any = {
      peso: parseFloat(peso) || null,
      estatura: parseFloat(estatura) || null,
      url_avatar: avatarUrl
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.avatarLarge, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={isEditing ? pickImage : undefined}
            disabled={uploading}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={60} color={colors.primary} />
            )}
            {isEditing && (
              <View style={[styles.uploadBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                {uploading ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Ionicons name="camera" size={20} color={colors.background} />
                )}
              </View>
            )}
          </TouchableOpacity>
          {!isEditing && (
            <>
              <Text style={[styles.emailText, { color: colors.text }]}>{nickname || 'Sin nombre'}</Text>
              <Text style={[styles.memberSince, { color: colors.secondary }]}>{email}</Text>
            </>
          )}
          {isEditing && (
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
              <Text style={[styles.changePhotoText, { color: colors.primary }]}>{uploading ? 'Subiendo...' : t('change_photo')}</Text>
            </TouchableOpacity>
          )}

          {!isEditing && (
            <View style={[styles.levelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
               <View style={styles.levelHeader}>
                  <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
                     <Text style={[styles.levelText, { color: colors.background }]}>NIVEL {level}</Text>
                  </View>
                  <Text style={[styles.sessionsCount, { color: colors.secondary }]}>{totalSessions} Sesiones</Text>
               </View>
               <View style={[styles.levelBarContainer, { backgroundColor: colors.background }]}>
                  <View style={[styles.levelBarFill, { width: `${xpProgress * 100}%`, backgroundColor: colors.primary }]} />
               </View>
               <Text style={[styles.levelInfo, { color: colors.muted }]}>
                 {level < 200 ? `${Math.ceil(Math.pow(level, 2) - totalSessions)} entrenos más para Nivel ${level + 1}` : 'Nivel Máximo (Leyenda)'}
               </Text>
            </View>
          )}
        </View>

        {isEditing ? (
          <View style={[styles.editSection, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.secondary }]}>{t('nickname')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                value={nickname}
                onChangeText={setNickname}
                placeholder={t('nickname')}
                placeholderTextColor={colors.muted}
              />
            </View>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.secondary }]}>{t('weight')} (kg)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                  value={peso}
                  onChangeText={setPeso}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ width: 20 }} />
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.secondary }]}>{t('height')} (cm)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                  value={estatura}
                  onChangeText={setEstatura}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.secondary }]}>{t('change_password')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('change_password_hint')}
                placeholderTextColor={colors.muted}
                secureTextEntry
              />
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => setIsEditing(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.secondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleUpdateProfile} disabled={loading}>
                <Text style={styles.saveButtonText}>{loading ? '...' : t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => setIsEditing(true)}>
                <Ionicons name="create-outline" size={24} color={colors.secondary} />
                <Text style={[styles.menuText, { color: colors.text }]}>{t('edit_profile')}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={24} color={colors.secondary} />
                <Text style={[styles.menuText, { color: colors.text }]}>{t('notifications')}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/goals' as any)}>
                <Ionicons name="flag-outline" size={24} color={colors.secondary} />
                <Text style={[styles.menuText, { color: colors.text }]}>Mis Objetivos</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings' as any)}>
                <Ionicons name="settings-outline" size={24} color={colors.secondary} />
                <Text style={[styles.menuText, { color: colors.text }]}>{t('settings')}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <Ionicons name="shield-outline" size={24} color={colors.secondary} />
                <Text style={[styles.menuText, { color: colors.text }]}>{t('privacy')}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={[styles.signOutText, { color: colors.error }]}>{t('logout')}</Text>
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[styles.versionText, { color: colors.muted }]}>V 1.1.0 - GYM PRO GOLD</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
  },
  emailText: {
    fontSize: 26,
    fontWeight: '900',
  },
  memberSince: {
    fontSize: 14,
    marginTop: 5,
  },
  menuSection: {
    borderRadius: 20,
    padding: 5,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  menuText: {
    fontSize: 16,
    flex: 1,
    marginLeft: 15,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    gap: 10,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '800',
  },
  editSection: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    paddingVertical: 10,
    fontSize: 16,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  editActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  saveButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: '700',
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '800',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  uploadBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  changePhotoText: {
    fontWeight: '800',
    fontSize: 14,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  levelCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    marginTop: 25,
    borderWidth: 1,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '900',
  },
  sessionsCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  levelBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  levelBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  levelInfo: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  }
});
