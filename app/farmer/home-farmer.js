// app/farmer/home-farmer.js - VERSIÓN CON ESTILO DE SENSOR CONNECTION
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
      {/* 🔹 Header - Mismo estilo que Sensor Connection */}
      <View style={styles.header}>
        <Text style={styles.title}>👨‍🌾 Panel del Agricultor</Text>
        <Text style={styles.subtitle}>
          {user ? `Bienvenido, ${user.name}` : 'Bienvenido agricultor'}
        </Text>
      </View>

      {/* Información de conexión - Mismo estilo que Sensor Connection */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>
        
        {unsyncedCount > 0 && (
          <Text style={styles.unsyncedText}>
            📱 {unsyncedCount} pendientes
          </Text>
        )}
      </View>

      {/* Tarjeta principal de estado - Mismo estilo que Sensor Connection */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>📊</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Estado del Sistema</Text>
              <Text style={styles.cardSubtitle}>
                Información general de la aplicación
              </Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#4caf50' : '#ff9800' }]}>
            <Text style={styles.statusText}>
              {isConnected ? '✅ En línea' : '⚠️ Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Usuario:</Text>
            <Text style={styles.detailValue}>
              {user?.name || 'No identificado'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>
              {user?.email || 'No disponible'}
            </Text>
          </View>
        </View>
      </View>

      {/* SECCIÓN DE RECOMENDACIONES - Mismo estilo de tarjetas */}
      <View style={styles.recommendationsSection}>
        <Text style={styles.sectionTitle}>💡 Recomendaciones del Científico</Text>
        
        {/* Última recomendación - NO ES UN BOTÓN */}
        <View style={styles.recommendationCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📢</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>
                  {lastRecommendation ? 'Última Recomendación' : 'Sin Recomendaciones'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {lastRecommendation 
                    ? `De: ${lastRecommendation.from}` 
                    : 'No hay recomendaciones recientes'}
                </Text>
              </View>
            </View>
            {lastRecommendation && !lastRecommendation.read && (
              <View style={[styles.statusBadge, { backgroundColor: '#f44336' }]}>
                <Text style={styles.statusText}>Nuevo</Text>
              </View>
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
          style={styles.actionButton}
          onPress={() => router.push('/farmer/alerts')}
        >
          <Text style={styles.actionButtonText}>📋 Ver Todas las Recomendaciones</Text>
        </TouchableOpacity>
      </View>

      {/* Menú principal - Mismo estilo de tarjetas */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>🚀 Acciones Rápidas</Text>
        
        <TouchableOpacity 
          style={styles.menuCard}
          onPress={() => router.push('/farmer/sensor-connection')}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📡</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Conectar Sensor</Text>
                <Text style={styles.cardSubtitle}>Arduino Bluetooth</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuCard}
          onPress={() => router.push('/farmer/action-register')}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📝</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Registrar Acción</Text>
                <Text style={styles.cardSubtitle}>Nueva actividad agrícola</Text>
              </View>
            </View>
            <View style={styles.menuRightContent}>
              {unsyncedCount > 0 && <View style={styles.pendingDot} />}
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuCard}
          onPress={() => router.push('/farmer/history')}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📊</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Historial de Acciones</Text>
                <Text style={styles.cardSubtitle}>Ver todas las actividades</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuCard}
          onPress={() => router.push('/farmer/crops-list')}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>🌱</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Mis Cultivos</Text>
                <Text style={styles.cardSubtitle}>Gestionar todos mis cultivos</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Información adicional - Mismo estilo de tarjetas */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información sobre la app</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los datos se sincronizan automáticamente al tener wifi</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Las acciones offline se guardan localmente</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los datos locales se deben sincronizar de manera manual</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los datos web aparecen automáticamente al tener wifi</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>El punto naranja indica sin conexión</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Botón de cerrar sesión */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>🚪 Cerrar Sesión</Text>
      </TouchableOpacity>

      {/* 🔽 ESPACIO EN BLANCO PARA SCROLL ADICIONAL */}
      <View style={styles.bottomSpacing} />
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 60,
  },
  // 🔹 HEADER - Mismo estilo que Sensor Connection
  header: {
    backgroundColor: '#2e7d32',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
  },
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Sensor Connection
  connectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#4caf50',
  },
  statusOffline: {
    backgroundColor: '#f44336',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  unsyncedText: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
  },
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Sensor Connection
  mainCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  cardTitleText: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  cardDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  // 🔹 SECCIONES
  recommendationsSection: {
    marginBottom: 16,
  },
  menuSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 TARJETA DE RECOMENDACIÓN
  recommendationCard: {
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
  recommendationContent: {
    marginTop: 8,
  },
  recommendationMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
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
  // 🔹 BOTONES DE ACCIÓN
  actionButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // 🔹 TARJETAS DE MENÚ
  menuCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingDot: {
    width: 8,
    height: 8,
    backgroundColor: '#ff9800',
    borderRadius: 4,
    marginRight: 8,
  },
  menuArrow: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  // 🔹 SECCIÓN DE AYUDA
  helpSection: {
    marginBottom: 16,
  },
  helpCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  helpList: {
    gap: 8,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpIcon: {
    marginRight: 8,
    fontSize: 14,
    color: '#666',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  // 🔹 BOTÓN DE CERRAR SESIÓN
  logoutButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});