import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const [userName, setUserName] = useState('Guerrero');

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.email?.split('@')[0] || 'Guerrero');
      }
    }
    getProfile();
  }, []);

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
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Entrenos</Text>
          </LinearGradient>
          <LinearGradient colors={['#262626', '#1a1a1a']} style={styles.statCard}>
            <Text style={styles.statNumber}>85kg</Text>
            <Text style={styles.statLabel}>PB Bench</Text>
          </LinearGradient>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.mainButton} onPress={() => router.push('/workout/active')}>
           <LinearGradient 
             colors={['#E8FB4B', '#C9D93B']} 
             start={{x:0, y:0}} 
             end={{x:1, y:0}}
             style={styles.gradientButton}
           >
             <Ionicons name="add-circle" size={24} color="#000" />
             <Text style={styles.buttonText}>NUEVO ENTRENAMIENTO</Text>
           </LinearGradient>
        </TouchableOpacity>

        {/* Recent Activity Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad de amigos</Text>
        </View>

        <View style={styles.activityCard}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityText}>
              Aún no hay actividad de tus amigos. ¡Invítalos a unirse!
            </Text>
          </View>
        </View>

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
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
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
