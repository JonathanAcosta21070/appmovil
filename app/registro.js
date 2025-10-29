//register.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// POR ESTA:
import API_CONFIG from '../config/api';
// Y luego usa:
const API_BASE_URL = API_CONFIG.API_BASE_URL;
export default function RegistroScreen() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'farmer',
    cultivo: '',
    ubicacion: ''
  });

  const handleRegistro = async () => {
    // Validaciones básicas
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
      return;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/registro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          cultivo: form.cultivo,
          ubicacion: form.ubicacion
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('user', JSON.stringify(data.usuario));
        Alert.alert('Éxito', 'Registro completado');
        
         // 🔄 TODOS redirigen al index
        router.replace('/');
      } else {
        Alert.alert('Error', data.error || 'Error en el registro');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>👨‍🌾 Registro</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        value={form.name}
        onChangeText={(text) => setForm({...form, name: text})}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={form.email}
        onChangeText={(text) => setForm({...form, email: text})}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={form.password}
        onChangeText={(text) => setForm({...form, password: text})}
        secureTextEntry
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirmar contraseña"
        value={form.confirmPassword}
        onChangeText={(text) => setForm({...form, confirmPassword: text})}
        secureTextEntry
      />

      <Text style={styles.label}>Tipo de usuario:</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            form.role === 'farmer' && styles.roleButtonSelected
          ]}
          onPress={() => setForm({...form, role: 'farmer'})}
        >
          <Text style={[
            styles.roleText,
            form.role === 'farmer' && styles.roleTextSelected
          ]}>
            👨‍🌾 Agricultor
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.roleButton,
            form.role === 'scientist' && styles.roleButtonSelected
          ]}
          onPress={() => setForm({...form, role: 'scientist'})}
        >
          <Text style={[
            styles.roleText,
            form.role === 'scientist' && styles.roleTextSelected
          ]}>
            🔬 Científico
          </Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.button} onPress={handleRegistro}>
        <Text style={styles.buttonText}>Registrarse</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
        <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#2e7d32',
    marginTop: 20,
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  roleButtonSelected: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  roleText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  roleTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkButton: {
    padding: 10,
  },
  linkText: {
    textAlign: 'center',
    color: '#4caf50',
    fontSize: 16,
  },
});