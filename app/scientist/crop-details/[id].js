// app/scientist/crop-details.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, RefreshControl 
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [sensorData, setSensorData] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState("server"); // server o cache
  const [connectionError, setConnectionError] = useState(false);
  
  const { user, isConnected, getLocalCrops } = useSync();

  // Memoizar funciones
  const getStatusColor = useCallback((status) => {
    return STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.default;
  }, []);

  // ✅ NUEVA FUNCIÓN: Cargar desde cache local
  const loadFromLocalCache = useCallback(async (cropId) => {
    try {
      console.log('🔍 Buscando cultivo en cache:', cropId);
      
      // Intentar múltiples fuentes de cache
      const cacheSources = [];
      
      // 1. Cache del SyncContext
      try {
        console.log('📁 Buscando en SyncContext cache...');
        const localCrops = await getLocalCrops();
        const localCrop = localCrops.find(c => c._id === cropId || c.id === cropId);
        if (localCrop) {
          console.log('✅ Cultivo encontrado en SyncContext cache');
          cacheSources.push(localCrop);
        }
      } catch (error) {
        console.log('❌ Error accediendo a SyncContext cache:', error.message);
      }
      
      // 2. Cache del scientistService
      try {
        console.log('📁 Buscando en scientistService cache...');
        const cachedData = await scientistService.getAllOfflineData(user.id);
        const serviceCrops = Object.values(cachedData.crops || {}).flat();
        const serviceCrop = serviceCrops.find(c => c._id === cropId || c.id === cropId);
        if (serviceCrop) {
          console.log('✅ Cultivo encontrado en scientistService cache');
          cacheSources.push(serviceCrop);
        }
      } catch (error) {
        console.log('❌ Error accediendo a scientistService cache:', error.message);
      }
      
      // 3. Cache específico de cultivos
      try {
        console.log('📁 Buscando en cache específico...');
        const cachedCrop = await AsyncStorage.getItem(`crop_${cropId}`);
        if (cachedCrop) {
          const parsedCrop = JSON.parse(cachedCrop);
          console.log('✅ Cultivo encontrado en cache específico');
          cacheSources.push(parsedCrop);
        }
      } catch (error) {
        console.log('❌ Error accediendo a cache específico:', error.message);
      }
      
      // Devolver el primer cultivo válido encontrado
      if (cacheSources.length > 0) {
        console.log(`✅ Encontrados ${cacheSources.length} fuentes de cache, usando la primera`);
        return cacheSources[0];
      }
      
      return null;
      
    } catch (error) {
      console.log('❌ Error en loadFromLocalCache:', error);
      return null;
    }
  }, [user.id, getLocalCrops]);

  // ✅ NUEVA FUNCIÓN: Guardar en cache local
  const saveToLocalCache = useCallback(async (cropData) => {
    try {
      if (!cropData || !cropData._id) return;
      
      // Guardar en cache específico
      await AsyncStorage.setItem(`crop_${cropData._id}`, JSON.stringify({
        ...cropData,
        cachedAt: new Date().toISOString()
      }));
      
      console.log('💾 Cultivo guardado en cache local');
    } catch (error) {
      console.log('❌ Error guardando en cache:', error);
    }
  }, []);

  // ✅ NUEVA FUNCIÓN: Crear datos básicos cuando no hay información
  const createBasicCropData = useCallback((cropId) => {
    return {
      _id: cropId,
      crop: 'Cultivo no disponible',
      location: 'Ubicación no disponible',
      status: 'activo',
      farmerName: 'Agricultor no disponible',
      history: [],
      isFallback: true // Marcar como datos de fallback
    };
  }, []);

  // ✅ FUNCIÓN MEJORADA: Cargar detalles del cultivo con soporte offline
  const loadCropDetails = useCallback(async (forceRefresh = false) => {
    if (!id || id === 'undefined') {
      Alert.alert('Error', 'ID del cultivo no válido');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setConnectionError(false);
      
      let cropData = null;
      let sensorInfo = [];
      let cropRecommendations = [];

      console.log('🔍 Iniciando carga de detalles del cultivo...', {
        id,
        isConnected,
        forceRefresh
      });

      // ✅ ESTRATEGIA MEJORADA: Primero intentar cache si no se fuerza refresh
      if (!forceRefresh) {
        console.log('📱 Intentando cargar desde cache primero...');
        cropData = await loadFromLocalCache(id);
        if (cropData) {
          console.log('✅ Datos cargados desde cache');
          setDataSource("cache");
        }
      }

      // ✅ Intentar servidor (si hay conexión y no tenemos datos de cache o forzamos refresh)
      if (isConnected && (!cropData || forceRefresh)) {
        try {
          console.log('🔄 Intentando cargar desde servidor...');
          const serverCropData = await scientistService.getCropDetails(user.id, id);
          console.log('✅ Datos del servidor recibidos:', serverCropData ? 'Sí' : 'No');
          
          if (serverCropData) {
            cropData = serverCropData;
            setDataSource("server");
            // Guardar en cache local para uso futuro
            await saveToLocalCache(cropData);
          }
        } catch (error) {
          console.log("⚠️ Error al cargar desde servidor:", error.message);
          setConnectionError(true);
          // Si no teníamos datos de cache, intentar cargar cache ahora
          if (!cropData) {
            console.log('🔄 Fallback a cache después de error de servidor...');
            cropData = await loadFromLocalCache(id);
            if (cropData) {
              setDataSource("cache");
            }
          }
        }
      }

      // ✅ Si todavía no tenemos datos, crear datos básicos
      if (!cropData) {
        console.log('❌ No hay datos disponibles, creando datos básicos');
        cropData = createBasicCropData(id);
        setDataSource("cache");
      }

      // ✅ Cargar datos de sensor solo si hay conexión real y no hay error
      if (isConnected && !connectionError) {
        try {
          console.log('📡 Cargando datos de sensor...');
          sensorInfo = await scientistService.getCropSensorData(user.id, id);
          console.log('✅ Datos de sensor recibidos:', sensorInfo.length);
        } catch (error) {
          console.log("⚠️ Error cargando datos de sensor:", error.message);
        }
      }

      // ✅ Cargar recomendaciones solo si hay conexión real y no hay error
      if (isConnected && !connectionError) {
        try {
          console.log('💡 Cargando recomendaciones...');
          cropRecommendations = await scientistService.getCropRecommendations(user.id, id);
          console.log('✅ Recomendaciones recibidas:', cropRecommendations.length);
        } catch (error) {
          console.log("⚠️ Error cargando recomendaciones:", error.message);
        }
      }

      setCrop(cropData);
      setSensorData(sensorInfo);
      setRecommendations(cropRecommendations);

      console.log('✅ Carga completada:', {
        crop: !!cropData,
        cropName: cropData?.crop,
        sensorData: sensorInfo.length,
        recommendations: cropRecommendations.length,
        dataSource,
        connectionError
      });

    } catch (error) {
      console.log("❌ Error general en loadCropDetails:", error);
      
      // Último fallback: intentar cargar solo desde cache o crear datos básicos
      try {
        const fallbackData = await loadFromLocalCache(id) || createBasicCropData(id);
        setCrop(fallbackData);
        setDataSource("cache");
        setConnectionError(true);
      } catch (fallbackError) {
        console.log("❌ Error en fallback:", fallbackError);
        Alert.alert("Error", "No se pudieron cargar los detalles del cultivo");
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [id, user.id, isConnected, connectionError, loadFromLocalCache, saveToLocalCache, createBasicCropData]);

  useEffect(() => {
    loadCropDetails();
  }, [loadCropDetails]);

  const onRefresh = useCallback(() => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'No puedes actualizar los datos sin conexión a internet');
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setConnectionError(false);
    loadCropDetails(true);
  }, [loadCropDetails, isConnected]);

  // Memoizar componentes que se renderizan frecuentemente
  const HeaderSection = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.title}>🌱 Detalles del Cultivo</Text>
      <Text style={styles.subtitle}>
        {connectionError ? "Error de conexión - Modo offline" :
         isConnected ? "Datos sincronizados" : "Modo offline"}
      </Text>
    </View>
  ), [isConnected, connectionError]);

  // Componente de carga
  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#7b1fa2" />
        <Text style={styles.loadingText}>Cargando información del cultivo...</Text>
        {connectionError && (
          <Text style={styles.loadingSubtext}>
            Recuperando datos desde cache...
          </Text>
        )}
      </View>
    );
  }

  if (!crop) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Cultivo no encontrado</Text>
        <Text style={styles.errorSubtext}>
          No se pudo cargar la información del cultivo
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>↩️ Volver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={loadCropDetails}>
          <Text style={styles.secondaryButtonText}>🔄 Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          enabled={isConnected && !connectionError}
          colors={['#7b1fa2']}
          tintColor="#7b1fa2"
        />
      }
      showsVerticalScrollIndicator={true}
    >
      {HeaderSection}

      {/* ✅ Mostrar advertencia si son datos de fallback */}
      {crop.isFallback && (
        <View style={styles.fallbackWarning}>
          <Text style={styles.fallbackWarningText}>
            ⚠️ Mostrando información básica. Algunos datos pueden no estar disponibles.
          </Text>
        </View>
      )}

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

          {/* ✅ Mostrar datos de sensor si están disponibles */}
          {sensorData.length > 0 && (
            <SensorDataDisplay sensorData={sensorData} />
          )}
        </View>
      </View>

      {/* Información detallada */}
      <CropDetailsSection crop={crop} getStatusColor={getStatusColor} />
      
      {/* ✅ Sección de recomendaciones */}
      {recommendations.length > 0 && (
        <RecommendationsSection recommendations={recommendations} />
      )}
      
      {/* Historial */}
      <HistorySection history={crop.history} />
      
      {/* Sincronización */}
      <SyncSection synced={crop.synced} isConnected={isConnected} />
      
      {/* Botón de reintento si hay error de conexión */}
      {connectionError && isConnected && (
        <View style={styles.retrySection}>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadCropDetails(true)}>
            <Text style={styles.retryButtonText}>🔄 Reintentar conexión con servidor</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Ayuda */}
      <HelpSection 
        isConnected={isConnected} 
        dataSource={dataSource} 
        connectionError={connectionError}
      />

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// ✅ NUEVO COMPONENTE: Mostrar datos de sensor
const SensorDataDisplay = React.memo(({ sensorData }) => {
  const latestData = sensorData[0]; // El más reciente
  
  return (
    <View style={styles.sensorSection}>
      <Text style={styles.sensorTitle}>📊 Datos de Sensor Recientes</Text>
      <View style={styles.sensorGrid}>
        {latestData.moisture !== undefined && (
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Humedad:</Text>
            <Text style={[styles.sensorValue, { color: '#2196f3' }]}>
              {latestData.moisture}%
            </Text>
          </View>
        )}
        {latestData.temperature !== undefined && (
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Temperatura:</Text>
            <Text style={[styles.sensorValue, { color: '#ff9800' }]}>
              {latestData.temperature}°C
            </Text>
          </View>
        )}
        {latestData.ph !== undefined && (
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>pH:</Text>
            <Text style={[styles.sensorValue, { color: '#4caf50' }]}>
              {latestData.ph}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.sensorTimestamp}>
        Actualizado: {latestData.timestamp ? 
          new Date(latestData.timestamp).toLocaleString('es-MX') : 
          'Recientemente'}
      </Text>
    </View>
  );
});

// ✅ NUEVO COMPONENTE: Sección de recomendaciones
const RecommendationsSection = React.memo(({ recommendations }) => (
  <View style={styles.recommendationsSection}>
    <Text style={styles.sectionTitle}>💡 Recomendaciones</Text>
    
    {recommendations.slice(0, 5).map((rec, index) => (
      <View key={rec._id || `rec-${index}`} style={styles.recommendationCard}>
        <View style={styles.recommendationHeader}>
          <Text style={styles.recommendationTitle}>
            {rec.priority === 'high' ? '🔴 ' : rec.priority === 'medium' ? '🟡 ' : '🟢 '}
            Recomendación
          </Text>
          <Text style={styles.recommendationDate}>
            {rec.date ? new Date(rec.date).toLocaleDateString('es-MX') : 'Reciente'}
          </Text>
        </View>
        <Text style={styles.recommendationText}>{rec.recommendation}</Text>
        {rec.scientistName && (
          <Text style={styles.recommendationScientist}>
            Por: {rec.scientistName}
          </Text>
        )}
      </View>
    ))}
  </View>
));

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
  if (!history || history.length === 0) {
    return (
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>📈 Historial de Acciones</Text>
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryText}>No hay acciones registradas</Text>
        </View>
      </View>
    );
  }

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
        <Text style={styles.actionTypeText}>
          {action.type === 'sowing' ? 'SIEMBRA' : 
           action.type === 'watering' ? 'RIEGO' :
           action.type === 'fertilization' ? 'FERTILIZACIÓN' :
           action.type === 'harvest' ? 'COSECHA' : 'ACCIÓN'}
        </Text>
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

