import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'es' | 'en';
type Theme = 'dark' | 'light';

interface SettingsContextType {
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  t: (key: string) => string;
  colors: {
    background: string;
    text: string;
    card: string;
    border: string;
    primary: string;
    secondary: string;
    muted: string;
    error: string;
  };
}

const themeColors: Record<Theme, SettingsContextType['colors']> = {
  dark: {
    background: '#000',
    text: '#fff',
    card: '#1a1a1a',
    border: '#262626',
    primary: '#E8FB4B',
    secondary: '#888',
    muted: '#444',
    error: '#ff4444',
  },
  light: {
    background: '#f8f9fa',
    text: '#1a1a1a',
    card: '#ffffff',
    border: '#e9ecef',
    primary: '#8ea10e', // Slightly darker lime for light mode
    secondary: '#6c757d',
    muted: '#dee2e6',
    error: '#dc3545',
  }
};

const translations: Record<Language, Record<string, string>> = {
  es: {
    dashboard: 'Inicio',
    calendar: 'Calendario',
    social: 'Social',
    exercises: 'Ejercicios',
    profile: 'Perfil',
    settings: 'Ajustes',
    language: 'Idioma',
    theme: 'Tema',
    dark: 'Oscuro',
    light: 'Claro',
    logout: 'CERRAR SESIÓN',
    edit_profile: 'Editar Perfil',
    save: 'Guardar',
    cancel: 'Cancelar',
    weight: 'Peso',
    height: 'Estatura',
    nickname: 'Apodo',
    change_photo: 'Cambiar Foto',
    notifications: 'Notificaciones',
    new_alert: 'Nueva Alerta',
    streak: 'Racha',
    lives: 'Vidas',
    train_today: 'Registrar entrenamiento de hoy',
    already_trained: 'Hoy ya has entrenado',
    friend_activity: 'Actividad de amigos',
    no_friends: 'Aún no tienes amigos agregados.',
    no_requests: 'No tienes solicitudes pendientes.',
    confirm_delete: '¿Estás seguro?',
    delete_friend: 'Eliminar Amigo',
    change_password_hint: 'Ingresa nueva contraseña si deseas cambiarla',
    trained_today: 'Entrenado hoy',
    next_life_in: 'Siguiente vida en',
    active_streak: 'Racha activa',
    workout_summary: 'Resumen del entrenamiento',
    sets: 'series',
    reps: 'reps',
    add_friend: 'Añadir amigo',
    request_sent: 'Solicitud enviada',
    accept: 'Aceptar',
    reject: 'Rechazar',
    search: 'Buscar',
    my_friends: 'Mis Amigos',
    requests: 'Solicitudes',
    privacy: 'Privacidad',
    change_password: 'CAMBIAR CONTRASEÑA',
    create_account_subtitle: 'Crea tu cuenta para empezar',
    welcome_subtitle: 'Bienvenido de nuevo, guerrero',
    email: 'Correo electrónico',
    password: 'Contraseña',
    register: 'Registrarse',
    login: 'Iniciar Sesión',
    already_have_account: '¿Ya tienes cuenta? Inicia sesión',
    no_account: '¿No tienes cuenta? Registrate gratis',
    success: '¡Éxito!',
    account_created: 'Cuenta creada. Por favor, revisa tu correo para confirmar (si es necesario).',
    empty_workout: 'Entrenamiento vacío',
    add_exercise_hint: 'Añade al menos un ejercicio.',
    todays_workout: 'Entrenamiento de hoy',
    workout_saved: '¡Entrenamiento guardado!',
    workout_saved_subtitle: 'Buen trabajo, guerrero. Tu racha y récords han sido actualizados.',
    workout_saved_error: 'Se guardó el entreno, pero hubo un error al actualizar récords.',
    training: 'Entrenando',
    add_set: 'Añadir Serie',
    set: 'Serie',
    select_exercise: 'Seleccionar Ejercicio',
    no_exercises_created: 'No tienes ejercicios. Créalos en la pestaña Ejercicios primero.',
    no_workouts: 'No hay entrenamientos este día',
    trained: 'Entrenado',
    today: 'Hoy',
    life_used: 'Vida usada',
    missed: 'Faltado',
    my_exercises: 'Mis Ejercicios',
    manage_repertoire: 'Crea y gestiona tu repertorio',
    edit_exercise: 'Editar Ejercicio',
    new_exercise: 'Nuevo Ejercicio',
    delete_exercise: 'Eliminar Ejercicio',
    name_hint: 'Nombre (ej. Press Militar)',
    days_of_week: 'Días de la semana',
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
    no_notifications: 'No tienes notificaciones aún',
    no_friends_activity: 'Aún no hay actividad de tus amigos hoy. ¡Anímalos a entrenar!',
    search_warriors: 'Busca guerreros por nickname...'
  },
  en: {
    dashboard: 'Home',
    calendar: 'Calendar',
    social: 'Social',
    exercises: 'Exercises',
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    logout: 'LOG OUT',
    edit_profile: 'Edit Profile',
    save: 'Save',
    cancel: 'Cancel',
    weight: 'Weight',
    height: 'Height',
    nickname: 'Nickname',
    change_photo: 'Change Photo',
    notifications: 'Notifications',
    new_alert: 'New Alert',
    streak: 'Streak',
    lives: 'Lives',
    train_today: 'Register today\'s workout',
    already_trained: 'Already trained today',
    friend_activity: 'Friend activity',
    no_friends: 'No friends added yet.',
    no_requests: 'No pending requests.',
    confirm_delete: 'Are you sure?',
    delete_friend: 'Delete Friend',
    change_password_hint: 'Enter new password if you want to change it',
    trained_today: 'Trained today',
    next_life_in: 'Next life in',
    active_streak: 'Active streak',
    workout_summary: 'Workout summary',
    sets: 'sets',
    reps: 'reps',
    add_friend: 'Add friend',
    request_sent: 'Request sent',
    accept: 'Accept',
    reject: 'Reject',
    search: 'Search',
    my_friends: 'My Friends',
    requests: 'Requests',
    privacy: 'Privacy',
    change_password: 'CHANGE PASSWORD',
    create_account_subtitle: 'Create your account to get started',
    welcome_subtitle: 'Welcome back, warrior',
    email: 'Email address',
    password: 'Password',
    register: 'Sign Up',
    login: 'Log In',
    already_have_account: 'Already have an account? Log in',
    no_account: 'No account? Sign up for free',
    success: 'Success!',
    account_created: 'Account created. Please check your email to confirm (if necessary).',
    empty_workout: 'Empty workout',
    add_exercise_hint: 'Add at least one exercise.',
    todays_workout: 'Today\'s workout',
    workout_saved: 'Workout saved!',
    workout_saved_subtitle: 'Great job, warrior. Your streak and records have been updated.',
    workout_saved_error: 'Workout saved, but there was an error updating records.',
    training: 'Training',
    add_set: 'Add Set',
    set: 'Set',
    select_exercise: 'Select Exercise',
    no_exercises_created: 'You have no exercises. Create them in the Exercises tab first.',
    no_workouts: 'No workouts this day',
    trained: 'Trained',
    today: 'Today',
    life_used: 'Life used',
    missed: 'Missed',
    my_exercises: 'My Exercises',
    manage_repertoire: 'Create and manage your repertoire',
    edit_exercise: 'Edit Exercise',
    new_exercise: 'New Exercise',
    delete_exercise: 'Delete Exercise',
    name_hint: 'Name (e.g. Bench Press)',
    days_of_week: 'Days of the week',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    no_notifications: 'No notifications yet',
    no_friends_activity: 'No activity from your friends today. Encourage them to train!',
    search_warriors: 'Search warriors by nickname...'
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedLang = await AsyncStorage.getItem('app_language');
    const savedTheme = await AsyncStorage.getItem('app_theme');
    if (savedLang) setLanguageState(savedLang as Language);
    if (savedTheme) setThemeState(savedTheme as Theme);
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('app_language', lang);
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('app_theme', newTheme);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const colors = themeColors[theme];

  return (
    <SettingsContext.Provider value={{ language, theme, setLanguage, setTheme, t, colors }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
