// app/farmer/crops-list.js - OPTIMIZADO
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import API_CONFIG from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constantes para estados de cultivo
const CROP_STATUS = {
  activo: { color: '#4caf50', text: '🌱 Activo' },
  'en reposo': { color: '#ff9800', text: '⏸️ En reposo' },
  cosechado: { color: '#2196f3', text: '📦 Cosechado' },
  abandonado: { color: '#f44336', text: '❌ Abandonado' },
  default: { color: '#666', text: '📝 Activo' }
};

const STATUS_OPTIONS = [
  { value: 'Activo', label: '🌱 Activo', description: 'Cultivo en crecimiento activo', color: '#4caf50' },
  { value: 'En reposo', label: '⏸️ En reposo', description: 'Cultivo pausado temporalmente', color: '#ff9800' },
  { value: 'Cosechado', label: '📦 Cosechado', description: 'Cultivo finalizado con éxito', color: '#2196f3' },
  { value: 'Abandonado', label: '❌ Abandonado', description: 'Cultivo abandonado', color: '#f44336' }
];

export default function CropsList() {
  const [crops, setCrops] = useState([]);
  const [filteredCrops, setFilteredCrops] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(null);
  
  const { getUserCrops, user, isConnected, deleteLocalCrop, saveCropLocal } = useSync();

  // Memoizar valores computados
  const activeCropsCount = useMemo(() => 
    crops.filter(c => c.status?.toLowerCase() === 'activo').length, [crops]);
  
  const restingCropsCount = useMemo(() => 
    crops.filter(c => c.status?.toLowerCase() === 'en reposo').length, [crops]);

  // Funciones memoizadas
  const getCropStatusConfig = useCallback((status) => 
    CROP_STATUS[status?.toLowerCase()] || CROP_STATUS.default, []);

  const getActionCount = useCallback((crop) => crop.history?.length || 0, []);

  const getLastActionDate = useCallback((crop) => {
    if (!crop.history || crop.history.length === 0) {
      return crop.createdAt || crop.sowingDate;
    }
    
    const lastAction = crop.history.reduce((latest, action) => {
      const actionDate = new Date(action.date);
      const latestDate = new Date(latest.date);
      return actionDate > latestDate ? action : latest;
    });
    
    return lastAction.date;
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX');
    } catch {
      return 'Fecha inválida';
    }
  }, []);

  // Cargar cultivos
  const loadCrops = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!user?.id) return;

      let allCrops = [];
      
      if (!isConnected) {
        const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
        const localCrops = JSON.parse(localCropsString);
        allCrops = localCrops.filter(crop => crop.userId === user.id);
      } else {
        allCrops = await getUserCrops();
      }

      const sortedCrops = allCrops.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.sowingDate);
        const dateB = new Date(b.createdAt || b.sowingDate);
        return dateB - dateA;
      });

      setCrops(sortedCrops);
    } catch (error) {
      console.error('Error cargando cultivos:', error);
      Alert.alert('Error', 'No se pudieron cargar los cultivos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isConnected, getUserCrops]);

  // Filtrar cultivos
  const filterCrops = useCallback(() => {
    let filtered = crops;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(crop => 
        crop.crop?.toLowerCase().includes(query) ||
        crop.location?.toLowerCase().includes(query) ||
        crop.status?.toLowerCase().includes(query) ||
        crop.bioFertilizer?.toLowerCase().includes(query) ||
        crop.observations?.toLowerCase().includes(query)
      );
    }
    
    setFilteredCrops(filtered);
  }, [crops, searchQuery]);

  useFocusEffect(
    React.useCallback(() => {
      loadCrops();
    }, [loadCrops])
  );

  useEffect(() => {
    loadCrops();
  }, [loadCrops]);

  useEffect(() => {
    filterCrops();
  }, [filterCrops]);

  // Manejar cambio de estado
  const handleChangeStatus = useCallback((crop) => {
    if (!isConnected) {
      Alert.alert(
        'Sin Conexión',
        'Necesitas conexión a internet para cambiar el estado de los cultivos.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }
    
    setSelectedCrop(crop);
    setStatusModalVisible(true);
  }, [isConnected]);

  const confirmStatusChange = useCallback(async (newStatus) => {
    if (!selectedCrop) return;
    
    try {
      const cropId = selectedCrop._id || selectedCrop.id;
      const cropName = selectedCrop.crop || 'Cultivo sin nombre';
      
      if (selectedCrop._source === 'local' || cropId.startsWith('local-')) {
        await updateLocalCropStatus(cropId, newStatus);
      } else if (isConnected && user?.id) {
        await updateServerCropStatus(cropId, newStatus);
      } else {
        await saveStatusChangeLocal(selectedCrop, newStatus);
      }
      
      Alert.alert('✅ Éxito', `Estado cambiado a: ${newStatus}`);
      await loadCrops();
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
      Alert.alert('❌ Error', 'No se pudo cambiar el estado del cultivo');
    } finally {
      setStatusModalVisible(false);
      setSelectedCrop(null);
    }
  }, [selectedCrop, isConnected, user?.id, loadCrops]);

  // Funciones auxiliares para cambio de estado
  const updateLocalCropStatus = async (cropId, newStatus) => {
    const localCrops = await AsyncStorage.getItem('localCrops') || '[]';
    const cropsArray = JSON.parse(localCrops);
    
    const updatedCrops = cropsArray.map(crop => {
      if (crop.id === cropId) {
        const statusChangeAction = createStatusChangeAction(crop.status, newStatus);
        return {
          ...crop,
          status: newStatus,
          history: [statusChangeAction, ...(crop.history || [])]
        };
      }
      return crop;
    });
    
    await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
    updateLocalState(cropId, newStatus);
  };

  const updateServerCropStatus = async (cropId, newStatus) => {
    const API_BASE_URL = API_CONFIG.API_BASE_URL;
    const response = await fetch(`${API_BASE_URL}/farmer/crops/${cropId}`, {
      method: 'PUT',
      headers: {
        'Authorization': user.id.toString(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: newStatus,
        observations: `Estado cambiado a: ${newStatus}`
      })
    });
    
    if (response.ok) {
      updateLocalState(cropId, newStatus);
    } else {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }
  };

  const saveStatusChangeLocal = async (crop, newStatus) => {
    const statusChangeAction = createStatusChangeAction(crop.status, newStatus);
    const cropWithStatusChange = {
      ...crop,
      status: newStatus,
      history: [statusChangeAction, ...(crop.history || [])],
      _source: 'local',
      synced: false
    };

    await saveCropLocal(cropWithStatusChange);
    updateLocalState(crop._id || crop.id, newStatus);
  };

  const createStatusChangeAction = (oldStatus, newStatus) => ({
    _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
    type: 'status_change',
    action: `Estado cambiado a: ${newStatus}`,
    observations: `Cambio de estado: ${oldStatus} → ${newStatus}`,
    synced: false
  });

  const updateLocalState = (cropId, newStatus) => {
    setCrops(prevCrops => 
      prevCrops.map(crop => 
        (crop._id === cropId || crop.id === cropId)
          ? { ...crop, status: newStatus }
          : crop
      )
    );
  };

  // Manejar borrado de datos locales
  const handleClearLocalData = useCallback(() => {
    if (isConnected) {
      Alert.alert(
        'Conectado a Internet',
        'Estás conectado a internet. No es necesario borrar datos locales.\n\nPuedes sincronizar tus datos pendientes en lugar de borrarlos.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      '🗑️ Borrar Datos Locales',
      '¿Estás seguro de que quieres borrar todos los datos locales?\n\n' +
      '• Se eliminarán todos los cultivos guardados localmente\n' +
      '• Solo se eliminarán datos NO sincronizados\n' +
      '• Los datos ya sincronizados se mantendrán\n\n' +
      'Esta acción NO se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar Todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllLocalData();
              Alert.alert('✅ Éxito', 'Datos locales borrados correctamente');
              await loadCrops();
            } catch (error) {
              console.error('Error borrando datos locales:', error);
              Alert.alert('❌ Error', 'No se pudieron borrar los datos locales');
            }
          }
        }
      ]
    );
  }, [isConnected, loadCrops]);

  const clearAllLocalData = async () => {
    const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
    const localCrops = JSON.parse(localCropsString);
    const userLocalCrops = localCrops.filter(crop => crop.userId === user?.id);
    
    if (userLocalCrops.length === 0) {
      Alert.alert('ℹ️ Información', 'No tienes cultivos locales guardados');
      return;
    }
    
    const cropsToKeep = localCrops.filter(crop => crop.userId !== user?.id);
    await AsyncStorage.setItem('localCrops', JSON.stringify(cropsToKeep));
    setCrops([]);
    
    Alert.alert(
      '✅ Éxito', 
      `Se eliminaron ${userLocalCrops.length} cultivos locales.\n\nLa lista se ha limpiado completamente.`,
      [{ text: 'Aceptar', style: 'default' }]
    );
  };

  // Manejar eliminación de cultivo
  const handleDeleteCrop = useCallback(async (crop) => {
    if (!isConnected) return;

    const cropId = crop._id || crop.id;
    const cropName = crop.crop || 'Cultivo sin nombre';
    
    Alert.alert(
      'Eliminar Cultivo',
      `¿Estás seguro de que quieres eliminar "${cropName}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (crop._source === 'local' || cropId.startsWith('local-')) {
                const success = await deleteLocalCrop(cropId);
                if (success) {
                  setCrops(prev => prev.filter(c => c.id !== cropId));
                  Alert.alert('✅ Éxito', 'Cultivo eliminado correctamente');
                }
                return;
              }
              
              if (isConnected && user?.id) {
                await deleteServerCrop(cropId, crop);
              }
            } catch (error) {
              console.error('Error general eliminando cultivo:', error);
              Alert.alert('❌ Error', 'No se pudo eliminar el cultivo: ' + error.message);
            }
          }
        }
      ]
    );
  }, [isConnected, user?.id, deleteLocalCrop]);

  const deleteServerCrop = async (cropId, crop) => {
    const API_BASE_URL = API_CONFIG.API_BASE_URL;
    const response = await fetch(`${API_BASE_URL}/farmer/crops/${cropId}`, {
      method: 'DELETE',
      headers: { 'Authorization': user.id.toString(), 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      setCrops(prev => prev.filter(c => c._id !== cropId));
      Alert.alert('✅ Éxito', 'Cultivo eliminado correctamente del servidor');
    } else {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${response.status}`);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCrops();
  }, [loadCrops]);

  // Renderizado de componentes
  const renderCropCard = useCallback((crop, index) => {
    const statusConfig = getCropStatusConfig(crop.status);
    const actionCount = getActionCount(crop);
    const lastActionDate = getLastActionDate(crop);

    return (
      <View key={crop._id || crop.id || `crop-${index}`} style={styles.cropCard}>
        <TouchableOpacity
          style={styles.cropCardContent}
          onPress={() => router.push(`/farmer/crop-details/${crop._id || crop.id}`)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>🌱</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>{crop.crop || 'Cultivo sin nombre'}</Text>
                <Text style={styles.cardSubtitle}>📍 {crop.location || 'Ubicación no especificada'}</Text>
              </View>
            </View>
            
            <View style={styles.headerRightContainer}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
                <Text style={styles.statusText}>{statusConfig.text}</Text>
              </View>
              
              {isConnected && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteCrop(crop)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fecha inicio:</Text>
              <Text style={styles.detailValue}>{formatDate(crop.sowingDate || crop.createdAt)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Última acción:</Text>
              <Text style={styles.detailValue}>{formatDate(lastActionDate)}</Text>
            </View>

            {crop.humidity && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Humedad:</Text>
                <Text style={styles.detailValue}>{crop.humidity}%</Text>
              </View>
            )}

            {crop.bioFertilizer && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fertilizante:</Text>
                <Text style={styles.detailValue}>{crop.bioFertilizer}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Acciones registradas:</Text>
              <Text style={styles.detailValue}>📊 {actionCount} acciones</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            {isConnected && (
              <TouchableOpacity
                style={styles.changeStatusButton}
                onPress={() => handleChangeStatus(crop)}
              >
                <Text style={styles.changeStatusText}>🔄 Cambiar estado</Text>
              </TouchableOpacity>
            )}
            
            {crop._source === 'local' && (
              <View style={styles.localBadge}>
                <Text style={styles.localText}>💾 Local</Text>
              </View>
            )}
          </View>

          {crop.observations && (
            <View style={styles.observationsContainer}>
              <Text style={styles.observationsLabel}>Observaciones:</Text>
              <Text style={styles.observationsText} numberOfLines={2}>
                {crop.observations}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [getCropStatusConfig, getActionCount, getLastActionDate, formatDate, isConnected, handleDeleteCrop, handleChangeStatus]);

  const renderStatusModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={statusModalVisible}
      onRequestClose={() => setStatusModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Cambiar estado del cultivo</Text>
          <Text style={styles.modalSubtitle}>
            {selectedCrop?.crop} - {selectedCrop?.location}
          </Text>
          <Text style={styles.currentStatus}>
            Estado actual: {getCropStatusConfig(selectedCrop?.status).text}
          </Text>
          
          <View style={styles.statusOptions}>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.statusOption, { backgroundColor: option.color }]}
                onPress={() => confirmStatusChange(option.value)}
              >
                <Text style={styles.statusOptionText}>{option.label}</Text>
                <Text style={styles.statusOptionDescription}>{option.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setStatusModalVisible(false)}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Mis Cultivos</Text>
        <Text style={styles.subtitle}>Gestiona y revisa todos tus cultivos</Text>
      </View>

      {/* Tarjeta de estadísticas */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>📊</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Estadísticas de Cultivos</Text>
              <Text style={styles.cardSubtitle}>Resumen de todos tus cultivos</Text>
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
            <Text style={styles.detailLabel}>Total de cultivos:</Text>
            <Text style={styles.detailValue}>{crops.length}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cultivos activos:</Text>
            <Text style={styles.detailValue}>{activeCropsCount}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>En reposo:</Text>
            <Text style={styles.detailValue}>{restingCropsCount}</Text>
          </View>
        </View>
      </View>

      {/* Búsqueda */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>🔍 Buscar Cultivos</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cultivo, ubicación, estado..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Lista de cultivos */}
      <View style={styles.cropsSection}>
        <Text style={styles.sectionTitle}>📋 Lista de Cultivos</Text>
        
        {filteredCrops.length > 0 ? (
          filteredCrops.map(renderCropCard)
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyText}>
              {loading ? 'Cargando cultivos...' : 'No se encontraron cultivos'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery 
                ? 'Prueba con otros términos de búsqueda' 
                : 'Registra tu primer cultivo para comenzar'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.registerButton}
                onPress={() => router.push('/farmer/action-register')}
              >
                <Text style={styles.registerButtonText}>📝 Registrar primer cultivo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

         {/* Información adicional */}
            <View style={styles.helpSection}>
              <View style={styles.helpCard}>
                <Text style={styles.helpTitle}>💡 Información Importante</Text>
                <View style={styles.helpList}>
                                  {[
                  '🌾 En esta pantalla puedes ver todos tus cultivos registrados junto con su estado actual.',
                  '🔍 Usa la barra de búsqueda para encontrar rápidamente un cultivo por nombre o ubicación.',
                  '👆 Toca un cultivo para ver sus detalles, acciones y observaciones.',
                  '🌱 Si un cultivo ya terminó, cambia su estado a “Cosechado” o “En reposo”.',
                  '🗑️ Usa el botón de eliminar si un cultivo ya no es necesario.',
                  '📱 Si no tienes conexión, podrás seguir viendo los cultivos guardados localmente.',
                ]
                .map((text, index) => (
                    <View key={index} style={styles.helpItem}>
                      <Text style={styles.helpIcon}>•</Text>
                      <Text style={styles.helpText}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>     

      {/* Modal de cambio de estado */}
      {isConnected && renderStatusModal()}

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
  clearLocalButton: { backgroundColor: '#dc3545', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  clearLocalButtonText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  mainCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  cardIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  cardTitleText: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#666' },
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 80, alignItems: 'center' },
  cardDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  searchSection: { marginBottom: 16 },
  cropsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  searchInput: { backgroundColor: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  cropCard: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cropCardContent: { padding: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  changeStatusButton: { backgroundColor: '#ff9800', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changeStatusText: { color: 'white', fontSize: 12, fontWeight: '500' },
  localBadge: { backgroundColor: '#fff3cd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  localText: { fontSize: 10, color: '#856404', fontWeight: '500' },
  observationsContainer: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#6c757d', marginTop: 12 },
  observationsLabel: { fontSize: 12, color: '#495057', fontWeight: '600', marginBottom: 4 },
  observationsText: { fontSize: 12, color: '#6c757d', lineHeight: 16 },
  deleteButton: { backgroundColor: '#f44336', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  deleteButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#666', marginBottom: 8, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 20 },
  registerButton: { backgroundColor: '#2e7d32', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  registerButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 8 },
  currentStatus: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20, fontStyle: 'italic' },
  statusOptions: { marginBottom: 20 },
  statusOption: { padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  statusOptionText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  statusOptionDescription: { color: 'white', fontSize: 12, opacity: 0.9, textAlign: 'center' },
  cancelButton: { backgroundColor: '#6c757d', padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  bottomSpacing: { height: 40 },
  helpSection: { marginBottom: 16 },
  helpCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  helpTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  helpList: { gap: 8 },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start' },
  helpIcon: { marginRight: 8, fontSize: 14, color: '#666' },
  helpText: { fontSize: 14, color: '#666', flex: 1, lineHeight: 20 },
});