import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { supabase } from '@/src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsProvider } from '@/src/context/SettingsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (e) {
        console.error("Supabase auth session error:", e);
      } finally {
        setInitialized(true);
      }
    };

    initializeAuth();

    // Fallback if it hangs
    const timer = setTimeout(() => {
      if (!initialized) setInitialized(true);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }

    if (session) {
      scheduleDailyReminder();
    }
  }, [session, initialized, segments]);

  async function scheduleDailyReminder() {
    try {
      // Limpiamos programaciones previas para no duplicar
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Programar para las 09:20 cada día
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "¡No pierdas tu racha! 🔥",
          body: "Aún no has entrenado hoy. Entrena ahora para mantener tu racha y tus vidas intactas.",
          sound: true,
        },
        trigger: {
          hour: 9,
          minute: 20,
          repeats: true,
        },
      });
    } catch (e) {
      console.log("Error scheduling notification:", e);
    }
  }

  return (
    <SettingsProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: 'Notificaciones', headerTintColor: '#E8FB4B', headerStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="settings" options={{ title: 'Ajustes', headerTintColor: '#E8FB4B', headerStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SettingsProvider>
  );
}
