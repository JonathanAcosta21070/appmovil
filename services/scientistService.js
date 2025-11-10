// services/scientistService.js - VERSIÓN COMPLETA CON CACHE OFFLINE
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
  console.log('🔍 Response status:', response.status, response.statusText);
  
  if (!response.ok) {
    let errorMessage = `Error ${response.status}: `;
    
    try {
      const errorText = await response.text();
      console.log('❌ Error response body:', errorText);
      
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
      console.log('📄 Non-JSON response:', text);
      return { success: true, message: text };
    }
  } catch (parseError) {
    console.log('⚠️ Error parsing response:', parseError);
    return { success: true, message: 'Operación completada' };
  }
};

export const scientistService = {
  // Variable para estado de conexión
  isConnected: true,

  // Inicializar verificación de conexión
  async initConnectionListener() {
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected;
      console.log('📶 ScientistService - Estado conexión:', state.isConnected ? 'Conectado' : 'Desconectado');
    });
  },

  // ========== FUNCIONES DE CACHE OFFLINE ==========

  // Función para obtener agricultores con soporte offline
  async getFarmersWithCache(userId, forceRefresh = false) {
    try {
      // Primero intentar cargar desde cache si no se fuerza refresh
      if (!forceRefresh) {
        const cachedFarmers = await this.loadCachedFarmers(userId);
        if (cachedFarmers.length > 0) {
          console.log('📁 [CACHE] Usando agricultores en cache:', cachedFarmers.length);
          return cachedFarmers;
        }
      }

      // Si no hay cache o se fuerza refresh, cargar del servidor
      const isConnected = await checkConnection();
      if (isConnected) {
        console.log('🔄 [CACHE] Cargando agricultores desde servidor...');
        const farmers = await this.getFarmers(userId);
        
        // Guardar en cache
        await this.cacheFarmersData(userId, farmers);
        
        return farmers;
      } else {
        console.log('📴 [CACHE] Sin conexión, usando cache disponible');
        const cachedFarmers = await this.loadCachedFarmers(userId);
        return cachedFarmers;
      }
    } catch (error) {
      console.log('❌ [CACHE] Error en getFarmersWithCache:', error);
      
      // En caso de error, retornar cache si existe
      const cachedFarmers = await this.loadCachedFarmers(userId);
      return cachedFarmers;
    }
  },

  // Función para obtener cultivos con soporte offline
  async getFarmerCropsWithCache(userId, farmerId, forceRefresh = false) {
    try {
      const cacheKey = `crops_${farmerId}`;
      
      if (!forceRefresh) {
        const cachedCrops = await this.loadCachedCrops(userId, cacheKey);
        if (cachedCrops.length > 0) {
          console.log('📁 [CACHE] Usando cultivos en cache para farmer:', farmerId, cachedCrops.length);
          return cachedCrops;
        }
      }

      const isConnected = await checkConnection();
      if (isConnected) {
        console.log('🔄 [CACHE] Cargando cultivos desde servidor para farmer:', farmerId);
        const crops = await this.getFarmerCrops(userId, farmerId);
        
        await this.cacheCropsData(userId, cacheKey, crops);
        
        return crops;
      } else {
        console.log('📴 [CACHE] Sin conexión, usando cache de cultivos');
        const cachedCrops = await this.loadCachedCrops(userId, cacheKey);
        return cachedCrops;
      }
    } catch (error) {
      console.log('❌ [CACHE] Error en getFarmerCropsWithCache:', error);
      
      const cachedCrops = await this.loadCachedCrops(userId, `crops_${farmerId}`);
      return cachedCrops;
    }
  },

  // Funciones de cache para agricultores
  async cacheFarmersData(userId, farmersData) {
    try {
      const cacheData = {
        data: farmersData,
        timestamp: Date.now(),
        userId: userId,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem(`cachedFarmers_${userId}`, JSON.stringify(cacheData));
      console.log('💾 [CACHE] Farmers guardados en cache:', farmersData.length);
    } catch (error) {
      console.log('❌ [CACHE] Error guardando farmers en cache:', error);
    }
  },

  async loadCachedFarmers(userId) {
    try {
      const cachedData = await AsyncStorage.getItem(`cachedFarmers_${userId}`);
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const isStale = Date.now() - timestamp > 300000; // 5 minutos
        
        if (!isStale) {
          return data;
        } else {
          console.log('🕒 [CACHE] Cache de farmers está desactualizado');
        }
      }
      
      return [];
    } catch (error) {
      console.log('❌ [CACHE] Error cargando farmers desde cache:', error);
      return [];
    }
  },

  // Funciones de cache para cultivos
  async cacheCropsData(userId, cacheKey, cropsData) {
    try {
      const cacheData = {
        data: cropsData,
        timestamp: Date.now(),
        userId: userId,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem(`cachedCrops_${userId}_${cacheKey}`, JSON.stringify(cacheData));
      console.log('💾 [CACHE] Cultivos guardados en cache:', cropsData.length);
    } catch (error) {
      console.log('❌ [CACHE] Error guardando cultivos en cache:', error);
    }
  },

  async loadCachedCrops(userId, cacheKey) {
    try {
      const cachedData = await AsyncStorage.getItem(`cachedCrops_${userId}_${cacheKey}`);
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const isStale = Date.now() - timestamp > 300000; // 5 minutos
        
        if (!isStale) {
          return data;
        } else {
          console.log('🕒 [CACHE] Cache de cultivos está desactualizado');
        }
      }
      
      return [];
    } catch (error) {
      console.log('❌ [CACHE] Error cargando cultivos desde cache:', error);
      return [];
    }
  },

  // Función para limpiar cache antiguo
  async clearOldCache(userId) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.includes(userId));
      
      const now = Date.now();
      const promises = userKeys.map(async (key) => {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const { timestamp } = JSON.parse(data);
            if (now - timestamp > 24 * 60 * 60 * 1000) { // 24 horas
              await AsyncStorage.removeItem(key);
              console.log('🧹 [CACHE] Cache limpiado:', key);
            }
          }
        } catch (error) {
          console.log('❌ [CACHE] Error limpiando cache:', key, error);
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.log('❌ [CACHE] Error en clearOldCache:', error);
    }
  },

  // Obtener todos los datos offline de una vez
  async getAllOfflineData(userId) {
    try {
      console.log('📁 [CACHE] Cargando todos los datos offline...');
      
      const farmers = await this.loadCachedFarmers(userId);
      const cropsData = {};

      // Cargar cultivos para cada agricultor
      for (const farmer of farmers) {
        const crops = await this.loadCachedCrops(userId, `crops_${farmer._id}`);
        cropsData[farmer._id] = crops;
      }

      console.log('✅ [CACHE] Datos offline cargados:', {
        farmers: farmers.length,
        crops: Object.keys(cropsData).length
      });

      return {
        farmers,
        crops: cropsData,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.log('❌ [CACHE] Error cargando datos offline:', error);
      return { farmers: [], crops: {}, lastUpdated: null };
    }
  },

  // ========== FUNCIONES ORIGINALES DEL SERVICIO ==========

  // Obtener agricultores asignados
  async getFarmers(userId) {
    try {
      console.log('🔍 [SERVICE] Obteniendo agricultores para científico:', userId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/farmers`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Agricultores obtenidos:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getFarmers:', error);
      throw new Error(error.message || 'Error al cargar la lista de agricultores');
    }
  },

  // Obtener detalles de un agricultor - CORREGIDO
  async getFarmerDetails(userId, farmerId) {
    try {
      console.log('🔍 [SERVICE] Obteniendo detalles del agricultor:', farmerId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/farmers/${farmerId}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Detalles del agricultor obtenidos:', data.name);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getFarmerDetails:', error);
      
      // Si hay error 404, retornar datos básicos
      if (error.message.includes('404')) {
        console.log('⚠️ [SERVICE] Agricultor no encontrado, retornando datos básicos');
        return {
          _id: farmerId,
          name: 'Agricultor',
          email: 'email@ejemplo.com',
          ubicacion: 'Ubicación no disponible',
          cultivo: 'Cultivo no especificado',
          fechaRegistro: new Date().toISOString()
        };
      }
      
      throw new Error(error.message || 'Error al cargar los detalles del agricultor');
    }
  },

  // Obtener cultivos de un agricultor
  async getFarmerCrops(userId, farmerId) {
    try {
      console.log('🔍 [SERVICE] Obteniendo cultivos del agricultor:', farmerId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/farmers/${farmerId}/crops`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Cultivos obtenidos:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getFarmerCrops:', error);
      
      // Si hay error, retornar array vacío en lugar de fallar
      if (error.message.includes('404') || error.message.includes('No se encontraron cultivos')) {
        console.log('⚠️ [SERVICE] No se encontraron cultivos, retornando array vacío');
        return [];
      }
      
      throw new Error(error.message || 'Error al cargar los cultivos del agricultor');
    }
  },

  // Obtener datos de sensor de un agricultor
  async getFarmerSensorData(userId, farmerId, limit = 50) {
    try {
      console.log('🔍 [SERVICE] Obteniendo datos de sensor para agricultor:', farmerId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/farmers/${farmerId}/sensor-data?limit=${limit}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Datos de sensor obtenidos:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getFarmerSensorData:', error);
      
      // Retornar datos vacíos si hay error
      if (error.message.includes('404') || error.message.includes('No se encontraron datos')) {
        console.log('⚠️ [SERVICE] No se encontraron datos de sensor, retornando array vacío');
        return [];
      }
      
      throw new Error(error.message || 'Error al cargar los datos del sensor');
    }
  },

  // Obtener detalles de un cultivo específico
  async getCropDetails(userId, cropId) {
    try {
      console.log('🔍 [SERVICE] Obteniendo detalles DEL CULTIVO:', cropId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/crops/${cropId}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Detalles del cultivo obtenidos:', data.crop);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getCropDetails:', error);
      
      // Si hay error 404, retornar null
      if (error.message.includes('404') || error.message.includes('No se encontró')) {
        console.log('⚠️ [SERVICE] Cultivo no encontrado');
        return null;
      }
      
      throw new Error(error.message || 'Error al cargar los detalles del cultivo');
    }
  },

  // Obtener datos de sensor de un cultivo específico
  async getCropSensorData(userId, cropId, limit = 50) {
    try {
      console.log('🔍 [SERVICE] Obteniendo datos de sensor para cultivo:', cropId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/crops/${cropId}/sensor-data?limit=${limit}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Datos de sensor del cultivo obtenidos:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getCropSensorData:', error);
      
      // Retornar array vacío si hay error
      if (error.message.includes('404') || error.message.includes('No se encontraron datos')) {
        console.log('⚠️ [SERVICE] No se encontraron datos de sensor para el cultivo, retornando array vacío');
        return [];
      }
      
      throw new Error(error.message || 'Error al cargar los datos del sensor del cultivo');
    }
  },

  // Obtener recomendaciones para un cultivo específico
  async getCropRecommendations(userId, cropId) {
    try {
      console.log('🔍 [SERVICE] Obteniendo recomendaciones para cultivo:', cropId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/crops/${cropId}/recommendations`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Recomendaciones del cultivo obtenidas:', data.length);
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getCropRecommendations:', error);
      
      // Retornar array vacío si hay error
      if (error.message.includes('404') || error.message.includes('No se encontraron recomendaciones')) {
        console.log('⚠️ [SERVICE] No se encontraron recomendaciones para el cultivo, retornando array vacío');
        return [];
      }
      
      throw new Error(error.message || 'Error al cargar las recomendaciones del cultivo');
    }
  },

  // 🔍 DEBUG ENDPOINT PARA CULTIVOS
  async debugCropData(userId, cropId) {
    try {
      console.log('🐛 [DEBUG] Solicitando datos de debug para cultivo:', cropId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/debug/crop/${cropId}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('🐛 [DEBUG] Datos completos obtenidos:', data.summary);
      return data;
      
    } catch (error) {
      console.log('❌ [DEBUG] Error en debugCropData:', error);
      throw new Error(error.message || 'Error en debug');
    }
  },

  // Enviar recomendación - VERSIÓN MEJORADA
  async sendRecommendation(userId, recommendationData) {
    try {
      console.log('📤 [SERVICE] Enviando recomendación...', {
        recommendationData: {
          farmerId: recommendationData.farmerId,
          cropId: recommendationData.cropId,
          recommendation: recommendationData.recommendation ? `${recommendationData.recommendation.substring(0, 50)}...` : 'empty',
          priority: recommendationData.priority
        }
      });

      // Validar datos requeridos
      const requiredFields = ['farmerId', 'recommendation', 'scientistId'];
      const missingFields = requiredFields.filter(field => !recommendationData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      }

      // Preparar datos para enviar
      const payload = {
        farmerId: recommendationData.farmerId,
        cropId: recommendationData.cropId || null,
        recommendation: recommendationData.recommendation.trim(),
        priority: recommendationData.priority || 'medium',
        scientistId: recommendationData.scientistId,
        scientistName: recommendationData.scientistName || 'Científico',
      };

      console.log('📦 [SERVICE] Payload a enviar:', payload);

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/recommendations`,
        {
          method: 'POST',
          headers: {
            'Authorization': userId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        20000 // 20 segundos timeout para esta operación
      );

      const result = await handleResponse(response);
      console.log('✅ [SERVICE] Recomendación enviada exitosamente:', result);
      return result;

    } catch (error) {
      console.log('❌ [SERVICE] Error completo en sendRecommendation:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Mejorar mensajes de error para el usuario
      let userMessage = error.message;
      
      if (error.message.includes('Network request failed')) {
        userMessage = 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.';
      } else if (error.message.includes('Timeout')) {
        userMessage = 'La solicitud está tardando demasiado. Verifica tu conexión e intenta nuevamente.';
      } else if (error.message.includes('401')) {
        userMessage = 'Sesión expirada. Por favor, vuelve a iniciar sesión.';
      } else if (error.message.includes('403')) {
        userMessage = 'No tienes permisos para enviar recomendaciones.';
      } else if (error.message.includes('404')) {
        userMessage = 'El servicio no está disponible en este momento.';
      } else if (error.message.includes('500')) {
        userMessage = 'Error del servidor. Por favor, intenta más tarde.';
      }
      
      throw new Error(userMessage);
    }
  },

  // Obtener estadísticas
  async getStats(userId, farmerId) {
    try {
      console.log('📊 [SERVICE] Obteniendo estadísticas para:', farmerId);
      
      // 🔥 VALIDACIÓN: Verificar que farmerId sea válido
      if (!farmerId || !farmerId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('❌ [SERVICE] farmerId inválido:', farmerId);
        throw new Error('ID de agricultor inválido');
      }
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/stats/${farmerId}`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Estadísticas obtenidas');
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getStats:', error);
      
      if (error.message.includes('ID de agricultor inválido')) {
        // Retornar estadísticas vacías para IDs inválidos
        return {
          farmer: { name: 'No disponible', location: 'No disponible', mainCrop: 'No disponible' },
          crops: { total: 0, active: 0, harvested: 0 },
          sensorData: { total: 0, avgMoisture: 0, avgTemperature: 0, needsWater: 0 },
          lastUpdated: new Date()
        };
      }
        
        throw new Error(error.message || 'Error al cargar las estadísticas');
      }
    },

    // Obtener datos recientes de sensores
    async getRecentSensorData(userId) {
      try {
        console.log('🔍 [SERVICE] Obteniendo datos recientes de sensores');
        
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/scientist/recent-sensor-data`,
          {
            method: 'GET',
            headers: { 
              'Authorization': userId,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = await handleResponse(response);
        console.log('✅ [SERVICE] Datos recientes obtenidos:', data.length);
        return data;
        
      } catch (error) {
        console.log('❌ [SERVICE] Error en getRecentSensorData:', error);
        
        // Retornar array vacío si hay error
        if (error.message.includes('404') || error.message.includes('No se encontraron datos')) {
          console.log('⚠️ [SERVICE] No se encontraron datos recientes, retornando array vacío');
          return [];
        }
        
        throw new Error(error.message || 'Error al cargar los datos recientes');
      }
    },

    // Obtener recomendaciones anteriores
    async getPreviousRecommendations(userId, farmerId) {
      try {
        console.log('🔍 [SERVICE] Obteniendo recomendaciones anteriores para:', farmerId);
        
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/scientist/recommendations/${farmerId}`,
          {
            method: 'GET',
            headers: { 
              'Authorization': userId,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = await handleResponse(response);
        console.log('✅ [SERVICE] Recomendaciones anteriores obtenidas:', data.length);
        return data;
        
      } catch (error) {
        console.log('❌ [SERVICE] Error en getPreviousRecommendations:', error);
        
        // Retornar array vacío si hay error
        if (error.message.includes('404') || error.message.includes('No se encontraron recomendaciones')) {
          console.log('⚠️ [SERVICE] No se encontraron recomendaciones anteriores, retornando array vacío');
          return [];
        }
        
        throw new Error(error.message || 'Error al cargar las recomendaciones anteriores');
      }
    },

    // Verificar estado del servicio
    async checkServiceStatus() {
      try {
        console.log('🔍 [SERVICE] Verificando estado del servicio...');
        
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/health`,
          {
            method: 'GET',
            timeout: 5000 // 5 segundos para health check
          }
        );

        const data = await handleResponse(response);
        console.log('✅ [SERVICE] Servicio funcionando correctamente');
        return { status: 'ok', ...data };
        
      } catch (error) {
        console.log('❌ [SERVICE] Error en checkServiceStatus:', error);
        return { 
          status: 'error', 
          message: error.message,
          online: false 
        };
      }
    },

    // Método adicional: Obtener todos los datos de un agricultor en una sola llamada
    async getFarmerCompleteData(userId, farmerId) {
      try {
        console.log('🔍 [SERVICE] Obteniendo datos completos del agricultor:', farmerId);
        
        const [farmer, crops, sensorData, recommendations] = await Promise.all([
          this.getFarmerDetails(userId, farmerId),
          this.getFarmerCrops(userId, farmerId),
          this.getFarmerSensorData(userId, farmerId),
          this.getPreviousRecommendations(userId, farmerId)
        ]);

        console.log('✅ [SERVICE] Datos completos del agricultor obtenidos:', {
          farmer: !!farmer,
          crops: crops.length,
          sensorData: sensorData.length,
          recommendations: recommendations.length
        });

        return {
          farmer,
          crops,
          sensorData,
          recommendations
        };
        
      } catch (error) {
        console.log('❌ [SERVICE] Error en getFarmerCompleteData:', error);
        throw new Error(error.message || 'Error al cargar los datos completos del agricultor');
      }
    },

    // Método adicional: Obtener todos los datos de un cultivo en una sola llamada
    async getCropCompleteData(userId, cropId) {
      try {
        console.log('🔍 [SERVICE] Obteniendo datos completos del cultivo:', cropId);
        
        const [crop, sensorData, recommendations] = await Promise.all([
          this.getCropDetails(userId, cropId),
          this.getCropSensorData(userId, cropId),
          this.getCropRecommendations(userId, cropId)
        ]);

        console.log('✅ [SERVICE] Datos completos del cultivo obtenidos:', {
          crop: !!crop,
          sensorData: sensorData.length,
          recommendations: recommendations.length
        });

        return {
          crop,
          sensorData,
          recommendations
        };
        
      } catch (error) {
        console.log('❌ [SERVICE] Error en getCropCompleteData:', error);
        throw new Error(error.message || 'Error al cargar los datos completos del cultivo');
      }
    },

  // 📊 MÉTODOS MEJORADOS PARA ESTADÍSTICAS
  async getFarmersRanking(userId) {
    try {
      console.log('🏆 [SERVICE] Obteniendo ranking de agricultores...');
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/stats/farmers/ranking`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo obtener el ranking`);
      }

      const data = await response.json();
      console.log('✅ [SERVICE] Ranking de agricultores obtenido:', data.length);
      
      // Si no hay datos, retornar array vacío
      return Array.isArray(data) ? data : [];
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getFarmersRanking:', error.message);
      
      // Retornar array vacío en caso de error
      return [];
    }
  },

  async getBiofertilizerStats(userId) {
    try {
      console.log('🧪 [SERVICE] Obteniendo estadísticas de biofertilizantes...');
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/stats/biofertilizers`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron obtener estadísticas`);
      }

      const data = await response.json();
      console.log('✅ [SERVICE] Estadísticas de biofertilizantes obtenidas:', data.length);
      
      // Si no hay datos, retornar array vacío
      return Array.isArray(data) ? data : [];
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getBiofertilizerStats:', error.message);
      
      // Retornar array vacío en caso de error
      return [];
    }
  },

  // 🔥 NUEVO MÉTODO: Obtener estadísticas simples
  async getSimpleStats(userId) {
    try {
      console.log('📊 [SERVICE] Obteniendo estadísticas simples...');
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/stats/simple`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron obtener estadísticas`);
      }

      const data = await response.json();
      console.log('✅ [SERVICE] Estadísticas simples obtenidas');
      
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getSimpleStats:', error.message);
      
      // Retornar objeto vacío en caso de error
      return {
        rankingAgricultores: [],
        biofertilizantes: [],
        general: {
          totalAgricultores: 0,
          totalProyectos: 0,
          totalBiofertilizantes: 0
        }
      };
    }
  },

  // Obtener todas las estadísticas
  async getCompleteStats(userId) {
    try {
      console.log('📊 [SERVICE] Obteniendo estadísticas completas...');
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/stats/complete`,
        {
          method: 'GET',
          headers: { 
            'Authorization': userId,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await handleResponse(response);
      console.log('✅ [SERVICE] Estadísticas completas obtenidas');
      return data;
      
    } catch (error) {
      console.log('❌ [SERVICE] Error en getCompleteStats:', error);
      throw new Error(error.message || 'Error al cargar estadísticas completas');
    }
  },

    // 🆕 NUEVO MÉTODO: Obtener datos extendidos del cultivo (incluyendo debug)
    async getCropExtendedData(userId, cropId) {
      try {
        console.log('🔍 [SERVICE] Obteniendo datos EXTENDIDOS del cultivo:', cropId);
        
        const [cropData, sensorData, recommendations, debugData] = await Promise.all([
          this.getCropDetails(userId, cropId),
          this.getCropSensorData(userId, cropId),
          this.getCropRecommendations(userId, cropId),
          this.debugCropData(userId, cropId).catch(error => {
            console.log('⚠️ [SERVICE] Debug data failed, continuing without it:', error);
            return null;
          })
        ]);

        const extendedData = {
          crop: cropData,
          sensorData,
          recommendations,
          debug: debugData,
          summary: {
            hasCropData: !!cropData,
            hasSensorData: sensorData.length > 0,
            hasRecommendations: recommendations.length > 0,
            hasHistory: cropData?.history?.length > 0,
            hasFarmerData: !!cropData?.observations || !!cropData?.humidity || !!cropData?.seed || !!cropData?.bioFertilizer
          }
        };

        console.log('✅ [SERVICE] Datos extendidos obtenidos:', extendedData.summary);
        return extendedData;
        
      } catch (error) {
        console.log('❌ [SERVICE] Error en getCropExtendedData:', error);
        throw new Error(error.message || 'Error al cargar los datos extendidos del cultivo');
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
scientistService.initConnectionListener().catch(console.error);