import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function HomeScientist() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔬 Panel del Científico</Text>
      <Text style={styles.subtitle}>Bienvenido investigador</Text>
      
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => router.push('/analytics')}
      >
        <Text style={styles.menuIcon}>📈</Text>
        <Text style={styles.menuText}>Análisis de Datos</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => router.push('/reports')}
      >
        <Text style={styles.menuIcon}>📋</Text>
        <Text style={styles.menuText}>Generar Reportes</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => router.push('/recommendations-admin')}
      >
        <Text style={styles.menuIcon}>💡</Text>
        <Text style={styles.menuText}>Crear Recomendaciones</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#ff9800',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  menuButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
});