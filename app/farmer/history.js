// app/farmer/history.js - VERSIÓN COMPLETA CON OFFLINE
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
  
  const { 
    user, 
    getUserCrops,
    API_BASE_URL,
    isConnected,
    pendingSyncCount,
    syncPendingData,
    deleteLocalCrop
  } = useSync();

  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 Pantalla de historial enfocada - cargando acciones...');
      loadActions();
    }, [])
  );

  useEffect(() => {
    loadActions();
  }, []);

  useEffect(() => {
    filterActions();
  }, [actions, searchQuery, filterType]);

  // 🔥 FUNCIÓN MEJORADA: Generar keys únicas
  const generateUniqueKey = (action, index) => {
    if (action._id) return action._id.toString();
    if (action.id) return action.id.toString();
    const datePart = action.date ? new Date(action.date).getTime() : Date.now();
    const cropPart = action.cropName ? action.cropName.replace(/\s+/g, '') : 'crop';
    const typePart = action.type || 'action';
    return `${datePart}-${typePart}-${cropPart}-${index}`;
  };

  // 🔄 FUNCIÓN PRINCIPAL MEJORADA: Cargar todas las acciones
  const loadActions = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Cargando datos para usuario:', user?.email);
      console.log('📶 Estado conexión:', isConnected ? 'Conectado' : 'Desconectado');
      
      let allCrops = [];
      
      if (user && user.id) {
        try {          
          allCrops = await getUserCrops();
          console.log('🌱 Datos cargados (app + web + locales):', allCrops.length);
          
        } catch (error) {
          console.log('❌ Error cargando cultivos:', error);
          allCrops = await loadCropsManually();
        }
      }

      const allActions = extractActionsFromCrops(allCrops);
      console.log('📋 Acciones extraídas:', allActions.length);

      // Ordenar por fecha (más recientes primero)
      const sortedActions = allActions.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt);
        const dateB = new Date(b.date || b.createdAt);
        return dateB - dateA;
      });

      setActions(sortedActions);
      console.log('✅ Historial cargado:', sortedActions.length, 'acciones');

    } catch (error) {
      console.log('❌ Error cargando historial:', error);
      Alert.alert('Error', 'No se pudieron cargar las acciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🔄 FUNCIÓN AUXILIAR: Extraer acciones de cultivos (MEJORADA)
  const extractActionsFromCrops = (crops) => {
    const allActions = [];
    
    crops.forEach(crop => {
      const cropId = crop._id || crop.id;
      const isWebProject = crop.isWebProject || false;
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
            _source: isLocal ? 'local' : (isWebProject ? 'web' : 'cloud'),
            synced: crop.synced !== false && action.synced !== false,
            isLegacy: crop.isLegacy || false,
            isWebAction: action.isWebAction || false,
            isWebProject: isWebProject,
            isLocal: isLocal,
            cropData: {
              crop: cropName,
              location: location,
              status: crop.status,
              humidity: crop.humidity,
              bioFertilizer: crop.bioFertilizer,
              observations: crop.observations,
              recommendations: crop.recommendations,
              isLegacy: crop.isLegacy || false,
              isWebProject: isWebProject,
              isWebAction: action.isWebAction || false,
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

  // 🗑️ FUNCIÓN PARA ELIMINAR ACCIÓN
  const handleDeleteAction = async (action) => {
    // Verificar si es una acción de la web - no se pueden eliminar
    if (action.isWebAction || action.isLegacy || action.isWebProject) {
      Alert.alert(
        '⚠️ Acción no eliminable',
        'Las acciones de la web no se pueden eliminar desde la app móvil.'
      );
      return;
    }

    // Verificar si es una acción local no sincronizada
    if (action._source === 'local' || action.isLocal) {
      Alert.alert(
        '🗑️ Eliminar acción local',
        '¿Estás seguro de que quieres eliminar esta acción local?',
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

    // Para acciones sincronizadas (en la nube)
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

  // 🗑️ ELIMINAR ACCIÓN DE LA NUBE
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
      const url = `${API_BASE_URL}/crops/${action.cropId}/history/${action._id}`;
      console.log('🔍 URL de eliminación:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': user.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Eliminación exitosa:', result);
        
        // Actualizar estado local inmediatamente
        setActions(prevActions => 
          prevActions.filter(a => a._id !== action._id)
        );
        
        Alert.alert('✅ Éxito', 'Acción eliminada correctamente');
      } else {
        const errorText = await response.text();
        console.log('❌ Error del servidor:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error eliminando acción:', error);
      Alert.alert('❌ Error', `No se pudo eliminar la acción: ${error.message}`);
    } finally {
      setDeletingActionId(null);
    }
  };

  // 🗑️ ELIMINAR ACCIÓN LOCAL
  const deleteLocalAction = async (action) => {
    try {
      console.log('🗑️ Eliminando acción local...');
      
      const success = await deleteLocalCrop(action.cropId);
      
      if (success) {
        // Recargar acciones
        await loadActions();
        Alert.alert('✅ Éxito', 'Acción local eliminada correctamente');
      } else {
        Alert.alert('Error', 'No se pudo eliminar la acción local');
      }
    } catch (error) {
      console.error('❌ Error eliminando acción local:', error);
      Alert.alert('❌ Error', 'No se pudo eliminar la acción local');
    }
  };

  // 🔄 FUNCIÓN AUXILIAR: Cargar cultivos manualmente (fallback)
  const loadCropsManually = async () => {
    try {
      const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
      const localCrops = JSON.parse(localCropsString);
      console.log('📁 Cultivos locales cargados:', localCrops.length);

      let mongoCrops = [];
      if (user && user.id && isConnected) {
        try {
          const response = await fetch(`${API_BASE_URL}/crops`, {
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

  // 🔄 FUNCIÓN DE SINCRONIZACIÓN MANUAL CON WEB
  const handleManualSync = async () => {
    if (!isConnected) {
      Alert.alert('Sin Conexión', 'No hay conexión a internet para sincronizar');
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Iniciando sincronización manual...');
      const result = await syncPendingData();
      
      if (result.success) {
        Alert.alert('✅ Éxito', 
          result.synced > 0 
            ? `Se sincronizaron ${result.synced} acción(es) correctamente`
            : 'No había acciones pendientes por sincronizar'
        );
        // Recargar datos
        await loadActions();
      } else {
        Alert.alert('❌ Error', 'No se pudieron sincronizar los datos pendientes');
      }
    } catch (error) {
      console.error('❌ Error en sincronización manual:', error);
      Alert.alert('❌ Error', 'No se pudo completar la sincronización');
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
    await loadActions();
  };

  // 🔄 FUNCIÓN MEJORADA: Obtener ícono con indicador de origen
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
    
    // 🔥 NUEVO: Identificar proyectos web
    if (action.isWebProject) {
      return `${baseIcon} 🌐`;
    } else if (action.isWebAction) {
      return `${baseIcon} 🔗`;
    } else if (action._source === 'local' || action.isLocal) {
      return `${baseIcon} 💾`;
    }
    
    return baseIcon;
  };

  const getStatusColor = (action) => {
    if (action.isWebProject) return '#2196f3';
    if (action.isWebAction) return '#2196f3';
    if (action._source === 'local' || action.isLocal) return '#ff9800';
    return action.synced ? '#4caf50' : '#ff9800';
  };

  const getStatusText = (action) => {
    if (action.isWebProject) return 'Proyecto Web';
    if (action.isWebAction) return 'Desde la Web';
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

  // 🔄 FUNCIÓN MEJORADA: Obtener descripción de acción
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
    
    if (action.isWebProject) {
      return `${baseDescription} (Proyecto Web)`;
    } else if (action.isWebAction) {
      return `${baseDescription} (Web)`;
    } else if (action._source === 'local' || action.isLocal) {
      return `${baseDescription} (Local)`;
    }
    
    return baseDescription;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>📊 Historial de Acciones</Text>

      {/* Información de sincronización */}
      <View style={styles.syncSection}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>

        {pendingSyncCount > 0 && (
          <TouchableOpacity style={styles.syncButton} onPress={handleManualSync}>
            <Text style={styles.syncButtonText}>
              🔄 Sincronizar {pendingSyncCount} pendiente(s)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filterSection}>
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

        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            📊 Mostrando {filteredActions.length} de {actions.length} acciones
          </Text>
          <Text style={styles.statsSubtext}>
            {actions.filter(a => a.isWebProject || a.isWebAction).length} desde la web • 
            {actions.filter(a => a._source === 'local' || a.isLocal).length} locales
          </Text>
        </View>
      </View>

      {/* Lista de acciones */}
      <View style={styles.actionsList}>
        {filteredActions.length > 0 ? (
          filteredActions.map((action, index) => {
            const uniqueKey = generateUniqueKey(action, index);
            const isDeleting = deletingActionId === action._id;
            
            return (
              <View key={uniqueKey} style={styles.actionCard}>
                <View style={styles.actionHeader}>
                  <View style={styles.actionTitleContainer}>
                    <Text style={styles.actionIcon}>{getActionIcon(action)}</Text>
                    <View style={styles.actionTitleText}>
                      <Text style={styles.actionType}>
                        {action.type === 'sowing' ? 'Siembra' :
                         action.type === 'watering' ? 'Riego' :
                         action.type === 'fertilization' ? 'Fertilización' :
                         action.type === 'harvest' ? 'Cosecha' :
                         action.type === 'pruning' ? 'Poda' : 'Otra'}
                      </Text>
                      <Text style={styles.actionDescription}>
                        {getActionDescription(action)}
                      </Text>
                      <Text style={styles.actionDate}>
                        {formatDate(action.date || action.createdAt)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.headerRight}>
                    <View style={[styles.syncBadge, { backgroundColor: getStatusColor(action) }]}>
                      <Text style={styles.syncText}>
                        {getStatusText(action)}
                      </Text>
                    </View>
                    
                    {/* 🗑️ BOTÓN DE ELIMINAR - Solo para acciones de la app */}
                    {!action.isWebAction && !action.isLegacy && !action.isWebProject && (
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

                <View style={styles.actionDetails}>
                  {/* Información del cultivo */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cultivo:</Text>
                    <Text style={styles.detailValue}>{action.cropName}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ubicación:</Text>
                    <Text style={styles.detailValue}>{action.location}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#2e7d32',
  },
  syncSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#4caf50',
  },
  statusOffline: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterSection: {
    marginBottom: 20,
  },
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
  statsContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  statsSubtext: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  actionsList: {
    marginBottom: 20,
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
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  actionTitleText: {
    flex: 1,
  },
  actionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  actionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  syncText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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
  actionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
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
});