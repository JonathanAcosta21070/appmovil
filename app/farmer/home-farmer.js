// app/farmer/home-farmer.js - VERSIÓN CON ESPACIO AL FINAL
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

export default function HomeFarmer() {
  const [lastData, setLastData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { clearUser } = useSync();
  
  // 🔹 Usar el contexto global
  const { 
    isConnected, 
    isSyncing, 
    unsyncedCount, 
    user, 
    syncLocalDataToCloud,
    API_BASE_URL
  } = useSync();

  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 Pantalla home-farmer enfocada');
      loadDataFromMongoDB();
    }, [])
  );

  useEffect(() => {
    console.log('🔍 Estado del usuario:', user ? `Conectado como ${user.email}` : 'No hay usuario');
    
    if (user) {
      loadDataFromMongoDB();
    } else {
      loadUserFromStorage();
    }
  }, [user]);

  // 🔹 Función para cargar usuario desde storage
  const loadUserFromStorage = async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        const userData = JSON.parse(userString);
        console.log('📱 Usuario cargado desde storage:', userData.email);
        
        if (userData.id && userData.email) {
          loadDataFromMongoDB();
        } else {
          console.log('❌ Usuario incompleto en storage');
          await AsyncStorage.removeItem('user');
          router.replace('/');
        }
      } else {
        console.log('❌ No hay usuario en storage');
        router.replace('/');
      }
    } catch (error) {
      console.log('❌ Error cargando usuario:', error);
      router.replace('/');
    }
  };

  // 🔹 Función mejorada para cargar datos
  const loadDataFromMongoDB = async () => {
    try {
      setIsLoading(true);
      
      if (!user || !user.id) {
        console.log('⚠️ Esperando usuario...');
        return;
      }
      
      console.log('👤 Cargando datos para usuario:', user.email);

      // ✅ Cargar datos del sensor
      const sensorResponse = await fetch(`${API_BASE_URL}/sensor-data/latest`, {
        headers: {
          'Authorization': user.id
        }
      });
      
      if (sensorResponse.ok) {
        const sensorData = await sensorResponse.json();
        console.log('📈 Datos de sensor recibidos:', sensorData);
        setLastData(sensorData);
      } else {
        console.log('❌ Error en sensor response:', sensorResponse.status);
        setLastData(null);
      }

    } catch (error) {
      console.log('❌ Error loading data from MongoDB:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Función para forzar sincronización
  const handleForceSync = async () => {
    setIsLoading(true);
    try {
      const success = await syncLocalDataToCloud();
      if (success) {
        await loadDataFromMongoDB();
        Alert.alert('✅ Éxito', 'Datos sincronizados correctamente');
      } else {
        Alert.alert('ℹ️ Información', 'No hay datos pendientes por sincronizar');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Error al sincronizar datos');
    } finally {
      setIsLoading(false);
    }
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

  const getMoistureStatus = (moisture) => {
    if (!moisture) return { text: 'Sin datos', color: '#666', icon: '❓' };
    if (moisture < 30) return { text: 'Necesita riego', color: '#f44336', icon: '⚠️' };
    if (moisture < 60) return { text: 'Óptimo', color: '#4caf50', icon: '✅' };
    return { text: 'Suelo húmedo', color: '#2196f3', icon: '💧' };
  };

  const status = getMoistureStatus(lastData?.moisture);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {/* 🔹 Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>👨‍🌾 Panel del Agricultor</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>🚪 Salir</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          {user ? `Bienvenido, ${user.name}` : 'Bienvenido agricultor'}
        </Text>
        
        {/* Estado de conexión y sincronización */}
        <View style={styles.statusContainer}>
          <View style={[styles.connectionBadge, { backgroundColor: isConnected ? '#4caf50' : '#ff9800' }]}>
            <Text style={styles.connectionText}>
              {isConnected ? 'En línea ✅' : 'Sin conexión ❌'}
              {isSyncing && ' 🔄'}
            </Text>
          </View>
          
          {unsyncedCount > 0 && (
            <View style={styles.syncBadge}>
              <Text style={styles.syncText}>
                📱 {unsyncedCount} pendientes
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Botón de sincronización */}
      <View style={styles.syncSection}>
        <TouchableOpacity 
          style={[
            styles.syncButton, 
            unsyncedCount > 0 && styles.syncNeededButton,
            (isLoading || isSyncing) && styles.syncButtonDisabled
          ]}
          onPress={handleForceSync}
          disabled={isLoading || isSyncing}
        >
          <Text style={styles.syncButtonIcon}>
            {isSyncing ? '🔄' : unsyncedCount > 0 ? '📱' : '☁️'}
          </Text>
          <View style={styles.syncButtonTextContainer}>
            <Text style={styles.syncButtonText}>
              {isSyncing ? 'Sincronizando...' : 
               isLoading ? 'Cargando...' :
               unsyncedCount > 0 ? `Sincronizar (${unsyncedCount})` : 'Sincronizar datos'}
            </Text>
            <Text style={styles.syncButtonSubtext}>
              {unsyncedCount > 0 ? `${unsyncedCount} acciones pendientes` : 'Todos los datos actualizados'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tarjeta de Estado del Suelo */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>🌱 Estado del Suelo</Text>
        
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Humedad del Suelo</Text>
            <Text style={[styles.statusValue, { color: status.color }]}>
              {lastData ? `${lastData.moisture}%` : '--%'}
            </Text>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.icon} {status.text}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Temperatura</Text>
            <Text style={styles.statusValue}>
              {lastData ? `${lastData.temperature}°C` : '--°C'}
            </Text>
            <Text style={styles.statusText}>🌡️ Ambiente</Text>
          </View>
        </View>

        <Text style={styles.lastUpdate}>
          {lastData 
            ? `Última lectura: ${new Date(lastData.date).toLocaleDateString('es-MX')}`
            : 'No hay datos recientes'}
        </Text>
      </View>

      {/* Menú principal */}
      <View style={styles.menuSection}>
        <Text style={styles.menuTitle}>Acciones Rápidas</Text>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => router.push('/farmer/sensor-connection')}
        >
          <Text style={styles.menuIcon}>📡</Text>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Conectar Sensor</Text>
            <Text style={styles.menuSubtext}>Arduino Bluetooth</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => router.push('/farmer/action-register')}
        >
          <Text style={styles.menuIcon}>📝</Text>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Registrar Acción</Text>
            <Text style={styles.menuSubtext}>Nueva actividad agrícola</Text>
          </View>
          {unsyncedCount > 0 && <View style={styles.pendingDot} />}
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => router.push('/farmer/history')}
        >
          <Text style={styles.menuIcon}>📊</Text>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Historial Completo</Text>
            <Text style={styles.menuSubtext}>Ver todas las acciones</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 🔽 ESPACIO EN BLANCO PARA SCROLL ADICIONAL */}
      <View style={styles.bottomSpace} />
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#2e7d32',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginTop: 5,
    opacity: 0.9,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  connectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  connectionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  syncBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  syncText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  syncSection: {
    padding: 16,
  },
  syncButton: {
    backgroundColor: '#2196f3',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  syncNeededButton: {
    backgroundColor: '#ff9800',
  },
  syncButtonDisabled: {
    backgroundColor: '#b0bec5',
  },
  syncButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  syncButtonTextContainer: {
    flex: 1,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  syncButtonSubtext: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  menuSection: {
    padding: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
    position: 'relative',
  },
  menuIcon: {
    fontSize: 28,
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
  pendingDot: {
    position: 'absolute',
    top: 12,
    right: 35,
    width: 8,
    height: 8,
    backgroundColor: '#ff9800',
    borderRadius: 4,
  },
  // 🔽 NUEVO: Espacio en blanco para scroll adicional
  bottomSpace: {
    height: 80, // Espacio adicional para scroll
  },
  logoutText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  logoutButton: { 
    backgroundColor: '#c62828', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8 
  },
});