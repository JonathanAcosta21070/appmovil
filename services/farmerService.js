// services/farmerService.js - SERVICIO COMPLETO PARA FARMER CON CACHE ROBUSTO
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';
import NetInfo from '@react-native-community/netinfo';

const API_BASE_URL = API_CONFIG.API_BASE_URL;

// Función para verificar conexión
const checkConnection = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected;
};

// Función para fetch con timeout
const fetchWithTimeout = (url, options = {}, timeout = 15000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: La solicitud tardó demasiado tiempo')), timeout)
    )
  ]);
};

// Función para manejar errores de respuesta
const handleResponse = async (response) => {
  console.log('🔍 [FARMER] Response status:', response.status, response.statusText);
  
  if (!response.ok) {
    let errorMessage = `Error ${response.status}: `;
    
    try {
      const errorText = await response.text();
      console.log('❌ [FARMER] Error response body:', errorText);
      
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage += errorText;
        }
      } else {
        errorMessage += response.statusText || 'Error del servidor';
      }
    } catch (textError) {
      errorMessage += response.statusText || 'Error al leer respuesta del servidor';
    }
    
    throw new Error(errorMessage);
  }
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      const text = await response.text();
      console.log('📄 [FARMER] Non-JSON response:', text);
      return { success: true, message: text };
    }
  } catch (parseError) {
    console.log('⚠️ [FARMER] Error parsing response:', parseError);
    return { success: true, message: 'Operación completada' };
  }
};

