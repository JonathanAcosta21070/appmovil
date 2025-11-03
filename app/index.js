//index.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSync } from '../contexts/SyncContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { saveUser, API_BASE_URL } = useSync(); // ✅ Cambiado a saveUser

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa email y contraseña');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Intentando login para:', email);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // ✅ LIMPIAR DATOS ANTIGUOS
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('localActions');
        await AsyncStorage.removeItem('localCrops');

        // ✅ CORREGIDO: usar saveUser en lugar de updateUser
        await saveUser(data.usuario);

        console.log('✅ Usuario autenticado:', data.usuario.email);
        console.log('👤 Datos del usuario:', data.usuario);

        // 🔄 NAVEGACIÓN SEGÚN ROL
        switch (data.usuario.role) {
          case 'farmer':
            console.log('🚜 Redirigiendo a farmer...');
            router.replace('/farmer/home-farmer');
            break;
          case 'scientist':
            console.log('🔬 Redirigiendo a scientist...');
            router.replace('/scientist/home-scientist');
            break;
          default:
            console.log('🔀 Redirigiendo a farmer por defecto...');
            router.replace('/farmer/home-farmer');
        }
      } else {
        Alert.alert('Error', data.error || 'Credenciales incorrectas');
        console.log('❌ Error del servidor:', data.error);
      }
    } catch (error) {
      console.log('❌ Error en login:', error);
      Alert.alert(
        'Error de Conexión', 
        'No se pudo conectar al servidor. Verifica tu conexión a internet y que el servidor esté disponible.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌱 Chinampa</Text>
      <Text style={styles.subtitle}>Agricultura Inteligente</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#999"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#999"
      />

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/registro')} style={styles.linkButton}>
        <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2e7d32',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkButton: {
    padding: 10,
    marginTop: 20,
  },
  linkText: {
    textAlign: 'center',
    color: '#4caf50',
    fontSize: 16,
  },
});