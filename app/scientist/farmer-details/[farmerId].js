import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { scientistService } from '../../../services/scientistService';

export default function FarmerDetails() {
  const { farmerId } = useLocalSearchParams();
  const [farmer, setFarmer] = useState(null);
  const [crops, setCrops] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 🔹 Usar el contexto global - Mismo estilo que Home Scientist
  const { 
    isConnected, 
    isSyncing, 
    unsyncedCount, 
    user 
  } = useSync();

  useEffect(() => {
    loadFarmerDetails();
  }, [farmerId]);

  const loadFarmerDetails = async () => {
    try {
      setIsLoading(true);
      
      console.log('🔄 Cargando detalles del agricultor:', farmerId);
      
      const [farmerData, cropsData, sensorData] = await Promise.all([
        scientistService.getFarmerDetails(user.id, farmerId),
        scientistService.getFarmerCrops(user.id, farmerId),
        scientistService.getFarmerSensorData(user.id, farmerId)
      ]);

      setFarmer(farmerData);
      setCrops(cropsData || []);
      setSensorData(sensorData || []);

      console.log('✅ Detalles cargados:', {
        farmer: farmerData?.name,
        crops: cropsData?.length || 0,
        sensorData: sensorData?.length || 0
      });

    } catch (error) {
      console.log('❌ Error cargando detalles del agricultor:', error);
      Alert.alert('Error', 'No se pudieron cargar los detalles del agricultor');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFarmerDetails();
  };

  const getLatestSensorData = (cropName, location) => {
    return sensorData.find(data => 
      data.crop === cropName && data.location === location
    );
  };

  const getCropStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'activo': return '#4caf50';
      case 'cosechado': return '#ff9800';
      case 'abandonado': return '#f44336';
      default: return '#666';
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#7b1fa2" />
        <Text style={styles.loadingText}>Cargando información del agricultor...</Text>
      </View>
    );
  }

  if (!farmer) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Agricultor no encontrado</Text>
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
      {/* 🔹 Header - Mismo estilo que Home Scientist */}
      <View style={styles.header}>
        <Text style={styles.title}>👨‍🌾 Detalles del Agricultor</Text>
        <Text style={styles.subtitle}>
          Información completa y cultivos
        </Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Home Scientist */}
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

      {/* 🔹 Tarjeta principal de información - Mismo estilo que Home Scientist */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>👨‍🌾</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>{farmer.name}</Text>
              <Text style={styles.cardSubtitle}>
                Agricultor asignado
              </Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: '#c744ffff' }]}>
            <Text style={styles.statusText}>
              Activo
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>
              {farmer.email || 'No disponible'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Cultivos:</Text>
            <Text style={styles.detailValue}>
              {crops.length}
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 Cultivos del Agricultor - Mismo estilo de tarjetas */}
      <View style={styles.cropsSection}>
        <Text style={styles.sectionTitle}>🌱 Cultivos del Agricultor</Text>
        
        {crops.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyText}>No hay cultivos activos</Text>
            <Text style={styles.emptySubtext}>
              Este agricultor no tiene cultivos registrados
            </Text>
          </View>
        ) : (
          crops.map((crop) => {
            const latestData = getLatestSensorData(crop.crop, crop.location);
            return (
              <TouchableOpacity 
                key={crop._id}
                style={styles.cropCard}
                onPress={() => router.push(`/scientist/crop-details/${crop._id}`)}
              >
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
                  <View style={[styles.statusBadge, { backgroundColor: getCropStatusColor(crop.status) }]}>
                    <Text style={styles.statusText}>
                      {crop.status?.toUpperCase() || 'ACTIVO'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cropDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Iniciado:</Text>
                    <Text style={styles.detailValue}>
                      {crop.sowingDate ? new Date(crop.sowingDate).toLocaleDateString('es-MX') : 'No especificado'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Acciones:</Text>
                    <Text style={styles.detailValue}>
                      {crop.history?.length || 0} registradas
                    </Text>
                  </View>

                  {latestData && (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Humedad:</Text>
                        <Text style={[styles.detailValue, { color: '#2196f3' }]}>
                          {latestData.moisture}%
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Temperatura:</Text>
                        <Text style={[styles.detailValue, { color: '#ff9800' }]}>
                          {latestData.temperature}°C
                        </Text>
                      </View>
                    </>
                  )}

                  {crop.bioFertilizer && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Biofertilizante:</Text>
                      <Text style={styles.detailValue}>
                        {crop.bioFertilizer}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* 🔹 Información adicional - Mismo estilo que Home Scientist */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información del Agricultor</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Toca un cultivo para ver detalles completos</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los datos de sensores se actualizan automáticamente</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Puedes generar recomendaciones desde el panel principal</Text>
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
  // 🔹 HEADER - Mismo estilo que Home Scientist
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
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Home Scientist
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
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Home Scientist
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
  cropsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 TARJETAS DE CULTIVOS
  cropCard: {
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
    borderLeftColor: '#4caf50',
  },
  cropDetails: {
    marginTop: 12,
  },
  // 🔹 ESTADOS DE CARGA Y VACÍO
  emptyCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
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
    fontStyle: 'italic',
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