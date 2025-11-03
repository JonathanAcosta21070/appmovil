// app/farmer/history.js - VERSIÓN CON ESTILO DE HOME FARMER
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

export default function History() {
  const [actions, setActions] = useState([]);
  const [filteredActions, setFilteredActions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingActionId, setDeletingActionId] = useState(null);
  const [actualPendingSyncCount, setActualPendingSyncCount] = useState(0);
  
  const { 
    user, 
    getUserCrops,
    API_BASE_URL,
    isConnected,
    syncPendingData,
    getLocalCrops,
    refreshCache,
    loadCachedCrops,
    checkPendingSync
  } = useSync();

  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 Pantalla de historial enfocada - cargando acciones...');
      loadActions();
      checkPendingActions();
    }, [])
  );

  useEffect(() => {
    if (isConnected && actions.length > 0) {
      console.log('🔄 Conexión restaurada - actualizando historial...');
      refreshCache().then(() => {
        loadActions(true);
        checkPendingActions();
      });
    }
  }, [isConnected]);

  useEffect(() => {
    filterActions();
  }, [actions, searchQuery, filterType]);

  const checkPendingActions = async () => {
    try {
      console.log('🔍 Verificando datos pendientes de sincronización...');
      
      if (!user?.id) {
        setActualPendingSyncCount(0);
        return;
      }

      if (checkPendingSync) {
        const pendingCount = await checkPendingSync();
        setActualPendingSyncCount(pendingCount);
        console.log('📊 Datos pendientes (desde contexto):', pendingCount);
        return;
      }

      const localCrops = await getLocalCrops();
      const unsyncedCrops = localCrops.filter(crop => 
        crop.userId === user.id && !crop.synced
      );
      
      setActualPendingSyncCount(unsyncedCrops.length);
      console.log('📊 Datos pendientes (verificación manual):', unsyncedCrops.length);
      
    } catch (error) {
      console.log('❌ Error verificando datos pendientes:', error);
      setActualPendingSyncCount(0);
    }
  };

  const generateUniqueKey = (action, index) => {
    if (action._id) return action._id.toString();
    if (action.id) return action.id.toString();
    const datePart = action.date ? new Date(action.date).getTime() : Date.now();
    const cropPart = action.cropName ? action.cropName.replace(/\s+/g, '') : 'crop';
    const typePart = action.type || 'action';
    return `${datePart}-${typePart}-${cropPart}-${index}`;
  };

  const loadActions = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      console.log('🔄 Cargando datos para usuario:', user?.email);
      console.log('📶 Estado conexión:', isConnected ? 'Conectado' : 'Desconectado');
      
      let allCrops = [];
      
      if (user && user.id) {
        try {          
          if (forceRefresh) {
            allCrops = await getUserCrops(false);
            console.log('🌱 Datos cargados desde servidor:', allCrops.length);
          } else {
            const cachedData = await loadCachedCrops();
            if (cachedData.length > 0) {
              allCrops = cachedData;
              console.log('📁 Datos cargados desde cache:', allCrops.length);
            } else {
              allCrops = await getUserCrops(false);
              console.log('🌱 Datos cargados desde servidor:', allCrops.length);
            }
          }
          
        } catch (error) {
          console.log('❌ Error cargando cultivos:', error);
          allCrops = await loadCropsManually();
        }
      }

      const allActions = extractActionsFromCrops(allCrops);
      console.log('📋 Acciones extraídas:', allActions.length);

      const sortedActions = allActions.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt);
        const dateB = new Date(b.date || b.createdAt);
        return dateB - dateA;
      });

      setActions(sortedActions);
      console.log('✅ Historial cargado:', sortedActions.length, 'acciones');

      await checkPendingActions();

    } catch (error) {
      console.log('❌ Error cargando historial:', error);
      Alert.alert('Error', 'No se pudieron cargar las acciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const extractActionsFromCrops = (crops) => {
    const allActions = [];
    
    crops.forEach(crop => {
      const cropId = crop._id || crop.id;
      const isLocal = crop._source === 'local' || crop.synced === false;
      const cropName = crop.crop || 'Cultivo no especificado';
      const location = crop.location || 'Ubicación no especificada';
      
      if (crop.history && Array.isArray(crop.history)) {
        crop.history.forEach((action, actionIndex) => {
          const actionId = action._id || action.id || `${cropId}-${action.date}-${actionIndex}`;
          
          allActions.push({
            ...action,
            id: actionId,
            _id: action._id || actionId,
            cropId: cropId,
            cropName: cropName,
            location: location,
            _source: isLocal ? 'local' : 'web',
            synced: crop.synced !== false && action.synced !== false,
            isLocal: isLocal,
            cropData: {
              crop: cropName,
              location: location,
              status: crop.status,
              humidity: crop.humidity,
              bioFertilizer: crop.bioFertilizer,
              observations: crop.observations,
              recommendations: crop.recommendations,
              isLocal: isLocal
            }
          });
        });
      } else {
        console.log('⚠️ Cultivo sin historial:', cropId, cropName);
      }
    });
    
    return allActions;
  };

  const handleDeleteAction = async (action) => {
    console.log('🗑️ Intentando eliminar acción:', {
      actionId: action._id,
      cropId: action.cropId,
      type: action.type,
      isLocal: action.isLocal,
      _source: action._source
    });

    if (action._source === 'local' || action.isLocal) {
      Alert.alert(
        '🗑️ Eliminar acción local',
        `¿Estás seguro de que quieres eliminar esta acción local?\n\n${getActionDescription(action)}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Eliminar', 
            style: 'destructive',
            onPress: () => deleteLocalAction(action)
          }
        ]
      );
      return;
    }

    Alert.alert(
      '🗑️ Eliminar Acción',
      `¿Estás seguro de que quieres eliminar esta acción?\n\n${getActionDescription(action)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => deleteCloudAction(action)
        }
      ]
    );
  };

  const deleteCloudAction = async (action) => {
    if (!action.cropId || !action._id) {
      console.log('❌ Faltan IDs para eliminar:', { 
        cropId: action.cropId, 
        actionId: action._id 
      });
      Alert.alert('Error', 'No se puede identificar la acción para eliminar');
      return;
    }

    setDeletingActionId(action._id);

    try {
      const url = `${API_BASE_URL}/farmer/crops/${action.cropId}/history/${action._id}`;
      console.log('🔍 URL de eliminación:', url);
      console.log('🔐 Authorization:', user.id);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': user.id.toString(),
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Eliminación exitosa:', result);
        
        await refreshCache();
        
        setActions(prevActions => 
          prevActions.filter(a => a._id !== action._id)
        );
        
        Alert.alert('✅ Éxito', 'Acción eliminada correctamente del servidor');
      } else {
        const errorText = await response.text();
        console.log('❌ Error del servidor:', response.status, errorText);
        
        if (response.status === 404) {
          Alert.alert(
            '⚠️ Acción no encontrada',
            'La acción ya fue eliminada o no existe en el servidor.',
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Eliminar Localmente', 
                onPress: () => removeActionLocally(action)
              }
            ]
          );
        } else {
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
      }
    } catch (error) {
      console.error('❌ Error eliminando acción:', error);
      Alert.alert(
        '❌ Error', 
        `No se pudo eliminar la acción del servidor: ${error.message}`,
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Eliminar Localmente', 
            onPress: () => removeActionLocally(action)
          }
        ]
      );
    } finally {
      setDeletingActionId(null);
    }
  };

  const deleteLocalAction = async (action) => {
    setDeletingActionId(action._id);

    try {
      console.log('🗑️ Eliminando acción local...');
      
      const localCrops = await getLocalCrops();
      console.log('📁 Cultivos locales encontrados:', localCrops.length);
      
      const cropIndex = localCrops.findIndex(crop => 
        crop.id === action.cropId || crop._id === action.cropId
      );
      
      if (cropIndex === -1) {
        throw new Error('Cultivo local no encontrado');
      }
      
      const updatedCrop = {
        ...localCrops[cropIndex],
        history: localCrops[cropIndex].history.filter(act => 
          act._id !== action._id && act.id !== action._id
        )
      };
      
      const updatedCrops = [...localCrops];
      updatedCrops[cropIndex] = updatedCrop;
      
      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      console.log('✅ Acción local eliminada correctamente');
      
      await refreshCache();
      
      setActions(prevActions => 
        prevActions.filter(a => a._id !== action._id)
      );
      
      await checkPendingActions();
      
      Alert.alert('✅ Éxito', 'Acción local eliminada correctamente');
      
    } catch (error) {
      console.error('❌ Error eliminando acción local:', error);
      Alert.alert('❌ Error', 'No se pudo eliminar la acción local');
    } finally {
      setDeletingActionId(null);
    }
  };

  const removeActionLocally = (action) => {
    setActions(prevActions => 
      prevActions.filter(a => a._id !== action._id)
    );
    Alert.alert('✅ Éxito', 'Acción removida localmente');
  };

  const loadCropsManually = async () => {
    try {
      const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
      const localCrops = JSON.parse(localCropsString);
      console.log('📁 Cultivos locales cargados:', localCrops.length);

      let mongoCrops = [];
      if (user && user.id && isConnected) {
        try {
          const response = await fetch(`${API_BASE_URL}/farmer/crops`, {
            headers: { 'Authorization': user.id }
          });
          if (response.ok) {
            mongoCrops = await response.json();
            console.log('☁️ Cultivos desde servidor cargados:', mongoCrops.length);
          }
        } catch (error) {
          console.log('❌ Error cargando cultivos del servidor:', error);
        }
      }

      return [...mongoCrops, ...localCrops.filter(crop => !crop.synced)];
    } catch (error) {
      console.log('❌ Error cargando cultivos manualmente:', error);
      return [];
    }
  };

  const handleManualSync = async () => {
    if (!isConnected) {
      Alert.alert('Sin Conexión', 'No hay conexión a internet para sincronizar');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Usuario no identificado');
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Iniciando sincronización manual...');
      console.log('📱 Usuario:', user.id);
      console.log('🔗 API Base URL:', API_BASE_URL);
      
      const result = await syncPendingData();
      console.log('📊 Resultado de sincronización:', result);
      
      if (result.success) {
        Alert.alert('✅ Éxito', 
          result.synced > 0 
            ? `Se sincronizaron ${result.synced} acción(es) correctamente`
            : 'No había acciones pendientes por sincronizar'
        );
        
        await refreshCache();
        await loadActions(true);
        await checkPendingActions();
      } else {
        console.log('❌ Sincronización falló. Detalles:', result);
        
        let errorMessage = 'No se pudieron sincronizar los datos pendientes';
        if (result.message) {
          errorMessage = result.message;
        }
        if (result.errorDetails && result.errorDetails.length > 0) {
          errorMessage += `\n\nErrores:\n${result.errorDetails.slice(0, 3).join('\n')}`;
          if (result.errorDetails.length > 3) {
            errorMessage += `\n... y ${result.errorDetails.length - 3} más`;
          }
        }
        
        Alert.alert('❌ Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ Error en sincronización manual:', error);
      Alert.alert('❌ Error', `No se pudo completar la sincronización: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterActions = () => {
    let filtered = actions;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(action => action.type === filterType);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(action => 
        action.seed?.toLowerCase().includes(query) ||
        action.observations?.toLowerCase().includes(query) ||
        action.bioFertilizer?.toLowerCase().includes(query) ||
        action.location?.toLowerCase().includes(query) ||
        action.cropName?.toLowerCase().includes(query) ||
        (action.cropData?.crop?.toLowerCase().includes(query)) ||
        (action.cropData?.location?.toLowerCase().includes(query)) ||
        action.type.toLowerCase().includes(query) ||
        (action.action?.toLowerCase().includes(query))
      );
    }
    
    setFilteredActions(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActions(true);
  };

  const getActionIcon = (action) => {
    const baseIcon = (() => {
      switch (action.type) {
        case 'sowing': return '🌱';
        case 'watering': return '💧';
        case 'fertilization': return '🧪';
        case 'harvest': return '📦';
        case 'pruning': return '✂️';
        default: return '📝';
      }
    })();
    
    if (action._source === 'local' || action.isLocal) {
      return `${baseIcon} 💾`;
    }
    
    return `${baseIcon} 🌐`;
  };

  const getStatusColor = (action) => {
    if (action._source === 'local' || action.isLocal) return '#ff9800';
    return action.synced ? '#4caf50' : '#ff9800';
  };

  const getStatusText = (action) => {
    if (action._source === 'local' || action.isLocal) return 'Pendiente de sincronizar';
    return action.synced ? 'Sincronizado' : 'Pendiente';
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

  const getActionDescription = (action) => {
    if (action.action) {
      return action.action;
    }
    
    const baseDescription = (() => {
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
    })();
    
    if (action._source === 'local' || action.isLocal) {
      return `${baseDescription} (Local)`;
    }
    
    return baseDescription;
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 🔹 Header - Mismo estilo que Home Farmer */}
      <View style={styles.header}>
        <Text style={styles.title}>📊 Historial de Acciones</Text>
        <Text style={styles.subtitle}>
          Revisa todas tus actividades agrícolas registradas
        </Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Home Farmer */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>
        
        {actualPendingSyncCount > 0 && (
          <Text style={styles.unsyncedText}>
            📱 {actualPendingSyncCount} pendientes
          </Text>
        )}
      </View>

      {/* 🔹 Tarjeta de estadísticas - Mismo estilo que Home Farmer */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>📈</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Estadísticas del Historial</Text>
              <Text style={styles.cardSubtitle}>
                Resumen de todas tus actividades
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
            <Text style={styles.detailLabel}>Total de acciones:</Text>
            <Text style={styles.detailValue}>{actions.length}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Acciones filtradas:</Text>
            <Text style={styles.detailValue}>{filteredActions.length}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Por sincronizar:</Text>
            <Text style={[styles.detailValue, { color: actualPendingSyncCount > 0 ? '#ff9800' : '#4caf50' }]}>
              {actualPendingSyncCount}
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 Sección de búsqueda y filtros */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>🔍 Buscar y Filtrar</Text>
        
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar en cultivos, acciones, ubicaciones..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {['all', 'sowing', 'watering', 'fertilization', 'harvest', 'pruning', 'other'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterButton, filterType === type && styles.filterButtonActive]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>
                {type === 'all' ? 'Todas' : 
                 type === 'sowing' ? '🌱 Siembra' :
                 type === 'watering' ? '💧 Riego' :
                 type === 'fertilization' ? '🧪 Fertilización' :
                 type === 'harvest' ? '📦 Cosecha' :
                 type === 'pruning' ? '✂️ Poda' : '📝 Otra'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 🔹 Botón de sincronización */}
        {isConnected && actualPendingSyncCount > 0 && (
          <TouchableOpacity 
            style={styles.syncButton}
            onPress={handleManualSync}
            disabled={loading}
          >
            <Text style={styles.syncButtonText}>
              {loading ? '🔄 Sincronizando...' : `🔄 Sincronizar ${actualPendingSyncCount} pendiente(s)`}
            </Text>
          </TouchableOpacity>
        )}

        {/* 🔹 Indicador cuando no hay pendientes */}
        {isConnected && actualPendingSyncCount === 0 && (
          <View style={styles.noPendingCard}>
            <Text style={styles.noPendingText}>✅ Todo sincronizado</Text>
          </View>
        )}
      </View>

      {/* 🔹 Lista de acciones - Mismo estilo de tarjetas */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>📋 Lista de Acciones</Text>
        
        {filteredActions.length > 0 ? (
          filteredActions.map((action, index) => {
            const uniqueKey = generateUniqueKey(action, index);
            const isDeleting = deletingActionId === action._id;
            
            return (
              <View key={uniqueKey} style={styles.actionCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardIcon}>{getActionIcon(action)}</Text>
                    <View style={styles.cardTitleText}>
                      <Text style={styles.cardName}>
                        {action.type === 'sowing' ? 'Siembra' :
                         action.type === 'watering' ? 'Riego' :
                         action.type === 'fertilization' ? 'Fertilización' :
                         action.type === 'harvest' ? 'Cosecha' :
                         action.type === 'pruning' ? 'Poda' : 'Otra'}
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {getActionDescription(action)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(action) }]}>
                      <Text style={styles.statusText}>
                        {getStatusText(action)}
                      </Text>
                    </View>
                    
                    {isConnected && (
                      <TouchableOpacity
                        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                        onPress={() => handleDeleteAction(action)}
                        disabled={isDeleting}
                      >
                        <Text style={styles.deleteButtonText}>
                          {isDeleting ? '🗑️...' : '🗑️'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cultivo:</Text>
                    <Text style={styles.detailValue}>{action.cropName}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ubicación:</Text>
                    <Text style={styles.detailValue}>{action.location}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha:</Text>
                    <Text style={styles.detailValue}>{formatDate(action.date || action.createdAt)}</Text>
                  </View>

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
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>
              {loading ? 'Cargando acciones...' : 'No se encontraron acciones'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || filterType !== 'all' 
                ? 'Prueba cambiando tu búsqueda o filtro' 
                : 'Registra tu primera acción agrícola'}
            </Text>
            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => router.push('/farmer/action-register')}
            >
              <Text style={styles.registerButtonText}>📝 Registrar primera acción</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
  filterSection: {
    marginBottom: 16,
  },
  actionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 BÚSQUEDA Y FILTROS
  searchInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: 'white',
  },
  // 🔹 BOTONES DE ACCIÓN
  syncButton: {
    backgroundColor: '#2196f3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  syncButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noPendingCard: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  noPendingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // 🔹 TARJETAS DE ACCIONES
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
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#dc3545',
    borderRadius: 8,
  },
  deleteButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
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
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});