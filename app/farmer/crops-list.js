// app/farmer/crops-list.js - VERSIÓN CORREGIDA (BOTÓN BORRAR NO SE SOBREPONE)
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import API_CONFIG from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CropsList() {
  const [crops, setCrops] = useState([]);
  const [filteredCrops, setFilteredCrops] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(null);
  
  const { getUserCrops, user, isConnected, deleteLocalCrop, saveCropLocal } = useSync();

  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 Pantalla de cultivos enfocada - cargando...');
      loadCrops();
    }, [])
  );

  useEffect(() => {
    loadCrops();
  }, []);

  useEffect(() => {
    filterCrops();
  }, [crops, searchQuery]);

  const loadCrops = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando cultivos para usuario:', user?.email);
      
      let allCrops = [];
      
      if (user && user.id) {
        try {
          if (!isConnected) {
            console.log('📡 Sin conexión - cargando solo datos locales');
            const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
            const localCrops = JSON.parse(localCropsString);
            allCrops = localCrops.filter(crop => crop.userId === user.id);
            console.log('🌱 Cultivos locales cargados:', allCrops.length);
          } else {
            allCrops = await getUserCrops();
            console.log('🌱 Cultivos cargados (conexión):', allCrops.length);
          }
        } catch (error) {
          console.log('❌ Error cargando cultivos:', error);
          Alert.alert('Error', 'No se pudieron cargar los cultivos');
        }
      }

      const sortedCrops = allCrops.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.sowingDate);
        const dateB = new Date(b.createdAt || b.sowingDate);
        return dateB - dateA;
      });

      setCrops(sortedCrops);
      console.log('✅ Cultivos cargados en estado:', sortedCrops.length);

    } catch (error) {
      console.log('❌ Error cargando cultivos:', error);
      Alert.alert('Error', 'No se pudieron cargar los cultivos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterCrops = () => {
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
  };

  const handleChangeStatus = (crop) => {
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
  };

  const confirmStatusChange = async (newStatus) => {
    if (!selectedCrop) return;
    
    try {
      const cropId = selectedCrop._id || selectedCrop.id;
      const cropName = selectedCrop.crop || 'Cultivo sin nombre';
      
      console.log(`🔄 Cambiando estado de ${cropName} a: ${newStatus}`);
      
      if (selectedCrop._source === 'local' || cropId.startsWith('local-')) {
        await updateLocalCropStatus(cropId, newStatus);
        Alert.alert('✅ Éxito', `Estado cambiado a: ${newStatus}`);
      } else if (isConnected && user?.id) {
        await updateServerCropStatus(cropId, newStatus);
        Alert.alert('✅ Éxito', `Estado cambiado a: ${newStatus}`);
      } else {
        await saveStatusChangeLocal(selectedCrop, newStatus);
        Alert.alert('✅ Éxito', `Estado cambiado localmente a: ${newStatus}`);
      }
      
      await loadCrops();
      
    } catch (error) {
      console.log('❌ Error cambiando estado:', error);
      Alert.alert('❌ Error', 'No se pudo cambiar el estado del cultivo');
    } finally {
      setStatusModalVisible(false);
      setSelectedCrop(null);
    }
  };

  const updateLocalCropStatus = async (cropId, newStatus) => {
    try {
      const localCrops = await AsyncStorage.getItem('localCrops') || '[]';
      const cropsArray = JSON.parse(localCrops);
      
      const updatedCrops = cropsArray.map(crop => {
        if (crop.id === cropId) {
          const statusChangeAction = {
            _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            type: 'status_change',
            action: `Estado cambiado a: ${newStatus}`,
            observations: `Cambio de estado: ${crop.status} → ${newStatus}`,
            synced: false
          };
          
          return {
            ...crop,
            status: newStatus,
            history: [statusChangeAction, ...(crop.history || [])]
          };
        }
        return crop;
      });
      
      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      
      setCrops(prevCrops => 
        prevCrops.map(crop => 
          crop.id === cropId 
            ? { ...crop, status: newStatus }
            : crop
        )
      );
      
      console.log('✅ Estado actualizado localmente:', cropId);
    } catch (error) {
      console.log('❌ Error actualizando estado local:', error);
      throw error;
    }
  };

  const updateServerCropStatus = async (cropId, newStatus) => {
    try {
      const API_BASE_URL = API_CONFIG.API_BASE_URL;
      
      console.log(`🌐 Enviando PUT a: ${API_BASE_URL}/farmer/crops/${cropId}`);
      
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
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (response.ok) {
        const updatedCrop = await response.json();
        console.log('✅ Estado actualizado en servidor:', updatedCrop);
        
        setCrops(prevCrops => 
          prevCrops.map(crop => 
            crop._id === cropId 
              ? { ...crop, status: newStatus }
              : crop
          )
        );
      } else {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log('❌ Error actualizando en servidor:', error);
      throw error;
    }
  };

  const saveStatusChangeLocal = async (crop, newStatus) => {
    try {
      const statusChangeAction = {
        _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
        type: 'status_change',
        action: `Estado cambiado a: ${newStatus}`,
        observations: `Cambio de estado: ${crop.status} → ${newStatus}`,
        synced: false
      };

      const cropWithStatusChange = {
        ...crop,
        status: newStatus,
        history: [statusChangeAction, ...(crop.history || [])],
        _source: 'local',
        synced: false
      };

      await saveCropLocal(cropWithStatusChange);
      
      setCrops(prevCrops => 
        prevCrops.map(c => 
          (c._id === crop._id || c.id === crop.id)
            ? { ...c, status: newStatus }
            : c
        )
      );
      
      console.log('✅ Cambio de estado guardado localmente');
    } catch (error) {
      console.log('❌ Error guardando cambio de estado local:', error);
      throw error;
    }
  };

  const handleClearLocalData = () => {
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
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Borrar Todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllLocalData();
              Alert.alert('✅ Éxito', 'Datos locales borrados correctamente');
              await loadCrops();
            } catch (error) {
              console.log('❌ Error borrando datos locales:', error);
              Alert.alert('❌ Error', 'No se pudieron borrar los datos locales');
            }
          }
        }
      ]
    );
  };

  const clearAllLocalData = async () => {
    try {
      console.log('🧹 BORRANDO TODOS LOS CULTIVOS LOCALES...');
      
      const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
      const localCrops = JSON.parse(localCropsString);
      
      console.log('📁 Total cultivos locales:', localCrops.length);
      
      const userLocalCrops = localCrops.filter(crop => crop.userId === user?.id);
      
      console.log('🗑️ Cultivos locales del usuario a eliminar:', userLocalCrops.length);
      
      if (userLocalCrops.length === 0) {
        Alert.alert('ℹ️ Información', 'No tienes cultivos locales guardados');
        return;
      }
      
      const cropsToKeep = localCrops.filter(crop => crop.userId !== user?.id);
      
      await AsyncStorage.setItem('localCrops', JSON.stringify(cropsToKeep));
      console.log('💾 Storage actualizado. Cultivos restantes:', cropsToKeep.length);
      
      setCrops([]);
      
      console.log('🔄 Estado local limpiado. Lista vacía.');
      
      Alert.alert(
        '✅ Éxito', 
        `Se eliminaron ${userLocalCrops.length} cultivos locales.\n\nLa lista se ha limpiado completamente.`,
        [{ text: 'Aceptar', style: 'default' }]
      );
      
    } catch (error) {
      console.log('❌ Error en clearAllLocalData:', error);
      Alert.alert('❌ Error', 'No se pudieron borrar los datos locales: ' + error.message);
      throw error;
    }
  };

  const handleDeleteCrop = async (crop) => {
    if (!isConnected) {
      return;
    }

    const cropId = crop._id || crop.id;
    const cropName = crop.crop || 'Cultivo sin nombre';
    
    Alert.alert(
      'Eliminar Cultivo',
      `¿Estás seguro de que quieres eliminar "${cropName}"? Esta acción no se puede deshacer.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`🗑️ Intentando eliminar cultivo: ${cropId}`);
              
              if (crop._source === 'local' || cropId.startsWith('local-')) {
                const success = await deleteLocalCrop(cropId);
                if (success) {
                  setCrops(prevCrops => prevCrops.filter(c => c.id !== cropId));
                  Alert.alert('✅ Éxito', 'Cultivo eliminado correctamente');
                } else {
                  Alert.alert('❌ Error', 'No se pudo eliminar el cultivo local');
                }
                return;
              }
              
              if (isConnected && user?.id) {
                try {
                  const API_BASE_URL = API_CONFIG.API_BASE_URL;
                  
                  const response = await fetch(`${API_BASE_URL}/farmer/crops/${cropId}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': user.id.toString(),
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (response.ok) {
                    setCrops(prevCrops => prevCrops.filter(c => c._id !== cropId));
                    Alert.alert('✅ Éxito', 'Cultivo eliminado correctamente del servidor');
                  } else {
                    const errorText = await response.text();
                    throw new Error(`Error del servidor: ${response.status}`);
                  }
                } catch (serverError) {
                  console.log('❌ Error eliminando del servidor:', serverError.message);
                  Alert.alert(
                    '❌ Error del Servidor', 
                    serverError.message,
                    [
                      { text: 'OK', style: 'cancel' },
                      { 
                        text: 'Eliminar Localmente', 
                        onPress: async () => {
                          await saveCropAsDeleted(crop);
                          setCrops(prevCrops => prevCrops.filter(c => c._id !== cropId));
                          Alert.alert('✅ Éxito', 'Cultivo marcado para eliminación local');
                        }
                      }
                    ]
                  );
                }
              }
            } catch (error) {
              console.log('❌ Error general eliminando cultivo:', error);
              Alert.alert('❌ Error', 'No se pudo eliminar el cultivo: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const saveCropAsDeleted = async (crop) => {
    try {
      const deleteAction = {
        _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
        type: 'delete',
        action: 'Cultivo marcado para eliminación',
        observations: 'Cultivo eliminado localmente - pendiente de sincronizar con servidor',
        synced: false
      };

      const cropMarkedForDeletion = {
        ...crop,
        status: 'Eliminado',
        history: [deleteAction, ...(crop.history || [])],
        _source: 'local',
        synced: false,
        markedForDeletion: true
      };

      await saveCropLocal(cropMarkedForDeletion);
      console.log('✅ Cultivo marcado para eliminación local');
    } catch (error) {
      console.log('❌ Error marcando cultivo para eliminación:', error);
      throw error;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCrops();
  };

  const getCropStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'activo': return '#4caf50';
      case 'en reposo': return '#ff9800';
      case 'cosechado': return '#2196f3';
      case 'abandonado': return '#f44336';
      default: return '#666';
    }
  };

  const getCropStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'activo': return '🌱 Activo';
      case 'en reposo': return '⏸️ En reposo';
      case 'cosechado': return '📦 Cosechado';
      case 'abandonado': return '❌ Abandonado';
      default: return '📝 ' + (status || 'Activo');
    }
  };

  const getActionCount = (crop) => {
    return crop.history?.length || 0;
  };

  const getLastActionDate = (crop) => {
    if (!crop.history || crop.history.length === 0) {
      return crop.createdAt || crop.sowingDate;
    }
    
    const lastAction = crop.history.reduce((latest, action) => {
      const actionDate = new Date(action.date);
      const latestDate = new Date(latest.date);
      return actionDate > latestDate ? action : latest;
    });
    
    return lastAction.date;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX');
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 🔹 Header - Mismo estilo que Home Farmer */}
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Mis Cultivos</Text>
        <Text style={styles.subtitle}>Gestiona y revisa todos tus cultivos</Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Home Farmer */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>

        {/* 🆕 BOTÓN PARA BORRAR DATOS LOCALES - SOLO SIN WIFI */}
        {!isConnected && (
          <TouchableOpacity 
            style={styles.clearLocalButton}
            onPress={handleClearLocalData}
          >
            <Text style={styles.clearLocalButtonText}>🧹 Borrar Datos Locales</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 🔹 Tarjeta de estadísticas - Mismo estilo que Home Farmer */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>📊</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Estadísticas de Cultivos</Text>
              <Text style={styles.cardSubtitle}>
                Resumen de todos tus cultivos
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
            <Text style={styles.detailLabel}>Total de cultivos:</Text>
            <Text style={styles.detailValue}>{crops.length}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cultivos activos:</Text>
            <Text style={styles.detailValue}>
              {crops.filter(c => c.status?.toLowerCase() === 'activo').length}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>En reposo:</Text>
            <Text style={styles.detailValue}>
              {crops.filter(c => c.status?.toLowerCase() === 'en reposo').length}
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 Sección de búsqueda */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>🔍 Buscar Cultivos</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cultivo, ubicación, estado..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* 🔹 Lista de cultivos - Mismo estilo de tarjetas */}
      <View style={styles.cropsSection}>
        <Text style={styles.sectionTitle}>📋 Lista de Cultivos</Text>
        
        {filteredCrops.length > 0 ? (
          filteredCrops.map((crop, index) => (
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
                      <Text style={styles.cardSubtitle}>
                        📍 {crop.location || 'Ubicación no especificada'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* 🔄 CORRECCIÓN: Contenedor para badge y botón de eliminar */}
                  <View style={styles.headerRightContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getCropStatusColor(crop.status) }]}>
                      <Text style={styles.statusText}>
                        {getCropStatusText(crop.status)}
                      </Text>
                    </View>
                    
                    {/* 🗑️ BOTÓN ELIMINAR - SOLO SE MUESTRA CON WIFI */}
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
                    <Text style={styles.detailValue}>
                      {formatDate(crop.sowingDate || crop.createdAt)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Última acción:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(getLastActionDate(crop))}
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
                      <Text style={styles.detailLabel}>Fertilizante:</Text>
                      <Text style={styles.detailValue}>{crop.bioFertilizer}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Acciones registradas:</Text>
                    <Text style={styles.detailValue}>
                      📊 {getActionCount(crop)} acciones
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  {/* BOTÓN CAMBIAR ESTADO - SOLO CON WIFI */}
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
          ))
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

      {/* MODAL PARA CAMBIAR ESTADO - SOLO SE MUESTRA CON WIFI */}
      {isConnected && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={statusModalVisible}
          onRequestClose={() => setStatusModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Cambiar estado del cultivo
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedCrop?.crop} - {selectedCrop?.location}
              </Text>
              <Text style={styles.currentStatus}>
                Estado actual: {getCropStatusText(selectedCrop?.status)}
              </Text>
              
              <View style={styles.statusOptions}>
                <TouchableOpacity
                  style={[styles.statusOption, { backgroundColor: '#4caf50' }]}
                  onPress={() => confirmStatusChange('Activo')}
                >
                  <Text style={styles.statusOptionText}>🌱 Activo</Text>
                  <Text style={styles.statusOptionDescription}>Cultivo en crecimiento activo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.statusOption, { backgroundColor: '#ff9800' }]}
                  onPress={() => confirmStatusChange('En reposo')}
                >
                  <Text style={styles.statusOptionText}>⏸️ En reposo</Text>
                  <Text style={styles.statusOptionDescription}>Cultivo pausado temporalmente</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.statusOption, { backgroundColor: '#2196f3' }]}
                  onPress={() => confirmStatusChange('Cosechado')}
                >
                  <Text style={styles.statusOptionText}>📦 Cosechado</Text>
                  <Text style={styles.statusOptionDescription}>Cultivo finalizado con éxito</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.statusOption, { backgroundColor: '#f44336' }]}
                  onPress={() => confirmStatusChange('Abandonado')}
                >
                  <Text style={styles.statusOptionText}>❌ Abandonado</Text>
                  <Text style={styles.statusOptionDescription}>Cultivo abandonado</Text>
                </TouchableOpacity>
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
      )}

      {/* 🔹 Espacio al final para mejor scroll */}
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
  // 🔹 HEADER - Mismo estilo que Home Farmer
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
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Home Farmer
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
  clearLocalButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearLocalButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Home Farmer
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
  // 🔄 CORRECCIÓN: Contenedor para elementos del lado derecho
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  searchSection: {
    marginBottom: 16,
  },
  cropsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 BÚSQUEDA
  searchInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  // 🔹 TARJETAS DE CULTIVOS
  cropCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cropCardContent: {
    padding: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  changeStatusButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  localBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  localText: {
    fontSize: 10,
    color: '#856404',
    fontWeight: '500',
  },
  observationsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#6c757d',
    marginTop: 12,
  },
  observationsLabel: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
    marginBottom: 4,
  },
  observationsText: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
  },
  // 🔄 CORRECCIÓN: Botón de eliminar dentro del contenedor
  deleteButton: {
    backgroundColor: '#f44336',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 🔹 ESTADO VACÍO
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  registerButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  registerButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // 🔹 MODAL
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  currentStatus: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  statusOptions: {
    marginBottom: 20,
  },
  statusOption: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  statusOptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusOptionDescription: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});