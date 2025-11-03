import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { scientistService } from '../../../services/scientistService';

export default function CropDetails() {
  const { id } = useLocalSearchParams();
  const [crop, setCrop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, isConnected, unsyncedCount } = useSync();

  useEffect(() => {
    if (id && id !== 'undefined') {
      loadCropDetails();
    } else {
      Alert.alert('Error', 'ID del cultivo no válido');
      setIsLoading(false);
    }
  }, [id]);

  const loadCropDetails = async () => {
    try {
      setIsLoading(true);
      const cropData = await scientistService.getCropDetails(user.id, id);
      setCrop(cropData);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los detalles del cultivo');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCropDetails();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'activo': return '#4caf50';
      case 'cosechado': return '#ff9800';
      case 'abandonado': return '#f44336';
      case 'inactivo': return '#f44336';
      case 'problema': return '#ff5722';
      case 'pendiente': return '#ffc107';
      default: return '#666';
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#7b1fa2" />
        <Text style={styles.loadingText}>Cargando información del cultivo...</Text>
      </View>
    );
  }

  if (!crop) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Cultivo no encontrado</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>↩️ Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
    >
      {/* 🔹 Header - Mismo estilo que Farmer Details */}
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Detalles del Cultivo</Text>
        <Text style={styles.subtitle}>
          Información completa y seguimiento
        </Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Farmer Details */}
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

      {/* 🔹 Tarjeta principal de información - Mismo estilo que Farmer Details */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>🌿</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>{crop.crop}</Text>
              <Text style={styles.cardSubtitle}>
                📍 {crop.location}
              </Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(crop.status) }]}>
            <Text style={styles.statusText}>
              {crop.status?.toUpperCase() || 'ACTIVO'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Agricultor:</Text>
            <Text style={styles.detailValue}>
              {crop.farmerName || 'No disponible'}
            </Text>
          </View>

          {crop.sowingDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fecha Siembra:</Text>
              <Text style={styles.detailValue}>
                {new Date(crop.sowingDate).toLocaleDateString('es-MX')}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Acciones:</Text>
            <Text style={styles.detailValue}>
              {crop.history?.length || 0} registradas
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 Información detallada del cultivo */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>📋 Información del Cultivo</Text>
        
        <View style={styles.detailsGrid}>
          {crop.seed && (
            <View style={styles.detailCard}>
              <Text style={styles.detailCardIcon}>🌱</Text>
              <View style={styles.detailCardContent}>
                <Text style={styles.detailCardLabel}>Semilla</Text>
                <Text style={styles.detailCardValue}>{crop.seed}</Text>
              </View>
            </View>
          )}

          {crop.bioFertilizer && (
            <View style={styles.detailCard}>
              <Text style={styles.detailCardIcon}>🧪</Text>
              <View style={styles.detailCardContent}>
                <Text style={styles.detailCardLabel}>Biofertilizante</Text>
                <Text style={styles.detailCardValue}>{crop.bioFertilizer}</Text>
              </View>
            </View>
          )}

          {crop.humidity && (
            <View style={styles.detailCard}>
              <Text style={styles.detailCardIcon}>💧</Text>
              <View style={styles.detailCardContent}>
                <Text style={styles.detailCardLabel}>Humedad</Text>
                <Text style={styles.detailCardValue}>{crop.humidity}%</Text>
              </View>
            </View>
          )}

          <View style={styles.detailCard}>
            <Text style={styles.detailCardIcon}>📊</Text>
            <View style={styles.detailCardContent}>
              <Text style={styles.detailCardLabel}>Estado</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDotSmall, { backgroundColor: getStatusColor(crop.status) }]} />
                <Text style={styles.detailCardValue}>{crop.status}</Text>
              </View>
            </View>
          </View>
        </View>

        {crop.observations && (
          <View style={styles.textCard}>
            <Text style={styles.textCardTitle}>📝 Observaciones del Agricultor</Text>
            <Text style={styles.textCardContent}>{crop.observations}</Text>
          </View>
        )}

        {crop.recommendations && (
          <View style={styles.textCard}>
            <Text style={styles.textCardTitle}>💡 Notas del Agricultor</Text>
            <Text style={styles.textCardContent}>{crop.recommendations}</Text>
          </View>
        )}
      </View>

      {/* 🔹 Historial de acciones */}
      {crop.history && crop.history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>📈 Historial de Acciones</Text>
          
          {crop.history.slice(0, 10).map((action, index) => (
            <View key={action._id || `action-${index}`} style={styles.actionCard}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionDate}>
                  {action.date ? new Date(action.date).toLocaleDateString('es-MX') : 'Fecha no disponible'}
                </Text>
                <View style={[styles.actionTypeBadge, { backgroundColor: '#2196f3' }]}>
                  <Text style={styles.actionTypeText}>ACCIÓN</Text>
                </View>
              </View>
              
              <Text style={styles.actionText}>{action.action}</Text>
              
              {action.observations && (
                <Text style={styles.actionNotes}>📝 {action.observations}</Text>
              )}
              
              <View style={styles.actionMeta}>
                {action.seed && <Text style={styles.actionMetaText}>🌱 {action.seed}</Text>}
                {action.bioFertilizer && <Text style={styles.actionMetaText}>🧪 {action.bioFertilizer}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 🔹 Estado de sincronización */}
      {crop.synced === false && (
        <View style={styles.syncSection}>
          <View style={styles.syncCard}>
            <Text style={styles.syncIcon}>⚠️</Text>
            <View style={styles.syncContent}>
              <Text style={styles.syncTitle}>Pendiente de sincronización</Text>
              <Text style={styles.syncText}>Este cultivo tiene datos pendientes de sincronizar con el servidor</Text>
            </View>
          </View>
        </View>
      )}

      {/* 🔹 Información adicional */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información del Cultivo</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>El historial muestra las últimas 10 acciones registradas</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los datos se actualizan automáticamente al sincronizar</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Puedes generar recomendaciones desde el panel del científico</Text>
            </View>
          </View>
        </View>
      </View>

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
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  // 🔹 HEADER - Mismo estilo que Farmer Details
  header: {
    backgroundColor: '#7b1fa2',
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
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Farmer Details
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
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Farmer Details
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
  detailsSection: {
    marginBottom: 16,
  },
  historySection: {
    marginBottom: 16,
  },
  syncSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 DETALLES EN GRID
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  detailCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  detailCardIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  detailCardContent: {
    flex: 1,
  },
  detailCardLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailCardValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // 🔹 TARJETAS DE TEXTO
  textCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  textCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  textCardContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // 🔹 TARJETAS DE ACCIÓN/HISTORIAL
  actionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionDate: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  actionTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionTypeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  actionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  actionNotes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 18,
  },
  actionMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  actionMetaText: {
    fontSize: 11,
    color: '#888',
  },
  // 🔹 SINCRONIZACIÓN
  syncCard: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  syncIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  syncContent: {
    flex: 1,
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  syncText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
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
  // 🔹 ESTADOS DE ERROR
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#f44336',
  },
  button: {
    backgroundColor: '#7b1fa2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginHorizontal: 50,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});