export const farmerService = {
  // Variable para estado de conexión
  isConnected: true,

  // Inicializar verificación de conexión
  async initConnectionListener() {
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected;
      console.log('📶 FarmerService - Estado conexión:', state.isConnected ? 'Conectado' : 'Desconectado');
    });
  },

  // ========== SISTEMA DE CACHE MEJORADO CON VALIDACIÓN ==========

  // ✅ Validar y limpiar cache contra el servidor
  async validateAndCleanCache(userId) {
    try {
      console.log('🧹 [FARMER-CACHE] Validando cache contra servidor...');
      
      const isConnected = await checkConnection();
      if (!isConnected) {
        console.log('📴 [FARMER-CACHE] Sin conexión, omitiendo validación');
        return;
      }

      // Obtener datos del servidor
      const serverCrops = await this.getCrops(userId);
      const serverCropIds = new Set(serverCrops.map(c => c._id));

      // Limpiar cache de cultivos
      const cachedCrops = await this.loadCachedCrops(userId);
      const validCrops = cachedCrops.filter(c => serverCropIds.has(c._id));
      
      if (validCrops.length !== cachedCrops.length) {
        console.log(`🗑️ [FARMER-CACHE] Eliminando ${cachedCrops.length - validCrops.length} cultivos del cache`);
        await this.cacheCropsData(userId, validCrops);
      }

      console.log('✅ [FARMER-CACHE] Validación completada');
      
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error en validación:', error);
    }
  },

  // ✅ Obtener cultivos con cache
  async getCropsWithCache(userId, forceRefresh = false) {
    try {
      const isConnected = await checkConnection();
      
      // Si hay conexión, siempre validar cache
      if (isConnected) {
        console.log('🔄 [FARMER-CACHE] Conexión disponible, obteniendo datos frescos...');
        const crops = await this.getCrops(userId);
        
        // Guardar en cache
        await this.cacheCropsData(userId, crops);
        
        return crops;
      } else {
        // Sin conexión, usar cache
        console.log('📴 [FARMER-CACHE] Sin conexión, usando cache');
        const cachedCrops = await this.loadCachedCrops(userId);
        return cachedCrops;
      }
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error en getCropsWithCache:', error);
      
      // Fallback a cache
      const cachedCrops = await this.loadCachedCrops(userId);
      return cachedCrops;
    }
  },

  // ✅ Forzar refresh completo
  async forceRefreshAllData(userId) {
    try {
      console.log('🔄 [FARMER-CACHE] Forzando refresh completo de datos...');
      
      // Limpiar cache existente
      await this.clearAllUserCache(userId);
      
      // Obtener datos frescos del servidor
      const crops = await this.getCrops(userId);
      await this.cacheCropsData(userId, crops);
      
      console.log('✅ [FARMER-CACHE] Refresh completo finalizado');
      return { success: true, crops: crops.length };
      
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error en refresh completo:', error);
      throw error;
    }
  },

  // ✅ Limpiar todo el cache de un usuario
  async clearAllUserCache(userId) {
    try {
      console.log('🧹 [FARMER-CACHE] Limpiando todo el cache del usuario...');
      
      const allKeys = await AsyncStorage.getAllKeys();
      const userKeys = allKeys.filter(key => 
        key.includes(`cachedCrops_${userId}`)
      );

      await AsyncStorage.multiRemove(userKeys);
      
      console.log(`✅ [FARMER-CACHE] ${userKeys.length} entradas eliminadas del cache`);
      
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error limpiando cache:', error);
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
      console.log('💾 [FARMER-CACHE] Cultivos guardados en cache:', cropsData.length);
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error guardando cultivos en cache:', error);
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
          console.log('⏰ [FARMER-CACHE] Cache de cultivos expirado, eliminando...');
          await AsyncStorage.removeItem(`cachedCrops_${userId}`);
          return [];
        }
        
        return data;
      }
      
      return [];
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error cargando cultivos desde cache:', error);
      return [];
    }
  },

  // ========== FUNCIONES ORIGINALES DEL SERVICIO ==========

  // Obtener cultivos del agricultor
  async getCrops(userId) {
    try {
      console.log('🔍 [FARMER] Obteniendo cultivos para agricultor:', userId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/farmer/crops`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [FARMER] Cultivos obtenidos:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [FARMER] Error en getCrops:', error);
      throw new Error(error.message || 'Error al cargar la lista de cultivos');
    }
  },

  // Obtener detalles de un cultivo
  async getCropDetails(userId, cropId) {
    try {
      console.log('🔍 [FARMER] Obteniendo detalles del cultivo:', cropId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/farmer/crops/${cropId}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [FARMER] Detalles del cultivo obtenidos:', data.crop);
      return data;
      
    } catch (error) {
      console.log('❌ [FARMER] Error en getCropDetails:', error);
      
      // Si hay error 404, retornar datos básicos
      if (error.message.includes('404')) {
        console.log('⚠️ [FARMER] Cultivo no encontrado, retornando datos básicos');
        return {
          _id: cropId,
          crop: 'Cultivo',
          location: 'Ubicación no disponible',
          status: 'Activo',
          sowingDate: new Date().toISOString()
        };
      }
      
      throw new Error(error.message || 'Error al cargar los detalles del cultivo');
    }
  },

  // Obtener recomendaciones para el agricultor
  async getRecommendations(userId) {
    try {
      console.log('🔍 [FARMER] Obteniendo recomendaciones para:', userId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/farmer/alerts`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [FARMER] Recomendaciones obtenidas:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [FARMER] Error en getRecommendations:', error);
      
      // Retornar array vacío si hay error
      if (error.message.includes('404') || error.message.includes('No se encontraron recomendaciones')) {
        console.log('⚠️ [FARMER] No se encontraron recomendaciones, retornando array vacío');
        return [];
      }
      
      throw new Error(error.message || 'Error al cargar las recomendaciones');
    }
  },

  // Obtener datos de sensor
  async getSensorData(userId, cropId = null) {
    try {
      console.log('🔍 [FARMER] Obteniendo datos de sensor para:', cropId || 'todos los cultivos');
      
      const url = cropId 
        ? `${API_BASE_URL}/farmer/crops/${cropId}/sensor-data`
        : `${API_BASE_URL}/farmer/sensor-data`;
      
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [FARMER] Datos de sensor obtenidos:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [FARMER] Error en getSensorData:', error);
      
      // Retornar array vacío si hay error
      if (error.message.includes('404') || error.message.includes('No se encontraron datos')) {
        console.log('⚠️ [FARMER] No se encontraron datos de sensor, retornando array vacío');
        return [];
      }
      
      throw new Error(error.message || 'Error al cargar los datos del sensor');
    }
  },

  // Obtener estadísticas del agricultor
  async getStats(userId) {
    try {
      console.log('📊 [FARMER] Obteniendo estadísticas para:', userId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/farmer/stats`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [FARMER] Estadísticas obtenidas');
      return data;
      
    } catch (error) {
      console.log('❌ [FARMER] Error en getStats:', error);
      
      // Retornar estadísticas vacías en caso de error
      return {
        totalCrops: 0,
        activeCrops: 0,
        harvestedCrops: 0,
        pendingActions: 0,
        lastUpdated: new Date()
      };
    }
  },

  // Enviar datos de sensor (simulación)
  async sendSensorData(userId, sensorData) {
    try {
      console.log('📤 [FARMER] Enviando datos de sensor...');
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/farmer/sensor-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': userId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sensorData),
        }
      );

      const result = await handleResponse(response);
      console.log('✅ [FARMER] Datos de sensor enviados exitosamente');
      return result;

    } catch (error) {
      console.log('❌ [FARMER] Error en sendSensorData:', error);
      throw new Error(error.message || 'Error al enviar los datos del sensor');
    }
  },

  // Obtener todos los datos offline de una vez
  async getAllOfflineData(userId) {
    try {
      console.log('📁 [FARMER-CACHE] Cargando todos los datos offline...');
      
      const crops = await this.loadCachedCrops(userId);
      const recommendations = await this.getCachedRecommendations(userId);

      console.log('✅ [FARMER-CACHE] Datos offline cargados:', {
        crops: crops.length,
        recommendations: recommendations.length
      });

      return {
        crops,
        recommendations,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error cargando datos offline:', error);
      return { crops: [], recommendations: [], lastUpdated: null };
    }
  },

  // Cache de recomendaciones
  async cacheRecommendations(userId, recommendationsData) {
    try {
      const cacheData = {
        data: recommendationsData,
        timestamp: Date.now(),
        userId: userId,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem(`cachedRecommendations_${userId}`, JSON.stringify(cacheData));
      console.log('💾 [FARMER-CACHE] Recomendaciones guardadas en cache:', recommendationsData.length);
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error guardando recomendaciones en cache:', error);
    }
  },

  async getCachedRecommendations(userId) {
    try {
      const cachedData = await AsyncStorage.getItem(`cachedRecommendations_${userId}`);
      
      if (cachedData) {
        const { data } = JSON.parse(cachedData);
        return data;
      }
      
      return [];
    } catch (error) {
      console.log('❌ [FARMER-CACHE] Error cargando recomendaciones desde cache:', error);
      return [];
    }
  },

  // Método utilitario para formatear fechas
  formatDate(dateString) {
    if (!dateString) return 'No disponible';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  },

  // Método utilitario para calcular días desde una fecha
  getDaysFromDate(dateString) {
    if (!dateString) return 0;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return 0;
    }
  }
};

// Inicializar el listener de conexión al cargar el módulo
farmerService.initConnectionListener().catch(console.error);