// contexts/SyncContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const SyncContext = createContext();

// 🔹 Configuración global
const GLOBAL_CONFIG = {
  API_BASE_URL: 'http://192.168.137.1:3000/api',
  SYNC_INTERVAL: 45000,
  TIMEOUT: 30000,
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export const SyncProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [user, setUser] = useState(null);

  const syncInProgress = useRef(false);
  const pendingSync = useRef(false);

  const { API_BASE_URL, SYNC_INTERVAL } = GLOBAL_CONFIG;

  // 🔹 Cargar usuario desde AsyncStorage
  const loadUser = async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        const userData = JSON.parse(userString);
        if (userData && userData.id && userData.email) {
          setUser(userData);
          console.log('👤 Usuario cargado desde AsyncStorage:', userData.email);
          return userData;
        } else {
          console.log('⚠️ Usuario inválido en AsyncStorage, limpiando...');
          await AsyncStorage.removeItem('user');
          setUser(null);
          return null;
        }
      }
    } catch (error) {
      console.log('❌ Error cargando usuario global:', error);
      await AsyncStorage.removeItem('user');
    }
    return null;
  };

  // 🔹 Actualizar usuario global (usado en login)
  const updateUser = async (newUser) => {
    setUser(newUser);
    await AsyncStorage.setItem('user', JSON.stringify(newUser));
  };

  // 🔹 Cerrar sesión global (usado en logout)
  const clearUser = async () => {
    console.log('🚪 Cerrando sesión global...');
    setUser(null);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('localActions');
    await AsyncStorage.removeItem('localCrops'); // 🔥 NUEVO: Limpiar cultivos locales
  };

  // 🔹 Verificar datos locales (ACTUALIZADO para cultivos)
  const checkLocalData = async () => {
    try {
      // Verificar acciones locales
      const localActionsString = (await AsyncStorage.getItem('localActions')) || '[]';
      const localActions = JSON.parse(localActionsString);
      const unsyncedActions = localActions.filter((action) => !action.synced);

      // 🔥 NUEVO: Verificar cultivos locales
      const localCropsString = (await AsyncStorage.getItem('localCrops')) || '[]';
      const localCrops = JSON.parse(localCropsString);
      const unsyncedCrops = localCrops.filter((crop) => !crop.synced);

      const totalUnsynced = unsyncedActions.length + unsyncedCrops.length;
      
      setUnsyncedCount(totalUnsynced);
      console.log('📊 Datos pendientes:', {
        acciones: unsyncedActions.length,
        cultivos: unsyncedCrops.length,
        total: totalUnsynced
      });
      
      return totalUnsynced;
    } catch (error) {
      console.log('❌ Error verificando datos globales:', error);
      return 0;
    }
  };

  // 🔹 Sincronizar cultivos locales con la nube (NUEVA FUNCIÓN)
  const syncLocalCropsToCloud = async () => {
    if (syncInProgress.current) {
      console.log('⏳ Sincronización ya en progreso, encolando...');
      pendingSync.current = true;
      return false;
    }

    const currentUser = await loadUser();
    if (!currentUser) {
      console.log('⚠️ No hay usuario para sincronización de cultivos');
      return false;
    }

    syncInProgress.current = true;
    setIsSyncing(true);

    console.log('🔄 Iniciando sincronización de cultivos...');

    try {
      const localCropsString = (await AsyncStorage.getItem('localCrops')) || '[]';
      const localCrops = JSON.parse(localCropsString);
      const unsyncedCrops = localCrops.filter(
        (crop) => !crop.synced && crop.userId === currentUser.id
      );

      console.log(`📊 ${unsyncedCrops.length} cultivos por sincronizar`);

      let syncedCount = 0;
      let errors = 0;

      for (const crop of unsyncedCrops) {
        try {
          console.log(`📤 Sincronizando cultivo ${crop.id}...`);
          
          const response = await fetch(`${API_BASE_URL}/crops`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: currentUser.id,
            },
            body: JSON.stringify(crop)
          });

          if (response.ok) {
            // Verificar si el cultivo ya fue sincronizado por otro proceso
            const currentLocalCropsString = (await AsyncStorage.getItem('localCrops')) || '[]';
            const currentLocalCrops = JSON.parse(currentLocalCropsString);
            const currentCrop = currentLocalCrops.find(c => c.id === crop.id);
            
            if (currentCrop && !currentCrop.synced) {
              // Marcar como sincronizado solo si aún no lo está
              const updatedCrops = currentLocalCrops.map(c => 
                c.id === crop.id ? { ...c, synced: true } : c
              );
              await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
              console.log('✅ Cultivo sincronizado:', crop.id);
              syncedCount++;
            } else {
              console.log('ℹ️ Cultivo ya sincronizado:', crop.id);
            }
          } else {
            console.log('❌ Error en respuesta del servidor:', response.status);
            errors++;
          }
        } catch (error) {
          console.log('❌ Error sincronizando cultivo:', error);
          errors++;
        }
      }

      if (syncedCount > 0) {
        console.log(`✅ ${syncedCount} cultivos sincronizados exitosamente`);
      }
      if (errors > 0) {
        console.log(`⚠️ ${errors} errores durante la sincronización`);
      }

      await checkLocalData();
      return syncedCount > 0;

    } catch (error) {
      console.log('❌ Error en sincronización de cultivos:', error);
      return false;
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
      
      if (pendingSync.current) {
        console.log('🔄 Ejecutando sincronización pendiente...');
        pendingSync.current = false;
        setTimeout(() => syncLocalCropsToCloud(), 1000);
      }
    }
  };

  // 🔹 Sincronizar acciones locales con la nube (FUNCIÓN EXISTENTE MEJORADA)
  const syncLocalActionsToCloud = async () => {
    if (syncInProgress.current) {
      console.log('⏳ Sincronización ya en progreso, encolando...');
      pendingSync.current = true;
      return false;
    }

    const currentUser = await loadUser();
    if (!currentUser) {
      console.log('⚠️ No hay usuario para sincronización global');
      return false;
    }

    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const localActionsString = (await AsyncStorage.getItem('localActions')) || '[]';
      const localActions = JSON.parse(localActionsString);
      const unsyncedActions = localActions.filter(
        (action) => !action.synced && action.userId === currentUser.id
      );

      console.log(`📊 ${unsyncedActions.length} acciones por sincronizar`);

      let syncedCount = 0;
      let errors = 0;

      for (const action of unsyncedActions) {
        try {
          console.log(`📤 Sincronizando acción ${action.id}...`);
          
          const response = await fetch(`${API_BASE_URL}/actions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: currentUser.id,
            },
            body: JSON.stringify({ ...action, userId: currentUser.id })
          });

          if (response.ok) {
            const currentLocalActionsString = (await AsyncStorage.getItem('localActions')) || '[]';
            const currentLocalActions = JSON.parse(currentLocalActionsString);
            const currentAction = currentLocalActions.find(a => a.id === action.id);
            
            if (currentAction && !currentAction.synced) {
              const updatedActions = currentLocalActions.map(a => 
                a.id === action.id ? { ...a, synced: true } : a
              );
              await AsyncStorage.setItem('localActions', JSON.stringify(updatedActions));
              console.log('✅ Acción sincronizada:', action.id);
              syncedCount++;
            } else {
              console.log('ℹ️ Acción ya sincronizada:', action.id);
            }
          } else {
            console.log('❌ Error en respuesta del servidor:', response.status);
            errors++;
          }
        } catch (error) {
          console.log('❌ Error sincronizando acción:', error);
          errors++;
        }
      }

      if (syncedCount > 0) {
        console.log(`✅ ${syncedCount} acciones sincronizadas exitosamente`);
      }
      if (errors > 0) {
        console.log(`⚠️ ${errors} errores durante la sincronización`);
      }

      await checkLocalData();
      return syncedCount > 0;

    } catch (error) {
      console.log('❌ Error en sincronización global:', error);
      return false;
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);

      if (pendingSync.current) {
        console.log('🔄 Ejecutando sincronización pendiente...');
        pendingSync.current = false;
        setTimeout(() => syncLocalActionsToCloud(), 1000);
      }
    }
  };

  // 🔹 Sincronización completa (NUEVA FUNCIÓN)
  const syncAllLocalData = async () => {
    console.log('🔄 Iniciando sincronización completa...');
    
    const cropsSynced = await syncLocalCropsToCloud();
    const actionsSynced = await syncLocalActionsToCloud();
    
    const anySynced = cropsSynced || actionsSynced;
    
    if (anySynced) {
      console.log('✅ Sincronización completa finalizada');
    } else {
      console.log('ℹ️ No hay datos pendientes por sincronizar');
    }
    
    return anySynced;
  };

  // 🔹 Sincronización controlada
  const performSync = async () => {
    if (isConnected && unsyncedCount > 0 && !syncInProgress.current) {
      console.log('🔄 Ejecutando sincronización controlada...');
      await syncAllLocalData();
    }
  };

  // 🔹 Obtener cultivos del usuario (NUEVA FUNCIÓN)
  const getUserCrops = async () => {
    try {
      if (!user?.id) {
        console.log('⚠️ No hay usuario para obtener cultivos');
        return [];
      }

      let cloudCrops = [];
      
      // Obtener cultivos de la nube
      if (isConnected) {
        try {
          const response = await fetch(`${API_BASE_URL}/crops`, {
            headers: { 
              'Authorization': user.id 
            }
          });
          
          if (response.ok) {
            cloudCrops = await response.json();
            console.log('☁️ Cultivos cargados desde MongoDB:', cloudCrops.length);
          }
        } catch (error) {
          console.log('❌ Error cargando cultivos de la nube:', error);
        }
      }

      // Obtener cultivos locales
      const localCropsString = (await AsyncStorage.getItem('localCrops')) || '[]';
      const localCrops = JSON.parse(localCropsString);
      const userLocalCrops = localCrops.filter(crop => 
        crop.userId === user.id && !crop.synced
      );
      
      console.log('💾 Cultivos locales no sincronizados:', userLocalCrops.length);

      // Combinar resultados
      const allCrops = [...cloudCrops, ...userLocalCrops];
      console.log('📊 Total de cultivos:', allCrops.length);
      
      return allCrops;
    } catch (error) {
      console.log('❌ Error obteniendo cultivos:', error);
      return [];
    }
  };

  // 🔹 Listener de conexión
  useEffect(() => {
    loadUser();
    checkLocalData();

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const connected = state.isConnected;
      const previousState = isConnected;
      setIsConnected(connected);

      console.log(
        `🌐 Cambio de conexión: ${previousState ? 'ONLINE' : 'OFFLINE'} → ${
          connected ? 'ONLINE' : 'OFFLINE'
        }`
      );

      if (connected && !previousState) {
        console.log('🔄 Conexión restaurada - programando sincronización...');
        setTimeout(async () => {
          await performSync();
        }, 3000);
      }
    });

    return () => unsubscribe();
  }, []);

  // 🔹 Sincronización periódica
  useEffect(() => {
    if (!isConnected || unsyncedCount === 0 || syncInProgress.current) return;

    const interval = setInterval(async () => {
      if (!syncInProgress.current && unsyncedCount > 0) {
        console.log('⏰ Sincronización periódica iniciada...');
        await performSync();
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, unsyncedCount]);

  const value = {
    // Estado
    isConnected,
    isSyncing,
    unsyncedCount,
    user,
    
    // Usuario
    updateUser,
    clearUser,
    loadUser,
    
    // Sincronización
    syncLocalDataToCloud: syncAllLocalData, // 🔄 Ahora sincroniza todo
    syncLocalCropsToCloud, // 🔥 NUEVO: Sincronizar solo cultivos
    syncLocalActionsToCloud, // 🔥 NUEVO: Sincronizar solo acciones
    checkLocalData,
    performSync,
    
    // Cultivos
    getUserCrops, // 🔥 NUEVO: Obtener cultivos del usuario
    
    // Configuración
    API_BASE_URL,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};