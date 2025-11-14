// contexts/SyncContext.js - VERSIÓN COMPLETA ACTUALIZADA CON VALIDACIÓN DE CACHE Y FARMER SERVICE
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import API_CONFIG from '../config/api';
import { farmerService } from '../services/farmerService';

const SyncContext = createContext();

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync debe ser usado dentro de un SyncProvider');
  }
  return context;
};

export const SyncProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [serverStatus, setServerStatus] = useState('checking');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [cachedCrops, setCachedCrops] = useState([]);
  const [lastCacheUpdate, setLastCacheUpdate] = useState(null);

  const refreshInProgress = useRef(false);
  const API_BASE_URL = API_CONFIG.API_BASE_URL;

  // 🔧 FUNCIÓN AUXILIAR: VERIFICAR CONEXIÓN
  const checkConnection = async () => {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected;
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasDisconnected = !isConnected && state.isConnected;
      setIsConnected(state.isConnected);
      console.log('📶 Estado conexión:', state.isConnected ? 'Conectado' : 'Desconectado');

      if (wasDisconnected && user?.id && !refreshInProgress.current) {
        console.log('🔄 Reconectado - Validando cache contra servidor...');
        refreshInProgress.current = true;
        
        // ✅ NUEVA LÓGICA: Validar y limpiar cache
        validateCacheWithServer().finally(() => {
          refreshInProgress.current = false;
        });
      }
    });

    const initializeData = async () => {
      await loadUser();
      await checkPendingSync();
      await loadLastSync();
      
      // ✅ Validar cache al iniciar si hay conexión
      if (isConnected && user?.id) {
        await validateCacheWithServer();
      }
    };

    initializeData();

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected || !user?.id || refreshInProgress.current) return;

    const needsRefresh = !lastCacheUpdate || (Date.now() - lastCacheUpdate > 300000);

    if (needsRefresh && !refreshInProgress.current) {
      console.log('🔄 Cache necesita actualización, refrescando...');
      refreshInProgress.current = true;

      const refreshCacheSafely = async () => {
        try {
          await refreshCache();
        } catch (error) {
          console.log('❌ Error en refresh cache:', error);
        } finally {
          refreshInProgress.current = false;
          setLastCacheUpdate(Date.now());
        }
      };

      refreshCacheSafely();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, user, lastCacheUpdate]);

  // ✅ NUEVA FUNCIÓN: Validar cache contra el servidor
  const validateCacheWithServer = async () => {
    if (!user?.id || !isConnected) {
      console.log('🚫 Validación cancelada - sin usuario o conexión');
      return;
    }

    try {
      console.log('🔍 Validando cache contra servidor...');

      // Para scientists: validar agricultores y cultivos
      if (user.role === 'scientist') {
        await scientistService.validateAndCleanCache(user.id);
      }

      // Para farmers: usar farmer service para validar
      if (user.role === 'farmer') {
        await farmerService.validateAndCleanCache(user.id);
      }

      console.log('✅ Validación de cache completada');

    } catch (error) {
      console.log('❌ Error en validación de cache:', error);
    }
  };

  // 🔧 FUNCIÓN: VERIFICAR DATOS PENDIENTES
  const checkPendingSync = async () => {
    try {
      const localCrops = await getLocalCrops();
      const unsyncedCount = localCrops.filter(crop => !crop.synced).length;
      setPendingSyncCount(unsyncedCount);
      console.log(`📊 Pendientes por sincronizar: ${unsyncedCount}`);
      return unsyncedCount;
    } catch (error) {
      console.log('❌ Error verificando datos pendientes:', error);
      setPendingSyncCount(0);
      return 0;
    }
  };

  // 🔧 FUNCIÓN: CARGAR USUARIO
  const loadUser = async () => {
    try {
      console.log('🔄 Cargando usuario desde AsyncStorage...');
      const userData = await AsyncStorage.getItem('user');

      if (userData) {
        const userObj = JSON.parse(userData);
        setUser(userObj);
        console.log('✅ Usuario cargado:', userObj.email);
        return userObj;
      } else {
        console.log('📭 No hay usuario guardado');
        setUser(null);
        return null;
      }
    } catch (error) {
      console.log('❌ Error cargando usuario:', error);
      setUser(null);
      return null;
    }
  };

  // 🔧 FUNCIÓN: GUARDAR USUARIO
  const saveUser = async (userData) => {
    try {
      console.log('💾 Guardando usuario:', userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      console.log('✅ Usuario guardado correctamente');
    } catch (error) {
      console.log('❌ Error guardando usuario:', error);
      throw error;
    }
  };

  // FUNCIÓN PARA ACTUALIZAR EL CACHE CON DATOS ACTUALES
  const refreshCache = async () => {
    if (!user?.id || !isConnected) {
      console.log('🚫 Refresh cache cancelado - sin usuario o conexión');
      return;
    }

    try {
      console.log('🔄 Actualizando cache...');

      const localCrops = await getLocalCrops();
      const url = `${API_BASE_URL}/farmer/crops`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': user.id.toString(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const serverData = await response.json();
        console.log('✅ Datos del servidor recibidos:', serverData.length);

        const localUnsynced = localCrops.filter(crop => !crop.synced);
        const allData = [...serverData, ...localUnsynced];

        await cacheUserCrops(allData);
        console.log('💾 Cache actualizado correctamente');
      } else {
        console.log('❌ Error response refresh cache:', response.status);
      }
    } catch (error) {
      console.log('❌ Error actualizando cache:', error.message);
    }
  };

  // CARGAR CULTIVOS EN CACHE
  const loadCachedCrops = async (forceRefresh = false) => {
    try {
      const cachedData = await AsyncStorage.getItem('cachedCrops');

      if (cachedData && !forceRefresh) {
        const { data, timestamp, userId } = JSON.parse(cachedData);

        const isCurrentUser = user && user.id === userId;

        if (isCurrentUser) {
          const isStale = Date.now() - timestamp > 300000;

          if (isStale && isConnected && !refreshInProgress.current) {
            console.log('🔄 Cache desactualizado, refrescando...');
            refreshInProgress.current = true;
            await refreshCache();
            refreshInProgress.current = false;
            return await loadCachedCrops(true);
          }

          setCachedCrops(data);
          console.log('📁 Cultivos en cache cargados:', data.length);
          return data;
        } else {
          await AsyncStorage.removeItem('cachedCrops');
        }
      }

      if (forceRefresh || !cachedData) {
        console.log('🔄 Cargando datos actuales para cache...');
        const currentCrops = await getUserCrops(false);
        const activeCrops = currentCrops.filter(crop =>
          crop.status?.toLowerCase() === 'activo' ||
          crop._source === 'local' ||
          !crop.synced
        );
        await cacheUserCrops(activeCrops);
        return activeCrops;
      }

      return [];
    } catch (error) {
      console.log('❌ Error cargando cache:', error);
      return [];
    }
  };

  // GUARDAR CULTIVOS EN CACHE
  const cacheUserCrops = async (crops) => {
    try {
      const cacheData = {
        data: crops,
        timestamp: Date.now(),
        userId: user?.id,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem('cachedCrops', JSON.stringify(cacheData));
      setCachedCrops(crops);
      setLastCacheUpdate(Date.now());
      console.log('💾 Cultivos guardados en cache:', crops.length);
    } catch (error) {
      console.log('❌ Error guardando en cache:', error);
    }
  };

  // OBTENER CULTIVOS
  const getUserCrops = async (useCache = false) => {
    try {
      console.log('🔍 Iniciando getUserCrops, useCache:', useCache);

      if (useCache && cachedCrops.length > 0) {
        console.log('📁 Usando cultivos en cache:', cachedCrops.length);
        return cachedCrops;
      }

      const localCrops = await getLocalCrops();
      console.log('📁 Cultivos locales:', localCrops.length);

      if (!user?.id || !isConnected) {
        console.log('❌ No hay usuario o sin conexión, retornando locales');
        return localCrops;
      }

      console.log('🔄 Conectando al servidor...');
      const url = `${API_BASE_URL}/farmer/crops`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': user.id.toString(),
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response.ok) {
          const serverData = await response.json();
          console.log('✅ Datos del servidor recibidos:', serverData.length);

          const serverCropIds = serverData.map(crop => crop._id);
          const validLocalCrops = localCrops.filter(crop =>
            crop.synced ? serverCropIds.includes(crop._id) : true
          );

          const localUnsynced = validLocalCrops.filter(crop => !crop.synced);
          const allData = [...serverData, ...localUnsynced];

          console.log('📊 Total datos combinados (limpios):', allData.length);
          return allData;
        } else {
          const errorText = await response.text();
          console.log('❌ Error del servidor:', response.status, errorText);
          return localCrops;
        }
      } catch (fetchError) {
        console.log('❌ Error de fetch:', fetchError.message);
        return localCrops;
      }

    } catch (error) {
      console.log('❌ Error en getUserCrops:', error.message);
      return await getLocalCrops();
    }
  };

  // OBTENER CULTIVOS LOCALES
  const getLocalCrops = async () => {
    try {
      const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
      const localCrops = JSON.parse(localCropsString);

      const userCrops = user?.id
        ? localCrops.filter(crop => crop.userId === user.id)
        : localCrops;

      console.log('📁 Cultivos locales encontrados:', userCrops.length);
      return userCrops;
    } catch (error) {
      console.log('❌ Error obteniendo cultivos locales:', error);
      return [];
    }
  };

  // GUARDAR CULTIVO LOCAL
  const saveCropLocal = async (cropData) => {
    try {
      console.log('💾 Iniciando guardado local...');

      // VALIDAR DATOS ANTES DE GUARDAR
      if (!cropData.crop || !cropData.location) {
        throw new Error('Cultivo y ubicación son requeridos');
      }

      // GENERAR ID ÚNICO
      const cropId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const cropToSave = {
        ...cropData,
        id: cropId,
        synced: false,
        createdAt: new Date().toISOString(),
        userId: user?.id,
        _source: 'local',
        history: cropData.history || [{
          _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          type: cropData.actionType || 'other',
          seed: cropData.seed || '',
          action: generateActionDescription(cropData.actionType, cropData.seed, cropData.bioFertilizer),
          bioFertilizer: cropData.bioFertilizer || '',
          observations: cropData.observations || '',
          synced: false
        }]
      };

      console.log('📝 Cultivo a guardar:', {
        id: cropToSave.id,
        crop: cropToSave.crop,
        location: cropToSave.location,
        history: cropToSave.history?.length || 0
      });

      const existingCrops = await getLocalCrops();

      // VERIFICAR SI YA EXISTE (evitar duplicados)
      const alreadyExists = existingCrops.some(crop =>
        crop.crop?.toLowerCase().trim() === cropData.crop.toLowerCase().trim() &&
        crop.location?.toLowerCase().trim() === cropData.location.toLowerCase().trim() &&
        !crop.synced
      );

      if (alreadyExists) {
        console.log('⚠️ Cultivo ya existe localmente, actualizando...');
        // Actualizar cultivo existente en lugar de crear uno nuevo
        const updatedCrops = existingCrops.map(crop => {
          if (crop.crop?.toLowerCase().trim() === cropData.crop.toLowerCase().trim() &&
            crop.location?.toLowerCase().trim() === cropData.location.toLowerCase().trim() &&
            !crop.synced) {
            return {
              ...crop,
              ...cropData,
              updatedAt: new Date().toISOString(),
              history: [...(crop.history || []), ...(cropToSave.history || [])]
            };
          }
          return crop;
        });

        await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      } else {
        // AGREGAR NUEVO CULTIVO
        existingCrops.push(cropToSave);
        await AsyncStorage.setItem('localCrops', JSON.stringify(existingCrops));
      }

      // ACTUALIZAR CACHE
      await refreshCache();
      await checkPendingSync();

      console.log('✅ Cultivo guardado localmente correctamente');

      return cropToSave;
    } catch (error) {
      console.log('❌ Error guardando localmente:', error);
      throw error;
    }
  };

  // GENERAR DESCRIPCIÓN DE ACCIÓN
  const generateActionDescription = (type, seed, bioFertilizer) => {
    switch (type) {
      case 'sowing':
        return `Siembra de ${seed || 'cultivo'}`;
      case 'watering':
        return 'Riego aplicado';
      case 'fertilization':
        return `Aplicación de ${bioFertilizer || 'biofertilizante'}`;
      case 'harvest':
        return 'Cosecha realizada';
      case 'pruning':
        return 'Poda realizada';
      default:
        return 'Acción realizada';
    }
  };

  // SINCRONIZAR DATOS PENDIENTES
  const syncPendingData = async () => {
    if (!isConnected) {
      return { success: false, message: 'No hay conexión a internet' };
    }

    if (!user?.id) {
      return { success: false, message: 'No hay usuario logueado' };
    }

    if (isSyncing) {
      return { success: false, message: 'Sincronización en curso' };
    }

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const localCrops = await getLocalCrops();
      const unsyncedCrops = localCrops.filter(crop => !crop.synced);

      console.log(`📤 Encontrados ${unsyncedCrops.length} cultivos pendientes de sincronizar`);

      if (unsyncedCrops.length === 0) {
        await updateLastSync();
        return {
          success: true,
          message: 'No hay datos pendientes por sincronizar',
          synced: 0
        };
      }

      let successCount = 0;
      let errorCount = 0;
      let errors = [];

      for (let i = 0; i < unsyncedCrops.length; i++) {
        const crop = unsyncedCrops[i];

        try {
          console.log(`🔄 Sincronizando cultivo: ${crop.crop} - ${crop.location}`);

          const { id, _source, synced, userId, ...cropToSend } = crop;

          const lastAction = crop.history && crop.history.length > 0
            ? crop.history[crop.history.length - 1]
            : null;

          const payload = {
            crop: cropToSend.crop,
            location: cropToSend.location,
            actionType: lastAction?.type || 'sowing',
            seed: lastAction?.seed || '',
            bioFertilizer: lastAction?.bioFertilizer || cropToSend.bioFertilizer || '',
            observations: cropToSend.observations || '',
            recommendations: cropToSend.recommendations || '',
            humidity: cropToSend.humidity || null,
            status: cropToSend.status || 'Activo'
          };

          console.log('📤 Enviando payload:', payload);

          const response = await fetch(`${API_BASE_URL}/farmer/crops`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': user.id.toString()
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Cultivo sincronizado exitosamente:', result);

            await markCropAsSynced(crop.id);
            successCount++;
          } else {
            const errorText = await response.text();
            console.log(`❌ Error del servidor: ${response.status} - ${errorText}`);
            errors.push(`Cultivo ${crop.crop}: ${response.status} - ${errorText}`);
            errorCount++;
          }
        } catch (error) {
          console.log(`❌ Error sincronizando cultivo ${crop.crop}:`, error);
          errors.push(`Cultivo ${crop.crop}: ${error.message}`);
          errorCount++;
        }

        setSyncProgress(((i + 1) / unsyncedCrops.length) * 100);
      }

      if (successCount > 0) {
        console.log('🔄 Actualizando cache después de sincronización...');
        await refreshCache();
      }

      await checkPendingSync();
      await updateLastSync();

      const result = {
        success: errorCount === 0,
        message: `Sincronización completada: ${successCount} exitosos, ${errorCount} errores`,
        synced: successCount,
        errors: errorCount,
        errorDetails: errors
      };

      console.log('📊 Resultado final de sincronización:', result);
      return result;

    } catch (error) {
      console.log('❌ Error general en sincronización:', error);
      return {
        success: false,
        message: `Error en sincronización: ${error.message}`,
        synced: 0,
        errors: 1
      };
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  // MARCAR CULTIVO COMO SINCRONIZADO
  const markCropAsSynced = async (cropId) => {
    try {
      const localCrops = await getLocalCrops();
      const updatedCrops = localCrops.map(crop => {
        if (crop.id === cropId) {
          return {
            ...crop,
            synced: true,
            syncedAt: new Date().toISOString(),
            _source: 'web'
          };
        }
        return crop;
      });

      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      console.log(`✅ Cultivo ${cropId} marcado como sincronizado`);

      if (cachedCrops.length > 0) {
        const updatedCache = cachedCrops.map(crop =>
          crop.id === cropId ? { ...crop, synced: true, syncedAt: new Date().toISOString() } : crop
        );
        await cacheUserCrops(updatedCache);
      }

      return true;
    } catch (error) {
      console.log('❌ Error marcando cultivo como sincronizado:', error);
      return false;
    }
  };

  // ELIMINAR CULTIVO LOCAL
  const deleteLocalCrop = async (cropId) => {
    try {
      const localCrops = await getLocalCrops();
      const updatedCrops = localCrops.filter(crop => crop.id !== cropId);

      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));

      if (cachedCrops.length > 0) {
        const updatedCache = cachedCrops.filter(crop => crop.id !== cropId);
        await cacheUserCrops(updatedCache);
      }

      await checkPendingSync();

      return true;
    } catch (error) {
      console.log('❌ Error eliminando cultivo local:', error);
      return false;
    }
  };

  // LIMPIAR CACHE DE CULTIVOS ELIMINADOS
  const cleanDeletedCropsFromCache = async () => {
    if (!user?.id || !isConnected) return;

    try {
      console.log('🧹 Limpiando cache de cultivos eliminados...');

      const url = `${API_BASE_URL}/farmer/crops`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': user.id.toString(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const serverData = await response.json();
        const serverCropIds = serverData.map(crop => crop._id);

        const cleanedCache = cachedCrops.filter(crop =>
          crop._source === 'local' || !crop.synced || serverCropIds.includes(crop._id)
        );

        if (cleanedCache.length !== cachedCrops.length) {
          await cacheUserCrops(cleanedCache);
          console.log('✅ Cache limpiado. Removidos:', cachedCrops.length - cleanedCache.length);
        }
      }
    } catch (error) {
      console.log('❌ Error limpiando cache:', error);
    }
  };

  // CERRAR SESIÓN
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('localCrops');
      await AsyncStorage.removeItem('lastSync');
      await AsyncStorage.removeItem('cachedCrops');
      setUser(null);
      setPendingSyncCount(0);
      setLastSync(null);
      setCachedCrops([]);
      console.log('🚪 Sesión cerrada correctamente');
    } catch (error) {
      console.log('❌ Error en logout:', error);
    }
  };

  // GUARDAR ÚLTIMA SINCRONIZACIÓN
  const updateLastSync = async () => {
    try {
      const now = new Date();
      setLastSync(now);
      await AsyncStorage.setItem('lastSync', now.toISOString());
    } catch (error) {
      console.log('❌ Error guardando última sincronización:', error);
    }
  };

  // CARGAR ÚLTIMA SINCRONIZACIÓN
  const loadLastSync = async () => {
    try {
      const lastSyncString = await AsyncStorage.getItem('lastSync');
      if (lastSyncString) {
        const lastSyncDate = new Date(lastSyncString);
        setLastSync(lastSyncDate);
      }
    } catch (error) {
      console.log('❌ Error cargando última sincronización:', error);
    }
  };

  // FUNCIÓN PARA LIMPIAR Y REPARAR DATOS LOCALES
  const repairLocalData = async () => {
    try {
      console.log('🔧 Iniciando reparación de datos locales...');

      const localCrops = await getLocalCrops();
      console.log('📁 Cultivos locales antes de reparar:', localCrops.length);

      // FILTRAR DATOS VÁLIDOS
      const validCrops = localCrops.filter(crop => {
        const isValid = crop &&
          crop.id &&
          crop.crop &&
          crop.location &&
          typeof crop.synced === 'boolean';

        if (!isValid) {
          console.log('🗑️ Eliminando cultivo inválido:', crop);
        }

        return isValid;
      });

      // ELIMINAR DUPLICADOS (mismo crop y location)
      const uniqueCrops = [];
      const seen = new Set();

      validCrops.forEach(crop => {
        const key = `${crop.crop?.toLowerCase().trim()}-${crop.location?.toLowerCase().trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueCrops.push(crop);
        } else {
          console.log('🔍 Encontrado duplicado, eliminando:', crop.crop, crop.location);
        }
      });

      // GUARDAR DATOS REPARADOS
      await AsyncStorage.setItem('localCrops', JSON.stringify(uniqueCrops));

      // ACTUALIZAR CACHE
      if (cachedCrops.length > 0) {
        await cacheUserCrops(uniqueCrops);
      }

      await checkPendingSync();

      console.log('✅ Reparación completada. Cultivos válidos:', uniqueCrops.length);
      return { success: true, repaired: validCrops.length - uniqueCrops.length };

    } catch (error) {
      console.log('❌ Error en reparación:', error);
      return { success: false, error: error.message };
    }
  };

  // FORMATEAR FECHA DE SINCRONIZACIÓN
  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';

    const now = new Date();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;

    return lastSync.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /* ---------------- FUNCIONES PARA SCIENTIST ---------------- */

  // Obtener agricultores del servidor (necesaria si se desea refrescar)
  const getFarmersFromServer = async () => {
    if (!user?.id || !isConnected) return [];
    try {
      const response = await fetch(`${API_BASE_URL}/scientist/farmers`, {
        method: 'GET',
        headers: {
          'Authorization': user.id.toString(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Agricultores recibidos del servidor:', data.length);
        return data;
      } else {
        console.log('❌ Error obteniendo agricultores:', response.status);
      }
    } catch (error) {
      console.log('❌ Error en getFarmersFromServer:', error);
    }
    return [];
  };

  // ✅ NUEVAS FUNCIONES MEJORADAS PARA SCIENTIST SERVICE
  const scientistService = {
    // Validar y limpiar cache contra el servidor
    async validateAndCleanCache(userId) {
      try {
        console.log('🧹 [SCIENTIST] Validando cache contra servidor...');
        
        const isConnected = await checkConnection();
        if (!isConnected) {
          console.log('📴 [SCIENTIST] Sin conexión, omitiendo validación');
          return;
        }

        // Obtener datos del servidor
        const serverFarmers = await this.getFarmers(userId);
        const serverFarmerIds = new Set(serverFarmers.map(f => f._id));

        // Limpiar cache de farmers
        const cachedFarmers = await this.loadCachedFarmers(userId);
        const validFarmers = cachedFarmers.filter(f => serverFarmerIds.has(f._id));
        
        if (validFarmers.length !== cachedFarmers.length) {
          console.log(`🗑️ [SCIENTIST] Eliminando ${cachedFarmers.length - validFarmers.length} agricultores del cache`);
          await this.cacheFarmersData(userId, validFarmers);
        }

        // Limpiar cache de cultivos para cada agricultor
        for (const farmer of serverFarmers) {
          const serverCrops = await this.getFarmerCrops(userId, farmer._id);
          const serverCropIds = new Set(serverCrops.map(c => c._id));
          
          const cacheKey = `crops_${farmer._id}`;
          const cachedCrops = await this.loadCachedCrops(userId, cacheKey);
          const validCrops = cachedCrops.filter(c => serverCropIds.has(c._id));
          
          if (validCrops.length !== cachedCrops.length) {
            console.log(`🗑️ [SCIENTIST] Eliminando ${cachedCrops.length - validCrops.length} cultivos del cache para farmer ${farmer._id}`);
            await this.cacheCropsData(userId, cacheKey, validCrops);
          }
        }

        console.log('✅ [SCIENTIST] Validación completada');
        
      } catch (error) {
        console.log('❌ [SCIENTIST] Error en validación:', error);
      }
    },

    // Limpiar todo el cache de un usuario
    async clearAllUserCache(userId) {
      try {
        console.log('🧹 [SCIENTIST] Limpiando todo el cache del usuario...');
        
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter(key => 
          key.includes(`_${userId}`) || 
          key.includes(`cachedFarmers_${userId}`) ||
          key.includes(`cachedCrops_${userId}`)
        );

        await AsyncStorage.multiRemove(userKeys);
        
        console.log(`✅ [SCIENTIST] ${userKeys.length} entradas eliminadas del cache`);
        
      } catch (error) {
        console.log('❌ [SCIENTIST] Error limpiando cache:', error);
      }
    },

    // Forzar refresh completo
    async forceRefreshAllData(userId) {
      try {
        console.log('🔄 [SCIENTIST] Forzando refresh completo de datos...');
        
        // Limpiar cache existente
        await this.clearAllUserCache(userId);
        
        // Obtener datos frescos del servidor
        const farmers = await this.getFarmers(userId);
        await this.cacheFarmersData(userId, farmers);
        
        // Obtener cultivos de cada agricultor
        for (const farmer of farmers) {
          const crops = await this.getFarmerCrops(userId, farmer._id);
          await this.cacheCropsData(userId, `crops_${farmer._id}`, crops);
        }
        
        console.log('✅ [SCIENTIST] Refresh completo finalizado');
        return { success: true, farmers: farmers.length };
        
      } catch (error) {
        console.log('❌ [SCIENTIST] Error en refresh completo:', error);
        throw error;
      }
    },

    // Función auxiliar para verificar conexión
    async checkConnection() {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected;
    },

    // Simulación de funciones del scientistService original
    async getFarmers(userId) {
      return await getFarmersFromServer();
    },

    async getFarmerCrops(userId, farmerId) {
      // Implementación simulada - debería reemplazarse con la real
      return [];
    },

    // Guardar datos de agricultores en cache local
    async cacheFarmersData(userId, farmersData) {
      try {
        const cacheData = {
          data: farmersData,
          timestamp: Date.now(),
          userId: userId,
          lastUpdated: new Date().toISOString(),
          expiresAt: Date.now() + (2 * 60 * 1000) // 2 minutos de expiración
        };
        await AsyncStorage.setItem(`cachedFarmers_${userId}`, JSON.stringify(cacheData));
        console.log('💾 [SCIENTIST] Datos de agricultores guardados en cache:', farmersData.length);
      } catch (error) {
        console.log('❌ [SCIENTIST] Error guardando farmers en cache:', error);
      }
    },

    // Cargar agricultores desde cache
    async loadCachedFarmers(forceRefresh = false) {
      try {
        const userId = user?.id;
        if (!userId) return [];

        const cachedData = await AsyncStorage.getItem(`cachedFarmers_${userId}`);

        if (cachedData && !forceRefresh) {
          const { data, expiresAt } = JSON.parse(cachedData);
          
          // Verificar si el cache expiró
          if (Date.now() > expiresAt) {
            console.log('⏰ [SCIENTIST] Cache de farmers expirado, eliminando...');
            await AsyncStorage.removeItem(`cachedFarmers_${userId}`);
            return [];
          }
          
          console.log('📁 [SCIENTIST] Agricultores cargados desde cache:', data.length);
          return data;
        }

        // Si no hay cache o está desactualizado, cargar del servidor
        if (isConnected && !forceRefresh) {
          const farmers = await this.getFarmers(userId);
          await this.cacheFarmersData(userId, farmers);
          return farmers;
        }

        return [];
      } catch (error) {
        console.log('❌ [SCIENTIST] Error cargando farmers desde cache:', error);
        return [];
      }
    },

    // Guardar datos de cultivos en cache
    async cacheCropsData(userId, cacheKey, cropsData) {
      try {
        const cacheData = {
          data: cropsData,
          timestamp: Date.now(),
          userId: userId,
          lastUpdated: new Date().toISOString(),
          expiresAt: Date.now() + (2 * 60 * 1000) // 2 minutos de expiración
        };
        await AsyncStorage.setItem(`cachedCrops_${userId}_${cacheKey}`, JSON.stringify(cacheData));
        console.log('💾 [SCIENTIST] Datos de cultivos guardados en cache:', cropsData.length);
      } catch (error) {
        console.log('❌ [SCIENTIST] Error guardando cultivos en cache:', error);
      }
    },

    // Cargar cultivos desde cache
    async loadCachedCrops(userId, cacheKey) {
      try {
        const cachedData = await AsyncStorage.getItem(`cachedCrops_${userId}_${cacheKey}`);
        
        if (cachedData) {
          const { data, expiresAt } = JSON.parse(cachedData);
          
          // Verificar si el cache expiró
          if (Date.now() > expiresAt) {
            console.log('⏰ [SCIENTIST] Cache de cultivos expirado, eliminando...');
            await AsyncStorage.removeItem(`cachedCrops_${userId}_${cacheKey}`);
            return [];
          }
          
          return data;
        }
        
        return [];
      } catch (error) {
        console.log('❌ [SCIENTIST] Error cargando cultivos desde cache:', error);
        return [];
      }
    },

    // Cargar cultivos desde cache (versión anterior para compatibilidad)
    async loadCachedCropsScientist(forceRefresh = false) {
      try {
        const cachedData = await AsyncStorage.getItem('cachedCropsScientist');

        if (cachedData && !forceRefresh) {
          const { data, timestamp, userId } = JSON.parse(cachedData);

          const isCurrentUser = user && user.id === userId;
          const isStale = Date.now() - timestamp > 300000;

          if (isCurrentUser && !isStale) {
            console.log('📁 Cultivos cargados desde cache:', data.length);
            return data;
          }
        }

        return [];
      } catch (error) {
        console.log('❌ Error cargando cultivos desde cache:', error);
        return [];
      }
    }
  };

  /* ---------------- NUEVAS FUNCIONES PARA FARMER SERVICE ---------------- */

  // 🔥 NUEVAS FUNCIONES PARA FARMER SERVICE
  const farmerService = {
    // ✅ Validar y limpiar cache contra el servidor
    async validateAndCleanCache(userId) {
      try {
        console.log('🧹 [FARMER] Validando cache contra servidor...');
        
        const isConnected = await checkConnection();
        if (!isConnected) {
          console.log('📴 [FARMER] Sin conexión, omitiendo validación');
          return;
        }

        // Obtener datos del servidor
        const serverCrops = await this.getCrops(userId);
        const serverCropIds = new Set(serverCrops.map(c => c._id));

        // Limpiar cache de cultivos
        const cachedCrops = await this.loadCachedCrops(userId);
        const validCrops = cachedCrops.filter(c => serverCropIds.has(c._id));
        
        if (validCrops.length !== cachedCrops.length) {
          console.log(`🗑️ [FARMER] Eliminando ${cachedCrops.length - validCrops.length} cultivos del cache`);
          await this.cacheCropsData(userId, validCrops);
        }

        console.log('✅ [FARMER] Validación completada');
        
      } catch (error) {
        console.log('❌ [FARMER] Error en validación:', error);
      }
    },

    // ✅ Obtener cultivos con cache
    async getCropsWithCache(userId, forceRefresh = false) {
      try {
        const isConnected = await checkConnection();
        
        // Si hay conexión, siempre validar cache
        if (isConnected) {
          console.log('🔄 [FARMER] Conexión disponible, obteniendo datos frescos...');
          const crops = await this.getCrops(userId);
          
          // Guardar en cache
          await this.cacheCropsData(userId, crops);
          
          return crops;
        } else {
          // Sin conexión, usar cache
          console.log('📴 [FARMER] Sin conexión, usando cache');
          const cachedCrops = await this.loadCachedCrops(userId);
          return cachedCrops;
        }
      } catch (error) {
        console.log('❌ [FARMER] Error en getCropsWithCache:', error);
        
        // Fallback a cache
        const cachedCrops = await this.loadCachedCrops(userId);
        return cachedCrops;
      }
    },

    // ✅ Forzar refresh completo
    async forceRefreshAllData(userId) {
      try {
        console.log('🔄 [FARMER] Forzando refresh completo de datos...');
        
        // Limpiar cache existente
        await this.clearAllUserCache(userId);
        
        // Obtener datos frescos del servidor
        const crops = await this.getCrops(userId);
        await this.cacheCropsData(userId, crops);
        
        console.log('✅ [FARMER] Refresh completo finalizado');
        return { success: true, crops: crops.length };
        
      } catch (error) {
        console.log('❌ [FARMER] Error en refresh completo:', error);
        throw error;
      }
    },

    // ✅ Limpiar todo el cache de un usuario
    async clearAllUserCache(userId) {
      try {
        console.log('🧹 [FARMER] Limpiando todo el cache del usuario...');
        
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter(key => 
          key.includes(`cachedCrops_${userId}`)
        );

        await AsyncStorage.multiRemove(userKeys);
        
        console.log(`✅ [FARMER] ${userKeys.length} entradas eliminadas del cache`);
        
      } catch (error) {
        console.log('❌ [FARMER] Error limpiando cache:', error);
      }
    },

    // ✅ Guardar datos de cultivos en cache
    async cacheCropsData(userId, cropsData) {
      try {
        const cacheData = {
          data: cropsData,
          timestamp: Date.now(),
          userId: userId,
          lastUpdated: new Date().toISOString(),
          expiresAt: Date.now() + (2 * 60 * 1000) // 2 minutos de expiración
        };
        await AsyncStorage.setItem(`cachedCrops_${userId}`, JSON.stringify(cacheData));
        console.log('💾 [FARMER] Cultivos guardados en cache:', cropsData.length);
      } catch (error) {
        console.log('❌ [FARMER] Error guardando cultivos en cache:', error);
      }
    },

    // ✅ Cargar cultivos desde cache
    async loadCachedCrops(userId) {
      try {
        const cachedData = await AsyncStorage.getItem(`cachedCrops_${userId}`);
        
        if (cachedData) {
          const { data, expiresAt } = JSON.parse(cachedData);
          
          // Verificar si el cache expiró
          if (Date.now() > expiresAt) {
            console.log('⏰ [FARMER] Cache de cultivos expirado, eliminando...');
            await AsyncStorage.removeItem(`cachedCrops_${userId}`);
            return [];
          }
          
          return data;
        }
        
        return [];
      } catch (error) {
        console.log('❌ [FARMER] Error cargando cultivos desde cache:', error);
        return [];
      }
    },

    // ✅ Función auxiliar para obtener cultivos del servidor
    async getCrops(userId) {
      return await getUserCrops(false);
    }
  };

  /* -------------------- VALUE DEL CONTEXTO ----------------------- */

  const value = {
    // Estado
    isConnected,
    isSyncing,
    user,
    syncProgress,
    serverStatus,
    pendingSyncCount,
    lastSync,
    API_BASE_URL,
    cachedCrops,

    // Funciones principales
    loadUser,
    saveUser,
    logout,
    getUserCrops,
    saveCropLocal,
    syncPendingData,
    checkPendingSync,
    deleteLocalCrop,
    getLocalCrops,
    generateActionDescription,
    formatLastSync,
    cacheUserCrops,
    loadCachedCrops,
    refreshCache,
    cleanDeletedCropsFromCache,
    repairLocalData,
    markCropAsSynced,
    updateLastSync,
    loadLastSync,

    // ✅ Nueva función de validación de cache
    validateCacheWithServer,

    // Servicios para scientist
    scientistService: {
      ...scientistService,
      validateAndCleanCache: scientistService.validateAndCleanCache,
      clearAllUserCache: scientistService.clearAllUserCache,
      forceRefreshAllData: scientistService.forceRefreshAllData
    },

    // ✅ NUEVO: Servicios para farmer
   farmerService: {
  validateAndCleanCache: farmerService.validateAndCleanCache,
  getCropsWithCache: farmerService.getCropsWithCache,
  forceRefreshAllData: farmerService.forceRefreshAllData,
  clearAllUserCache: farmerService.clearAllUserCache,
  cacheCropsData: farmerService.cacheCropsData,
  loadCachedCrops: farmerService.loadCachedCrops,
  getCrops: farmerService.getCrops,
  getCropDetails: farmerService.getCropDetails,
  getRecommendations: farmerService.getRecommendations,
  getSensorData: farmerService.getSensorData,
  getStats: farmerService.getStats,
  sendSensorData: farmerService.sendSensorData,
  getAllOfflineData: farmerService.getAllOfflineData,
  cacheRecommendations: farmerService.cacheRecommendations,
  getCachedRecommendations: farmerService.getCachedRecommendations,
  formatDate: farmerService.formatDate,
  getDaysFromDate: farmerService.getDaysFromDate
},
    // Funciones individuales para compatibilidad
    loadCachedFarmers: scientistService.loadCachedFarmers,
    cacheFarmersData: scientistService.cacheFarmersData,
    loadCachedCropsScientist: scientistService.loadCachedCropsScientist,
    cacheCropsData: scientistService.cacheCropsData
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export default SyncContext;