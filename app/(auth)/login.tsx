import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleAuth() {
    setLoading(true);
    if (isRegistering) {
      if (!nickname) {
        Alert.alert('Error', 'Por favor, elige un nombre de usuario (nickname)');
        setLoading(false);
        return;
      }
      const parsedPeso = parseFloat(peso);
      const parsedEstatura = parseFloat(estatura);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nombre_usuario: nickname,
            peso: isNaN(parsedPeso) ? null : parsedPeso,
            estatura: isNaN(parsedEstatura) ? null : parsedEstatura,
          }
        }
      });
      if (error) {
        console.error('Signup error:', error);
        if (error.status === 400 && error.message.includes('already registered')) {
          Alert.alert('Error', 'Este correo ya está registrado. Intenta iniciar sesión.');
        } else {
          Alert.alert('Error al registrarse', error.message);
        }
        setLoading(false);
      } else {
        Alert.alert('¡Éxito!', 'Cuenta creada. Por favor, revisa tu correo para confirmar (si es necesario).');
        router.replace('/(tabs)');
      }
    } else {
      if (!email || !password) {
        Alert.alert('Error', 'Por favor, ingresa tu correo y contraseña');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        console.error('Login error:', error);
        if (error.status === 400 && error.message.includes('Invalid login credentials')) {
          Alert.alert('Error de acceso', 'Correo o contraseña incorrectos. Por favor, verifica tus datos.');
        } else {
          Alert.alert('Error', error.message);
        }
        setLoading(false);
      } else {
        router.push('/(tabs)' as any);
      }
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#1a1a1a', '#000000']}
        style={styles.background}
      />
      
      <View style={styles.formContainer}>
        <Text style={styles.title}>GYM PRO</Text>
        <Text style={styles.subtitle}>
          {isRegistering ? 'Crea tu cuenta para empezar' : 'Bienvenido de nuevo, guerrero'}
        </Text>

        <View style={styles.inputGroup}>
          {isRegistering && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nombre de usuario (Nickname)"
                placeholderTextColor="#666"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  placeholder="Peso (kg)"
                  placeholderTextColor="#666"
                  value={peso}
                  onChangeText={setPeso}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Estatura (cm)"
                  placeholderTextColor="#666"
                  value={estatura}
                  onChangeText={setEstatura}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
          <Text style={styles.switchText}>
            {isRegistering 
              ? '¿Ya tienes cuenta? Inicia sesión' 
              : '¿No tienes cuenta? Registrate gratis'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  button: {
    backgroundColor: '#E8FB4B', // Vibrant lime green for premium look
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    boxShadow: '0px 4px 8px rgba(232, 251, 75, 0.3)',
    elevation: 5,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  switchText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 25,
    fontSize: 14,
  },
});
