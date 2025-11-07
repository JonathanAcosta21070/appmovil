// app/scientist/crop-details.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, RefreshControl 
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { scientistService } from '../../../services/scientistService';

// Constantes para evitar magic numbers
const STATUS_COLORS = {
  activo: '#4caf50',
  cosechado: '#ff9800',
  abandonado: '#f44336',
  inactivo: '#f44336',
  problema: '#ff5722',
  pendiente: '#ffc107',
  default: '#666'
};

export default function CropDetails() {
  const { id } = useLocalSearchParams();
  const [crop, setCrop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, isConnected, unsyncedCount } = useSync();

  // Memoizar funciones
  const getStatusColor = useCallback((status) => {
    return STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.default;
  }, []);

  // Cargar detalles del cultivo
  const loadCropDetails = useCallback(async () => {
    if (!id || id === 'undefined') {
      Alert.alert('Error', 'ID del cultivo no válido');
      setIsLoading(false);
      return;
    }

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
  }, [id, user.id]);

  useEffect(() => {
    loadCropDetails();
  }, [loadCropDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCropDetails();
  }, [loadCropDetails]);

  // Memoizar componentes que se renderizan frecuentemente

  const HeaderSection = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.title}>🌱 Detalles del Cultivo</Text>
      <Text style={styles.subtitle}>
        Información completa y seguimiento
      </Text>
    </View>
  ), []);

  // Componente de carga
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
      {HeaderSection}

      {/* Tarjeta principal */}
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

      {/* Información detallada */}
      <CropDetailsSection crop={crop} getStatusColor={getStatusColor} />
      
      {/* Historial */}
      <HistorySection history={crop.history} />
      
      {/* Sincronización */}
      <SyncSection synced={crop.synced} />
      
      {/* Ayuda */}
      <HelpSection />

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Componentes separados para mejor rendimiento
const CropDetailsSection = React.memo(({ crop, getStatusColor }) => (
  <View style={styles.detailsSection}>
    <Text style={styles.sectionTitle}>📋 Información del Cultivo</Text>
    
    <View style={styles.detailsGrid}>
      {crop.seed && (
        <DetailCard icon="🌱" label="Semilla" value={crop.seed} />
      )}

      {crop.bioFertilizer && (
        <DetailCard icon="🧪" label="Biofertilizante" value={crop.bioFertilizer} />
      )}

      {crop.humidity && (
        <DetailCard icon="💧" label="Humedad" value={`${crop.humidity}%`} />
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
      <TextCard title="📝 Observaciones del Agricultor" content={crop.observations} />
    )}

    {crop.recommendations && (
      <TextCard title="💡 Notas del Agricultor" content={crop.recommendations} />
    )}
  </View>
));

const DetailCard = React.memo(({ icon, label, value }) => (
  <View style={styles.detailCard}>
    <Text style={styles.detailCardIcon}>{icon}</Text>
    <View style={styles.detailCardContent}>
      <Text style={styles.detailCardLabel}>{label}</Text>
      <Text style={styles.detailCardValue}>{value}</Text>
    </View>
  </View>
));

const TextCard = React.memo(({ title, content }) => (
  <View style={styles.textCard}>
    <Text style={styles.textCardTitle}>{title}</Text>
    <Text style={styles.textCardContent}>{content}</Text>
  </View>
));

const HistorySection = React.memo(({ history }) => {
  if (!history || history.length === 0) return null;

  return (
    <View style={styles.historySection}>
      <Text style={styles.sectionTitle}>📈 Historial de Acciones</Text>
      
      {history.slice(0, 10).map((action, index) => (
        <ActionCard key={action._id || `action-${index}`} action={action} />
      ))}
    </View>
  );
});

const ActionCard = React.memo(({ action }) => (
  <View style={styles.actionCard}>
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
));

const SyncSection = React.memo(({ synced }) => {
  if (synced !== false) return null;

  return (
    <View style={styles.syncSection}>
      <View style={styles.syncCard}>
        <Text style={styles.syncIcon}>⚠️</Text>
        <View style={styles.syncContent}>
          <Text style={styles.syncTitle}>Pendiente de sincronización</Text>
          <Text style={styles.syncText}>Este cultivo tiene datos pendientes de sincronizar con el servidor</Text>
        </View>
      </View>
    </View>
  );
});

const HelpSection = React.memo(() => (
  <View style={styles.helpSection}>
    <View style={styles.helpCard}>
      <Text style={styles.helpTitle}>💡 Información del Cultivo</Text>
      <View style={styles.helpList}>
        <HelpItem text="El historial muestra las últimas 10 acciones registradas" />
        <HelpItem text="Los datos se actualizan automáticamente al sincronizar" />
        <HelpItem text="Puedes generar recomendaciones desde el panel del científico" />
      </View>
    </View>
  </View>
));

const HelpItem = React.memo(({ text }) => (
  <View style={styles.helpItem}>
    <Text style={styles.helpIcon}>•</Text>
    <Text style={styles.helpText}>{text}</Text>
  </View>
));

// Estilos (mantenidos iguales pero más organizados)
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
  // ... (todos los demás estilos se mantienen igual)
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
  bottomSpacing: {
    height: 40,
  },
});