// services/scientistService.js - VERSIÓN COMPLETA Y MEJORADA
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

const API_BASE_URL = API_CONFIG.API_BASE_URL;

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

  // Obtener detalles de un agricultor
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

  // Obtener detalles de un cultivo específico - VERSIÓN MEJORADA
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
      console.log('✅ [SERVICE] Detalles del cultivo obtenidos:', {
        id: data._id,
        crop: data.crop,
        location: data.location,
        historyCount: data.history?.length || 0,
        hasHumidity: !!data.humidity,
        hasObservations: !!data.observations,
        hasSeed: !!data.seed,
        hasBioFertilizer: !!data.bioFertilizer,
        farmerName: data.farmerName
      });
      
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

  // 🔍 NUEVO: Debug endpoint para ver todos los datos del cultivo
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
        userId,
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
        timestamp: recommendationData.timestamp || new Date().toISOString(),
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

  // Obtener estadísticas para reportes
  async getStats(userId, farmerId, timeRange = '7days') {
    try {
      console.log('📊 [SERVICE] Obteniendo estadísticas para:', farmerId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/scientist/stats/${farmerId}?range=${timeRange}`,
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
      
      // Retornar estadísticas vacías si hay error
      if (error.message.includes('404') || error.message.includes('No se encontraron estadísticas')) {
        console.log('⚠️ [SERVICE] No se encontraron estadísticas, retornando objeto vacío');
        return {
          temperature: { average: 0, min: 0, max: 0 },
          humidity: { average: 0, min: 0, max: 0 },
          soilMoisture: { average: 0, min: 0, max: 0 },
          recommendations: { total: 0, pending: 0, completed: 0 }
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
        `${API_BASE_URL}/health`,
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
  }
};