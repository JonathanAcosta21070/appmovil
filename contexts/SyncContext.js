// contexts/SyncContext.js - VERSIÓN CON SINCRONIZACIÓN MANUAL
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import API_CONFIG from '../config/api'; // ✅ Solo aquí importamos la configuración


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

  // ✅ Obtener la URL de la configuración central
  const API_BASE_URL = API_CONFIG.API_BASE_URL;

  useEffect(() => {
    // Verificar conexión a internet
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      console.log('📶 Estado conexión:', state.isConnected ? 'Conectado' : 'Desconectado');
    });

    // Cargar usuario guardado
    loadUser();
    // Verificar datos pendientes
    checkPendingSync();
    // Cargar última sincronización
    loadLastSync();

    return () => unsubscribe();
  }, []);

  // 🔍 CARGAR USUARIO
// 🔍 CARGAR USUARIO - VERIFICAR
const loadUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    console.log('📥 Datos de usuario crudos:', userData);
    
    if (userData) {
      const userObj = JSON.parse(userData);
      console.log('👤 Usuario parseado:', userObj);
      console.log('🔐 User ID cargado:', userObj.id);
      
      setUser(userObj);
    }
  } catch (error) {
    console.log('❌ Error cargando usuario:', error);
  }
};

  // 💾 GUARDAR USUARIO
// 💾 GUARDAR USUARIO - VERIFICAR
const saveUser = async (userData) => {
  try {
    console.log('💾 Guardando usuario:', userData);
    console.log('🔐 User ID a guardar:', userData.id);
    
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    console.log('✅ Usuario guardado correctamente');
  } catch (error) {
    console.log('❌ Error guardando usuario:', error);
  }
};

  // 🚪 CERRAR SESIÓN
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('localCrops');
      await AsyncStorage.removeItem('lastSync');
      setUser(null);
      setPendingSyncCount(0);
      setLastSync(null);
      console.log('🚪 Usuario cerró sesión - Datos limpiados');
    } catch (error) {
      console.log('❌ Error en logout:', error);
    }
  };

  // 🔄 OBTENER CULTIVOS (CON FALLBACK OFFLINE) - VERSIÓN CORREGIDA
