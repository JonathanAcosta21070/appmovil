// app/farmer/home-farmer.js - OPTIMIZADO
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

// Constantes para el menú
const MENU_ITEMS = [
  { 
    icon: '📡', 
    title: 'Conectar Sensor', 
    subtitle: 'Arduino Bluetooth', 
    route: '/farmer/sensor-connection' 
  },
  { 
    icon: '📝', 
    title: 'Registrar Acción', 
    subtitle: 'Nueva actividad agrícola', 
    route: '/farmer/action-register',
    showPending: true 
  },
  { 
    icon: '📊', 
    title: 'Historial de Acciones', 
    subtitle: 'Ver todas las actividades', 
    route: '/farmer/history' 
  },
  { 
    icon: '🌱', 
    title: 'Mis Cultivos', 
    subtitle: 'Gestionar todos mis cultivos', 
    route: '/farmer/crops-list' 
  }
];

const HELP_ITEMS = [
  '📡 Si el sensor no se conecta, revisa que el Bluetooth esté activado y el dispositivo cerca.',
  '📝 Las acciones que realices sin conexión se guardan automáticamente en el almacenamiento local.',
  '☁️ Puedes sincronizar tus datos manualmente cuando recuperes conexión.',
  '🌱 Los cultivos registrados se guardan tanto localmente como en la nube.',
  '📊 Las recomendaciones del científico se actualizan al reconectarte a internet.',
  '🔔 El punto naranja indica que estás sin conexión; el verde, que todo está sincronizado.',
  '⚙️ Si notas lentitud, intenta cerrar sesión y volver a ingresar para refrescar los datos.',
];


