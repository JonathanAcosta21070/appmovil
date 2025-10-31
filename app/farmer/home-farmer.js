// app/farmer/home-farmer.js - VERSIÓN CON ÚLTIMA RECOMENDACIÓN NO CLICABLE
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

export default function HomeFarmer() {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [lastRecommendation, setLastRecommendation] = useState(null);
  const { clearUser } = useSync();
  
  // 🔹 Usar el contexto global
  const { 
    isConnected, 
    isSyncing, 
    unsyncedCount, 
    user, 
    API_BASE_URL
  } = useSync();

  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 Pantalla home-farmer enfocada');
      loadRecommendations();
    }, [])
  );

  useEffect(() => {
    console.log('🔍 Estado del usuario:', user ? `Conectado como ${user.email}` : 'No hay usuario');
    
    if (user) {
      loadRecommendations();
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
          loadRecommendations();
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

  // 🔹 Función para cargar recomendaciones
  const loadRecommendations = async () => {
    try {
      if (!user || !user.id) {
        console.log('⚠️ Esperando usuario para cargar recomendaciones...');
        return;
      }

      console.log('📋 Cargando recomendaciones para usuario:', user.email);

      // Intentar cargar desde el servidor
      if (isConnected) {
        const response = await fetch(`${API_BASE_URL}/farmer/alerts`, {
          headers: {
            'Authorization': user.id
          }
        });
        
        if (response.ok) {
          const serverAlerts = await response.json();
          console.log('✅ Recomendaciones cargadas del servidor:', serverAlerts.length);
          setRecommendations(serverAlerts);
          
          // Guardar localmente para uso offline
          await AsyncStorage.setItem('farmerAlerts', JSON.stringify(serverAlerts));
          
          // Establecer la última recomendación
          if (serverAlerts.length > 0) {
            setLastRecommendation(serverAlerts[0]);
          } else {
            setLastRecommendation(null);
          }
          return;
        }
      }

      // Fallback: cargar desde almacenamiento local
      const localAlerts = await AsyncStorage.getItem('farmerAlerts');
      if (localAlerts) {
        const parsedAlerts = JSON.parse(localAlerts);
        console.log('📱 Recomendaciones cargadas localmente:', parsedAlerts.length);
        setRecommendations(parsedAlerts);
        
        if (parsedAlerts.length > 0) {
          setLastRecommendation(parsedAlerts[0]);
        } else {
          setLastRecommendation(null);
        }
      } else {
        // Datos de ejemplo para demo
        const sampleAlerts = [
          {
            id: 1,
            title: 'Recomendación de Riego',
            message: 'Basado en los datos de humedad del suelo, considera aumentar la frecuencia de riego en un 20% para la próxima semana.',
            type: 'warning',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
            read: false,
            from: 'Técnico Agrícola'
          },
          {
            id: 2,
            title: 'Programa de Fertilización',
            message: 'Momento óptimo para fertilización orgánica. Recomiendo usar té de compost para mejor absorción de nutrientes.',
            type: 'info',
            date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 día atrás
            read: true,
            from: 'Dr. Rodríguez'
          }
        ];
        setRecommendations(sampleAlerts);
        setLastRecommendation(sampleAlerts[0]);
        await AsyncStorage.setItem('farmerAlerts', JSON.stringify(sampleAlerts));
      }

    } catch (error) {
      console.log('❌ Error cargando recomendaciones:', error);
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
              {isConnected ? 'En línea' : 'Sin conexión'}
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

      {/* Información de estado */}
      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📊 Estado del Sistema</Text>
          <View style={styles.infoContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Conexión:</Text>
              <Text style={[styles.infoValue, { color: isConnected ? '#4caf50' : '#ff9800' }]}>
                {isConnected ? 'En línea' : 'Sin conexión'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recomendaciones:</Text>
              <Text style={styles.infoValue}>
                {recommendations.length} recibidas
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Acciones pendientes:</Text>
              <Text style={[styles.infoValue, { color: unsyncedCount > 0 ? '#ff9800' : '#4caf50' }]}>
                {unsyncedCount} por sincronizar
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🔄 SECCIÓN DE RECOMENDACIONES */}
      <View style={styles.recommendationsSection}>
        <Text style={styles.sectionTitle}>💡 Recomendaciones del Científico</Text>
        
        {/* Última recomendación - NO ES UN BOTÓN */}
        <View style={styles.lastRecommendationCard}>
          <View style={styles.recommendationHeader}>
            <Text style={styles.recommendationIcon}>📢</Text>
            <View style={styles.recommendationTextContainer}>
              <Text style={styles.recommendationTitle}>
                {lastRecommendation ? 'Última Recomendación' : 'Sin Recomendaciones'}
              </Text>
              <Text style={styles.recommendationSubtitle}>
                {lastRecommendation 
                  ? `De: ${lastRecommendation.from}` 
                  : 'No hay recomendaciones recientes'}
              </Text>
            </View>
            {lastRecommendation && !lastRecommendation.read && (
              <View style={styles.unreadBadge} />
            )}
          </View>
          
          {lastRecommendation ? (
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationMessage}>
                {lastRecommendation.message}
              </Text>
              <Text style={styles.recommendationDate}>
                📅 {new Date(lastRecommendation.date).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.noRecommendations}>
              <Text style={styles.noRecommendationsText}>
                No hay recomendaciones disponibles en este momento
              </Text>
            </View>
          )}
        </View>

        {/* Botón para ver todas las recomendaciones */}
        <TouchableOpacity 
          style={styles.allRecommendationsButton}
          onPress={() => router.push('/farmer/alerts')}
        >
          <Text style={styles.allRecommendationsIcon}>📋</Text>
          <View style={styles.allRecommendationsTextContainer}>
            <Text style={styles.allRecommendationsTitle}>Ver Todas las Recomendaciones</Text>
            <Text style={styles.allRecommendationsSubtitle}>
              {recommendations.length} recomendaciones en total
            </Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
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

      {/* Información adicional */}
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>💡 Información sobre la app</Text>
        <Text style={styles.helpText}>
          • Los datos se sincronizan automaticamente al tener wifi{'\n'}
          • Las acciones offline se guardan localmente{'\n'}
          • Los datos locales se deben sincronizar de manera manual{'\n'}
          • Los datos web aparecen automáticamente al tener wifi{'\n'}
          • El punto naranja indica sin conexión
        </Text>
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
  infoSection: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoContent: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 🔄 ESTILOS PARA RECOMENDACIONES
  recommendationsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  // ÚLTIMA RECOMENDACIÓN - NO CLICABLE
  lastRecommendationCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  recommendationTextContainer: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  recommendationSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    backgroundColor: '#f44336',
    borderRadius: 4,
  },
  recommendationContent: {
    marginTop: 8,
  },
  recommendationMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'left',
  },
  recommendationDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    fontStyle: 'italic',
  },
  noRecommendations: {
    padding: 16,
    alignItems: 'center',
  },
  noRecommendationsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // BOTÓN PARA VER TODAS LAS RECOMENDACIONES
  allRecommendationsButton: {
    backgroundColor: 'white',
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
  allRecommendationsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  allRecommendationsTextContainer: {
    flex: 1,
  },
  allRecommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  allRecommendationsSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
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
  pendingDot: {
    position: 'absolute',
    top: 12,
    right: 35,
    width: 8,
    height: 8,
    backgroundColor: '#ff9800',
    borderRadius: 4,
  },
  helpSection: {
    padding: 16,
    marginTop: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  bottomSpace: {
    height: 80,
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