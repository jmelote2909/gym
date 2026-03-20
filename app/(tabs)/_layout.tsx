import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    async function checkRequests() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Initial fetch
        const { count } = await supabase
          .from('amistades')
          .select('id', { count: 'exact', head: true })
          .eq('id_amigo', user.id)
          .eq('estado', 'pendiente');
        
        if (isMounted) setPendingRequests(count || 0);

        // Subscription
        channel = supabase
          .channel('social-badge')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'amistades' },
            async () => {
              const { count: newCount } = await supabase
                .from('amistades')
                .select('id', { count: 'exact', head: true })
                .eq('id_amigo', user.id)
                .eq('estado', 'pendiente');
              if (isMounted) setPendingRequests(newCount || 0);
            }
          )
          .subscribe();
      }
    }

    checkRequests();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#E8FB4B',
        tabBarInactiveTintColor: '#666',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#333',
          paddingBottom: 5,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} />,
          tabBarBadge: pendingRequests > 0 ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#FF3B30',
            maxWidth: 10,
            maxHeight: 10,
            borderRadius: 5,
            marginTop: 4,
          }
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Ejercicios',
          tabBarIcon: ({ color }) => <Ionicons name="barbell" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