const SyncSection = React.memo(({ synced, isConnected }) => {
  if (synced !== false) return null;

  return (
    <View style={styles.syncSection}>
      <View style={styles.syncCard}>
        <Text style={styles.syncIcon}>⚠️</Text>
        <View style={styles.syncContent}>
          <Text style={styles.syncTitle}>Pendiente de sincronización</Text>
          <Text style={styles.syncText}>
            {isConnected 
              ? 'Este cultivo tiene datos pendientes de sincronizar con el servidor' 
              : 'Los datos se sincronizarán cuando recuperes la conexión'}
          </Text>
        </View>
      </View>
    </View>
  );
});

const HelpSection = React.memo(({ isConnected, dataSource, connectionError }) => (
  <View style={styles.helpSection}>
    <View style={styles.helpCard}>
      <Text style={styles.helpTitle}>💡 Información del Cultivo</Text>
      <View style={styles.helpList}>
        <HelpItem text="📊 El historial muestra las últimas 10 acciones registradas" />
        <HelpItem text="💡 Se muestran los detalles del cultivo" />

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

// Estilos actualizados (eliminados los estilos del banner de datos)
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
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
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
  fallbackWarning: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  fallbackWarningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
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
  // Nuevos estilos para datos de sensor
  sensorSection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  sensorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sensorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  sensorItem: {
    minWidth: '30%',
    marginBottom: 8,
  },
  sensorLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sensorTimestamp: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Estilos para recomendaciones
  recommendationsSection: {
    marginBottom: 16,
  },
  recommendationCard: {
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
    borderLeftColor: '#4caf50',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  recommendationDate: {
    fontSize: 12,
    color: '#666',
  },
  recommendationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  recommendationScientist: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
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
  emptyHistory: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
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
  errorSubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7b1fa2',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#7b1fa2',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  retrySection: {
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#7b1fa2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomSpacing: {
    height: 40,
  },
});