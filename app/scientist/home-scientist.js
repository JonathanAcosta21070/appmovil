// app/scientist/home-scientist.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

export default function HomeScientist() {
  const [assignedFarmers, setAssignedFarmers] = useState([]);
  const [recentData, setRecentData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, clearUser } = useSync();

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [user])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const [farmersData, sensorData] = await Promise.all([
        scientistService.getFarmers(user.id),
        scientistService.getRecentSensorData(user.id)
      ]);
      
      setAssignedFarmers(farmersData);
      setRecentData(sensorData);
      
    } catch (error) {
      console.log('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 🔹 Función para cerrar sesión
  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('localActions');
              router.replace('/');
            } catch (error) {
              console.log('❌ Error durante el cierre de sesión:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (moisture) => {
    if (!moisture) return '#666';
    if (moisture < 30) return '#f44336';
    if (moisture < 60) return '#4caf50';
    return '#2196f3';
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>🔬 Panel del Científico</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>🚪 Salir</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {user ? `Bienvenido, ${user.name}` : 'Bienvenido Tecnico'}
        </Text>
      </View>

      {/* Resumen Rápido */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{assignedFarmers.length}</Text>
          <Text style={styles.statLabel}>Agricultores</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {recentData.filter(d => d.moisture < 30).length}
          </Text>
          <Text style={styles.statLabel}>Necesitan Riego</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {recentData.length}
          </Text>
          <Text style={styles.statLabel}>Cultivos Activos</Text>
        </View>
      </View>

      {/* Agricultores Asignados */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Agricultores Asignados</Text>
        {isLoading ? (
          <Text style={styles.loadingText}>Cargando agricultores...</Text>
        ) : assignedFarmers.length === 0 ? (
          <Text style={styles.noDataText}>No hay agricultores asignados</Text>
        ) : (
          assignedFarmers.map((farmer) => (
            <TouchableOpacity 
              key={farmer._id}
              style={styles.farmerCard}
              onPress={() => router.push(`/scientist/farmer-details/${farmer._id}`)}
            >
              <View style={styles.farmerInfo}>
                <Text style={styles.farmerName}>{farmer.name}</Text>
                <Text style={styles.farmerDetails}>
                  {farmer.cultivo} • {farmer.ubicacion}
                </Text>
                <Text style={styles.farmerEmail}>{farmer.email}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Menú de Acciones */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>🔬 Acciones del Científico</Text>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => router.push('/scientist/reports')}
        >
          <Text style={styles.menuIcon}>📈</Text>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Reportes y Gráficas</Text>
            <Text style={styles.menuSubtext}>Estadísticas por cultivo</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => router.push('/scientist/recommendations')}
        >
          <Text style={styles.menuIcon}>💡</Text>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Generar Recomendaciones</Text>
            <Text style={styles.menuSubtext}>Asesorar a agricultores</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ... (los estilos se mantienen igual)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#7b1fa2',
    padding: 20,
    paddingTop: 50,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  logoutButton: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7b1fa2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  farmerCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  farmerInfo: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  farmerDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  farmerEmail: {
    fontSize: 12,
    color: '#999',
  },
  arrow: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  menuSection: {
    padding: 16,
  },
  menuButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  menuTextContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
});