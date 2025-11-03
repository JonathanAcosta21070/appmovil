// app/farmer/crop-details/[id].js - PANTALLA DE DETALLES DEL CULTIVO
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';

export default function CropDetails() {
  const { id } = useLocalSearchParams();
  const [crop, setCrop] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { getUserCrops, user } = useSync();

  useEffect(() => {
    if (id && id !== 'undefined') {
      loadCropDetails();
    } else {
      Alert.alert('Error', 'ID del cultivo no válido');
      setLoading(false);
    }
  }, [id]);

  const loadCropDetails = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando detalles del cultivo:', id);
      
      const allCrops = await getUserCrops();
      const foundCrop = allCrops.find(c => 
        c._id === id || c.id === id
      );

      if (foundCrop) {
        setCrop(foundCrop);
        console.log('✅ Cultivo encontrado:', foundCrop.crop);
      } else {
        console.log('❌ Cultivo no encontrado');
        Alert.alert('Error', 'Cultivo no encontrado');
      }

    } catch (error) {
      console.log('❌ Error cargando detalles:', error);
      Alert.alert('Error', 'No se pudieron cargar los detalles del cultivo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCropDetails();
  };

  const getCropStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'activo': return '#4caf50';
      case 'cosechado': return '#ff9800';
      case 'abandonado': return '#f44336';
      default: return '#666';
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'sowing': return '🌱';
      case 'watering': return '💧';
      case 'fertilization': return '🧪';
      case 'harvest': return '📦';
      case 'pruning': return '✂️';
      default: return '📝';
    }
  };

  const getActionDescription = (action) => {
    if (action.action) {
      return action.action;
    }
    
    switch (action.type) {
      case 'sowing':
        return `Siembra de ${action.seed || 'cultivo'}`;
      case 'watering':
        return 'Riego aplicado';
      case 'fertilization':
        return `Aplicación de ${action.bioFertilizer || 'biofertilizante'}`;
      case 'harvest':
        return 'Cosecha realizada';
      case 'pruning':
        return 'Poda realizada';
      default:
        return 'Acción realizada';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX') + ' ' + date.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Cargando información del cultivo...</Text>
      </View>
    );
  }

  if (!crop) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Cultivo no encontrado</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 🔹 Header - Mismo estilo que Home Farmer */}
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Detalles del Cultivo</Text>
        <Text style={styles.subtitle}>
          {crop.crop} - {crop.location}
        </Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Home Farmer */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, styles.statusOnline]} />
          <Text style={styles.statusText}>
            Conectado
          </Text>
        </View>
        
        <Text style={styles.unsyncedText}>
          📊 {crop.history?.length || 0} acciones
        </Text>
      </View>

      {/* 🔹 Tarjeta principal de información - Mismo estilo que Home Farmer */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>🌱</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>{crop.crop}</Text>
              <Text style={styles.cardSubtitle}>
                {crop.location}
              </Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: getCropStatusColor(crop.status) }]}>
            <Text style={styles.statusText}>
              {crop.status?.toUpperCase() || 'ACTIVO'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fecha de Inicio:</Text>
            <Text style={styles.detailValue}>
              {formatDate(crop.sowingDate || crop.createdAt)}
            </Text>
          </View>

          {crop.humidity && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Humedad:</Text>
              <Text style={styles.detailValue}>{crop.humidity}%</Text>
            </View>
          )}

          {crop.bioFertilizer && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Biofertilizante:</Text>
              <Text style={styles.detailValue}>{crop.bioFertilizer}</Text>
            </View>
          )}
        </View>

        {crop.observations && (
          <View style={styles.textData}>
            <Text style={styles.dataLabel}>Observaciones</Text>
            <Text style={styles.dataText}>{crop.observations}</Text>
          </View>
        )}

        {crop.recommendations && (
          <View style={styles.textData}>
            <Text style={styles.dataLabel}>Recomendaciones</Text>
            <Text style={styles.dataText}>{crop.recommendations}</Text>
          </View>
        )}
      </View>

      {/* 🔹 Sección de historial - Mismo estilo que Home Farmer */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>📊 Historial de Acciones</Text>
        
        {/* Tarjeta de resumen */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📝</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Resumen de Actividades</Text>
                <Text style={styles.cardSubtitle}>
                  Total de acciones registradas
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#2196f3' }]}>
              <Text style={styles.statusText}>
                {crop.history?.length || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Lista de acciones */}
        {crop.history && crop.history.length > 0 ? (
          crop.history.map((action, index) => (
            <View key={action._id || action.id || `action-${index}`} style={styles.actionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardIcon}>{getActionIcon(action.type)}</Text>
                  <View style={styles.cardTitleText}>
                    <Text style={styles.cardName}>
                      {action.type === 'sowing' ? 'Siembra' :
                       action.type === 'watering' ? 'Riego' :
                       action.type === 'fertilization' ? 'Fertilización' :
                       action.type === 'harvest' ? 'Cosecha' :
                       action.type === 'pruning' ? 'Poda' : 'Otra Acción'}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {getActionDescription(action)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.actionDate}>
                  {formatDate(action.date)}
                </Text>
              </View>

              <View style={styles.actionDetails}>
                {action.seed && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Semilla:</Text>
                    <Text style={styles.detailValue}>{action.seed}</Text>
                  </View>
                )}

                {action.bioFertilizer && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Biofertilizante:</Text>
                    <Text style={styles.detailValue}>{action.bioFertilizer}</Text>
                  </View>
                )}

                {action.observations && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Observaciones:</Text>
                    <Text style={styles.detailValue}>{action.observations}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyActions}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No hay acciones registradas</Text>
            <Text style={styles.emptySubtext}>
              Registra tu primera acción para este cultivo
            </Text>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/farmer/action-register')}
            >
              <Text style={styles.actionButtonText}>📝 Agregar Acción</Text>
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  // 🔹 HEADER - Mismo estilo que Home Farmer
  header: {
    backgroundColor: '#2e7d32',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 16,
    marginHorizontal: 16,
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
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Home Farmer
  connectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 16,
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
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Home Farmer
  mainCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryCard: {
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
  actionCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    minWidth: 60,
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
  textData: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  dataText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // 🔹 SECCIONES
  historySection: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 DETALLES DE ACCIONES
  actionDetails: {
    marginLeft: 36,
  },
  actionDate: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
  },
  // 🔹 ESTADO VACÍO
  emptyActions: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  // 🔹 BOTONES DE ACCIÓN (solo para el estado vacío)
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
  // 🔹 ESTADOS DE ERROR
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#f44336',
  },
  button: {
    backgroundColor: '#2e7d32',
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