// 🔄 OBTENER CULTIVOS - VERSIÓN CORREGIDA
// 🔄 OBTENER CULTIVOS - VERSIÓN CORREGIDA
const getUserCrops = async () => {
  try {
    console.log('🔍 DEBUG: Iniciando getUserCrops');
    console.log('👤 User ID:', user?.id);
    console.log('🔗 API_BASE_URL:', API_BASE_URL);

    // Siempre obtener datos locales primero
    const localCrops = await getLocalCrops();
    console.log('📁 Cultivos locales:', localCrops.length);

    if (!user?.id || !isConnected) {
      console.log('❌ No hay usuario o sin conexión');
      return localCrops;
    }

    console.log('🔄 Conectando al servidor...');
    
    // ✅ CORREGIR: Quitar el /api/ duplicado
    const url = `${API_BASE_URL}/farmer/crops`;
    console.log('🔗 URL CORREGIDA:', url);
    console.log('🔐 Authorization header:', user.id);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': user.id.toString(),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('📡 Status de respuesta:', response.status);
      console.log('📡 OK:', response.ok);
      
      if (response.ok) {
        const serverData = await response.json();
        console.log('✅ Datos del servidor recibidos:', serverData.length);
        
        const localUnsynced = localCrops.filter(crop => !crop.synced);
        const allData = [...serverData, ...localUnsynced];
        
        console.log('📊 Total datos combinados:', allData.length);
        return allData;
      } else {
        const errorText = await response.text();
        console.log('❌ Error del servidor:', response.status);
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

// 📁 OBTENER CULTIVOS LOCALES - FUNCIÓN FALTANTE
const getLocalCrops = async () => {
  try {
    const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
    const localCrops = JSON.parse(localCropsString);
    
    // Filtrar por usuario actual si existe
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

  // 💾 GUARDAR CULTIVO LOCAL (OFFLINE)
  const saveCropLocal = async (cropData) => {
  try {
    const cropToSave = {
      ...cropData,
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    const existingCrops = await getLocalCrops();
    existingCrops.push(cropToSave);
    
    await AsyncStorage.setItem('localCrops', JSON.stringify(existingCrops));
    
    // Actualizar contador
    await checkPendingSync();
    
    console.log('💾 Cultivo guardado localmente, ID:', cropToSave.id);
    
    return cropToSave;
  } catch (error) {
    console.log('❌ Error guardando localmente:', error);
    throw error;
  }
};

  // 🔄 GENERAR DESCRIPCIÓN DE ACCIÓN
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

  // 🔄 SINCRONIZAR DATOS PENDIENTES (SOLO MANUAL)
  const syncPendingData = async () => {
    if (!isConnected) {
      console.log('❌ No hay conexión para sincronizar');
      return { 
        success: false, 
        message: 'No hay conexión a internet' 
      };
    }

    if (!user) {
      console.log('❌ No hay usuario logueado');
      return { 
        success: false, 
        message: 'No hay usuario logueado' 
      };
    }

    if (isSyncing) {
      console.log('⏸️  Ya hay una sincronización en curso');
      return { 
        success: false, 
        message: 'Sincronización en curso' 
      };
    }

    setIsSyncing(true);
    setSyncProgress(0);
    console.log('🔄 Iniciando sincronización MANUAL de datos pendientes...');

    try {
      const localCrops = await getLocalCrops();
      const unsyncedCrops = localCrops.filter(crop => !crop.synced);
      
      if (unsyncedCrops.length === 0) {
        console.log('✅ No hay datos pendientes por sincronizar');
        // Actualizar última sincronización
        await updateLastSync();
        return { 
          success: true, 
          message: 'No hay datos pendientes por sincronizar', 
          synced: 0 
        };
      }

      console.log(`📤 Sincronizando ${unsyncedCrops.length} cultivos...`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < unsyncedCrops.length; i++) {
        const crop = unsyncedCrops[i];
        
        try {
          // Preparar datos para enviar (remover campos internos)
          const { id, _source, ...cropToSend } = crop;
          
          const response = await fetch(`${API_BASE_URL}/farmer/crops`, {
            method: 'POST',
            headers: {
                  'Content-Type': 'application/json',
                  'Authorization': user.id
              },
            body: JSON.stringify({
                  ...cropToSend,
                  synced: true
              })
           });

          if (response.ok) {
            // Marcar como sincronizado en local
            await markCropAsSynced(crop.id);
            successCount++;
            console.log(`✅ Cultivo ${crop.id} sincronizado`);
          } else {
            errorCount++;
            console.log(`❌ Error sincronizando cultivo ${crop.id} - Status: ${response.status}`);
          }
        } catch (error) {
          errorCount++;
          console.log(`❌ Error de red con cultivo ${crop.id}:`, error.message);
        }

        // Actualizar progreso
        setSyncProgress(((i + 1) / unsyncedCrops.length) * 100);
      }

      console.log(`📊 Sincronización manual completada: ${successCount} éxitos, ${errorCount} errores`);
      
      // Actualizar contador pendiente y última sincronización
      await checkPendingSync();
      await updateLastSync();

      return { 
        success: successCount > 0, 
        message: `Sincronización completada: ${successCount} exitosos, ${errorCount} errores`,
        synced: successCount,
        errors: errorCount
      };

    } catch (error) {
      console.log('❌ Error en sincronización manual:', error);
      return { 
        success: false, 
        message: 'Error en sincronización', 
        error: error.message 
      };
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  // ✅ MARCAR CULTIVO COMO SINCRONIZADO
  const markCropAsSynced = async (cropId) => {
    try {
      const localCrops = await getLocalCrops();
      const updatedCrops = localCrops.map(crop => 
        crop.id === cropId ? { ...crop, synced: true } : crop
      );
      
      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      console.log('✅ Cultivo marcado como sincronizado:', cropId);
    } catch (error) {
      console.log('❌ Error marcando cultivo como sincronizado:', error);
    }
  };

  // 🔍 VERIFICAR DATOS PENDIENTES
  const checkPendingSync = async () => {
    try {
      const localCrops = await getLocalCrops();
      const unsyncedCount = localCrops.filter(crop => !crop.synced).length;
      setPendingSyncCount(unsyncedCount);
      console.log(`📊 Datos pendientes de sincronizar: ${unsyncedCount}`);
      return unsyncedCount;
    } catch (error) {
      console.log('❌ Error verificando datos pendientes:', error);
      return 0;
    }
  };

  // 🗑️ ELIMINAR CULTIVO LOCAL
  const deleteLocalCrop = async (cropId) => {
    try {
      const localCrops = await getLocalCrops();
      const updatedCrops = localCrops.filter(crop => crop.id !== cropId);
      
      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      await checkPendingSync();
      
      console.log('🗑️ Cultivo local eliminado:', cropId);
      return true;
    } catch (error) {
      console.log('❌ Error eliminando cultivo local:', error);
      return false;
    }
  };

  // 💾 GUARDAR ÚLTIMA SINCRONIZACIÓN
  const updateLastSync = async () => {
    try {
      const now = new Date();
      setLastSync(now);
      await AsyncStorage.setItem('lastSync', now.toISOString());
      console.log('🕒 Última sincronización actualizada:', now.toLocaleString());
    } catch (error) {
      console.log('❌ Error guardando última sincronización:', error);
    }
  };

  // 🔍 CARGAR ÚLTIMA SINCRONIZACIÓN
  const loadLastSync = async () => {
    try {
      const lastSyncString = await AsyncStorage.getItem('lastSync');
      if (lastSyncString) {
        const lastSyncDate = new Date(lastSyncString);
        setLastSync(lastSyncDate);
        console.log('🕒 Última sincronización cargada:', lastSyncDate.toLocaleString());
      }
    } catch (error) {
      console.log('❌ Error cargando última sincronización:', error);
    }
  };

  // 🔍 FORMATEAR FECHA DE SINCRONIZACIÓN
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
    
    // Acciones
    saveUser,
    logout,
    getUserCrops,
    
    // 🔄 FUNCIONES DE SINCRONIZACIÓN OFFLINE (MANUAL)
    saveCropLocal,
    syncPendingData, // Solo manual
    checkPendingSync,
    deleteLocalCrop,
    getLocalCrops,
    generateActionDescription,
    formatLastSync
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export default SyncContext;