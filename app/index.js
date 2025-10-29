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
        'No se pudo conectar al servidor. Verifica:\n\n1. Que el servidor esté ejecutándose\n2. Que la IP sea correcta\n3. Que estés en la misma red WiFi',
        [
          { 
            text: 'Usar Modo Demo', 
            onPress: handleDemoLogin 
          },
          { 
            text: 'Reintentar', 
            style: 'cancel' 
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // 🔄 FUNCIÓN PARA MODO DEMO (cuando el servidor no está disponible)
  const handleDemoLogin = async () => {
    console.log('🚀 Iniciando sesión demo...');
    
    const usuarioDemo = {
      id: "demo-user-id",
      name: "Usuario Demo",
      email: "demo@agricola.com",
      role: "farmer",
      cultivo: "Maíz Demo",
      ubicacion: "Ejido Demo"
    };

    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('localActions');
      await AsyncStorage.removeItem('localCrops');

      await saveUser(usuarioDemo);

      console.log('✅ Sesión demo iniciada');
      Alert.alert('Modo Demo', 'Sesión demo iniciada correctamente');
      router.replace('/farmer/home-farmer');
    } catch (error) {
      console.log('❌ Error en demo login:', error);
      Alert.alert('Error', 'No se pudo iniciar sesión demo');
    }
  };

  // 🔄 FUNCIÓN PARA PRUEBA RÁPIDA
  const handleQuickTest = () => {
    setEmail('demo@demo.com');
    setPassword('demo');
    Alert.alert(
      'Datos de Prueba',
      'Se han llenado los campos con credenciales de demo. Presiona "Iniciar Sesión" para continuar.'
    );
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

      {/* BOTONES ADICIONALES PARA PRUEBAS */}
      <View style={styles.testButtonsContainer}>
        <TouchableOpacity 
          style={styles.demoButton} 
          onPress={handleDemoLogin}
        >
          <Text style={styles.demoButtonText}>🚀 Usar Modo Demo</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.testButton} 
          onPress={handleQuickTest}
        >
          <Text style={styles.testButtonText}>🧪 Llenar Datos Prueba</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push('/registro')} style={styles.linkButton}>
        <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>

      {/* INFO DE CONEXIÓN */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          📡 Servidor: {API_BASE_URL}
        </Text>
        <Text style={styles.infoHint}>
          Si hay problemas de conexión, usa "Modo Demo"
        </Text>
      </View>
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
  testButtonsContainer: {
    marginTop: 15,
    gap: 10,
  },
  demoButton: {
    backgroundColor: '#2196f3',
    padding: 12,
    borderRadius: 10,
  },
  demoButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
  },
  testButton: {
    backgroundColor: '#ff9800',
    padding: 12,
    borderRadius: 10,
  },
  testButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
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
  infoContainer: {
    marginTop: 30,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoText: {
    fontSize: 12,
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 5,
  },
  infoHint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});