export default function HomeFarmer() {
  const [recommendations, setRecommendations] = useState([]);
  const [lastRecommendation, setLastRecommendation] = useState(null);
  
  const { 
    isConnected, 
    isSyncing, 
    unsyncedCount, 
    user, 
    API_BASE_URL,
    clearUser 
  } = useSync();

  // Memoizar valores computados
  const unreadRecommendationsCount = useMemo(() => 
    recommendations.filter(rec => !rec.read).length, [recommendations]);

  // Cargar recomendaciones
  const loadRecommendations = useCallback(async () => {
    try {
      if (!user?.id) return;

      // Intentar cargar desde el servidor
      if (isConnected) {
        const response = await fetch(`${API_BASE_URL}/farmer/alerts`, {
          headers: { 'Authorization': user.id }
        });
        
        if (response.ok) {
          const serverAlerts = await response.json();
          setRecommendations(serverAlerts);
          await AsyncStorage.setItem('farmerAlerts', JSON.stringify(serverAlerts));
          setLastRecommendation(serverAlerts[0] || null);
          return;
        }
      }

      // Fallback a datos locales
      const localAlerts = await AsyncStorage.getItem('farmerAlerts');
      if (localAlerts) {
        const parsedAlerts = JSON.parse(localAlerts);
        setRecommendations(parsedAlerts);
        setLastRecommendation(parsedAlerts[0] || null);
      } else {
        // Datos de ejemplo para demo
        const sampleAlerts = createSampleAlerts();
        setRecommendations(sampleAlerts);
        setLastRecommendation(sampleAlerts[0]);
        await AsyncStorage.setItem('farmerAlerts', JSON.stringify(sampleAlerts));
      }

    } catch (error) {
      console.error('Error cargando recomendaciones:', error);
    }
  }, [user, isConnected, API_BASE_URL]);

  // Cargar usuario desde storage
  const loadUserFromStorage = useCallback(async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        const userData = JSON.parse(userString);
        if (userData.id && userData.email) {
          loadRecommendations();
        } else {
          await AsyncStorage.removeItem('user');
          router.replace('/');
        }
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      router.replace('/');
    }
  }, [loadRecommendations]);

  useEffect(() => {
    if (user) {
      loadRecommendations();
    } else {
      loadUserFromStorage();
    }
  }, [user, loadRecommendations, loadUserFromStorage]);

  useFocusEffect(
    React.useCallback(() => {
      loadRecommendations();
    }, [loadRecommendations])
  );

  // Cerrar sesión
  const handleLogout = useCallback(async () => {
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
              console.error('Error durante el cierre de sesión:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
  }, []);

  // Renderizado de componentes
  const renderRecommendationCard = useCallback(() => (
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
  ), [lastRecommendation]);

  const renderMenuItems = useCallback(() => (
    <View style={styles.menuSection}>
      <Text style={styles.sectionTitle}>🚀 Acciones Rápidas</Text>
      
      {MENU_ITEMS.map((item, index) => (
        <TouchableOpacity 
          key={index}
          style={styles.menuCard}
          onPress={() => router.push(item.route)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
            <View style={styles.menuRightContent}>
              {item.showPending && unsyncedCount > 0 && <View style={styles.pendingDot} />}
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ), [unsyncedCount]);

  const renderHelpSection = useCallback(() => (
    <View style={styles.helpSection}>
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>💡 Información sobre la app</Text>
        <View style={styles.helpList}>
          {HELP_ITEMS.map((text, index) => (
            <View key={index} style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  ), []);

return (
  <ScrollView 
    style={styles.container}
    contentContainerStyle={styles.contentContainer}
    showsVerticalScrollIndicator={true}
  >
    {/* Header */}
    <View style={styles.header}>
      <Text style={styles.title}>👨‍🌾 Panel del Agricultor</Text>
      <Text style={styles.subtitle}>
        {user ? `Bienvenido, ${user.name}` : 'Bienvenido agricultor'}
      </Text>
    </View>

{/* Tarjeta principal */}
<View style={styles.mainCard}>
  <View style={styles.cardHeader}>
    <View style={styles.cardTitleContainer}>
      <Text style={styles.cardIcon}>📊</Text>
      <View style={styles.cardTitleText}>
        <Text style={styles.cardName}>Estado del Sistema</Text>
        <Text style={styles.cardSubtitle}>Información general de la aplicación</Text>
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
      <Text style={styles.detailValue}>{user?.name || 'No identificado'}</Text>
    </View>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Email:</Text>
      <Text style={styles.detailValue}>{user?.email || 'No disponible'}</Text>
    </View>
  </View>

  {/* 🔺 Botón de cerrar sesión movido dentro de la tarjeta */}
  <TouchableOpacity 
    style={styles.logoutButton}
    onPress={handleLogout}
  >
    <Text style={styles.logoutButtonText}>🚪 Cerrar Sesión</Text>
  </TouchableOpacity>
</View>


    {/* Recomendaciones */}
    <View style={styles.recommendationsSection}>
      <Text style={styles.sectionTitle}>💡 Recomendaciones del Científico</Text>
      {renderRecommendationCard()}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => router.push('/farmer/alerts')}
      >
        <Text style={styles.actionButtonText}>
          📋 Ver Todas las Recomendaciones {unreadRecommendationsCount > 0 && `(${unreadRecommendationsCount})`}
        </Text>
      </TouchableOpacity>
    </View>

    {/* Menú principal */}
    {renderMenuItems()}

    {/* Información adicional */}
    {renderHelpSection()}

    <View style={styles.bottomSpacing} />
  </ScrollView>
);

}

// Estilos (se mantienen iguales)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16, paddingBottom: 60 },
  header: { backgroundColor: '#2e7d32', padding: 20, borderRadius: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'white', textAlign: 'center', opacity: 0.9 },
  connectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 16 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusOnline: { backgroundColor: '#4caf50' },
  statusOffline: { backgroundColor: '#f44336' },
  statusText: { fontSize: 14, color: '#333', fontWeight: '500' },
  unsyncedText: { fontSize: 12, color: '#ff9800', fontWeight: '500' },
  mainCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  cardIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  cardTitleText: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#666' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 80, alignItems: 'center' },
  cardDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  recommendationsSection: { marginBottom: 16 },
  menuSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  recommendationCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#2196f3' },
  recommendationContent: { marginTop: 8 },
  recommendationMessage: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 12 },
  recommendationDate: { fontSize: 12, color: '#999', textAlign: 'right', fontStyle: 'italic' },
  noRecommendations: { padding: 16, alignItems: 'center' },
  noRecommendationsText: { fontSize: 14, color: '#666', textAlign: 'center', fontStyle: 'italic' },
  actionButton: { backgroundColor: '#4caf50', padding: 16, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  menuCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  menuRightContent: { flexDirection: 'row', alignItems: 'center' },
  pendingDot: { width: 8, height: 8, backgroundColor: '#ff9800', borderRadius: 4, marginRight: 8 },
  menuArrow: { fontSize: 20, color: '#666', fontWeight: 'bold' },
  helpSection: { marginBottom: 16 },
  helpCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  helpTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  helpList: { gap: 8 },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start' },
  helpIcon: { marginRight: 8, fontSize: 14, color: '#666' },
  helpText: { fontSize: 14, color: '#666', flex: 1, lineHeight: 20 },
  logoutButton: { backgroundColor: '#dc2626', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  logoutButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  bottomSpacing: { height: 40 },
});