import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/src/context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen() {
  const { language, setLanguage, theme, setTheme, t, colors } = useSettings();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Language Section */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('language')}</Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={[styles.option, { backgroundColor: colors.card, borderBottomColor: colors.border }, language === 'es' && { backgroundColor: colors.primary }]} 
            onPress={() => setLanguage('es')}
          >
            <Text style={[styles.optionText, { color: colors.text }, language === 'es' && { color: colors.background, fontWeight: '800' }]}>Español</Text>
            {language === 'es' && <Ionicons name="checkmark-circle" size={24} color={colors.background} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.option, { backgroundColor: colors.card, borderBottomColor: colors.border }, language === 'en' && { backgroundColor: colors.primary }]} 
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.optionText, { color: colors.text }, language === 'en' && { color: colors.background, fontWeight: '800' }]}>English</Text>
            {language === 'en' && <Ionicons name="checkmark-circle" size={24} color={colors.background} />}
          </TouchableOpacity>
        </View>

        {/* Theme Section */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('theme')}</Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={[styles.option, { backgroundColor: colors.card, borderBottomColor: colors.border }, theme === 'dark' && { backgroundColor: colors.primary }]} 
            onPress={() => setTheme('dark')}
          >
            <Text style={[styles.optionText, { color: colors.text }, theme === 'dark' && { color: colors.background, fontWeight: '800' }]}>{t('dark')}</Text>
            {theme === 'dark' && <Ionicons name="moon" size={20} color={colors.background} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.option, { backgroundColor: colors.card, borderBottomColor: colors.border }, theme === 'light' && { backgroundColor: colors.primary }]} 
            onPress={() => setTheme('light')}
          >
            <Text style={[styles.optionText, { color: colors.text }, theme === 'light' && { color: colors.background, fontWeight: '800' }]}>{t('light')}</Text>
            {theme === 'light' && <Ionicons name="sunny" size={20} color={colors.background} />}
          </TouchableOpacity>
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
          <Text style={[styles.infoText, { color: colors.secondary }]}>
            {language === 'es' 
              ? 'Algunos cambios pueden requerir reiniciar la aplicación para aplicarse por completo.'
              : 'Some changes may require restarting the application to take full effect.'}
          </Text>
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
  },
  sectionTitle: {
    color: '#E8FB4B',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 25,
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  optionActive: {
    backgroundColor: '#E8FB4B',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#000',
    fontWeight: '800',
  },
  infoBox: {
    flexDirection: 'row',
    marginTop: 40,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 15,
    alignItems: 'center',
    gap: 15,
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  }
});
