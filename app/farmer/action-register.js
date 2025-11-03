// app/farmer/action-register.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

export default function ActionRegister() {
  const [form, setForm] = useState({
    crop: '',
    location: '',
    actionType: 'sowing',
    seed: '',
    bioFertilizer: '',
    observations: '',
    recommendations: '',
    humidity: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [existingCrops, setExistingCrops] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(false);

  const { 
    isConnected, 
    isSyncing, 
    user,
    API_BASE_URL,
    saveCropLocal,
    pendingSyncCount,
    getUserCrops,
    cacheUserCrops,
    loadCachedCrops,
    refreshCache
  } = useSync();

  // Cargar cultivos existentes al montar el componente
  useEffect(() => {
    loadExistingCrops();
  }, []);

  // ACTUALIZAR CACHE CUANDO SE RECONECTA
  useEffect(() => {
    if (isConnected && existingCrops.length > 0) {
      console.log('🔄 Conexión restaurada - verificando actualizaciones...');
      refreshCache().then(() => {
        loadExistingCrops(true);
      });
    }
  }, [isConnected]);

  // CARGAR CULTIVOS EXISTENTES - CON ACTUALIZACIÓN AUTOMÁTICA
  const loadExistingCrops = async (forceRefresh = false) => {
    try {
      setLoadingCrops(true);
      console.log('🔄 Cargando cultivos existentes...');
      
      if (user && user.id) {
        let crops = [];
        crops = await loadCachedCrops(forceRefresh);
        
        console.log('📁 Cultivos cargados:', crops.length);
        
        const uniqueCrops = crops.reduce((acc, crop) => {
          if (crop.status?.toLowerCase() === 'activo') {
            const key = `${crop.crop?.toLowerCase()}-${crop.location?.toLowerCase()}`;
            if (!acc.find(item => 
              `${item.crop?.toLowerCase()}-${item.location?.toLowerCase()}` === key
            )) {
              acc.push(crop);
            }
          }
          return acc;
        }, []);
        
        setExistingCrops(uniqueCrops);
        console.log('✅ Cultivos existentes cargados:', uniqueCrops.length);
      }
    } catch (error) {
      console.log('❌ Error cargando cultivos existentes:', error);
    } finally {
      setLoadingCrops(false);
    }
  };

  // SELECCIONAR CULTIVO EXISTENTE
  const handleSelectCrop = (crop) => {
    setForm({
      ...form,
      crop: crop.crop || '',
      location: crop.location || ''
    });
    
    console.log('✅ Cultivo seleccionado:', {
      crop: crop.crop,
      location: crop.location
    });
  };

  // GUARDADO LOCAL MEJORADO - SIN AFECTAR CACHE
  const saveCropLocalEnhanced = async (cropData) => {
    try {
      const cropToSave = {
        ...cropData,
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        synced: false,
        createdAt: new Date().toISOString(),
        userId: user?.id,
        _source: 'local',
        history: [{
          _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          type: cropData.actionType,
          seed: cropData.seed || '',
          action: generateActionDescription(cropData.actionType, cropData.seed, cropData.bioFertilizer),
          bioFertilizer: cropData.bioFertilizer || '',
          observations: cropData.observations || '',
          synced: false,
          _source: 'local'
        }]
      };

      const savedCrop = await saveCropLocal(cropToSave);
      console.log('✅ Cultivo guardado localmente, ID:', savedCrop.id);
      
      return savedCrop;
    } catch (error) {
      console.log('❌ Error guardando localmente:', error);
      throw error;
    }
  };

  // Función auxiliar para generar descripción
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

  // GUARDAR CULTIVO/ACCIÓN
  const handleSave = async () => {
    if (!form.crop || !form.location) {
      Alert.alert('Error', 'Nombre del cultivo y ubicación son requeridos');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Usuario no identificado');
      return;
    }

    setIsLoading(true);

    const normalizedCrop = form.crop.trim();
    const normalizedLocation = form.location.trim();

    const cropData = {
      crop: normalizedCrop,
      location: normalizedLocation,
      actionType: form.actionType,
      seed: form.seed,
      bioFertilizer: form.bioFertilizer,
      observations: form.observations,
      recommendations: form.recommendations,
      humidity: form.humidity ? parseInt(form.humidity) : null,
      status: 'Activo'
    };

    console.log('💾 Intentando guardar cultivo/acción...');

    if (isConnected && !isSyncing) {
      try {
        console.log('🌐 Enviando datos al servidor...');
        const response = await fetch(`${API_BASE_URL}/farmer/crops`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': user.id
          },
          body: JSON.stringify(cropData)
        });

        if (response.ok) {
          const result = await response.json();
          
          const message = result.tipo === 'accion_agregada' 
            ? '✅ Acción agregada al cultivo existente'
            : '🌱 Nuevo cultivo creado correctamente';
          
          Alert.alert('Éxito', message);
          
          const updatedCrops = await getUserCrops(false);
          await cacheUserCrops(updatedCrops);
          
          resetForm();
          setTimeout(() => router.back(), 1500);
        } else {
          const errorText = await response.text();
          throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        console.log('❌ Error guardando en servidor, guardando localmente:', error);
        await saveAndHandleOfflineWithGrouping(cropData);
      }
    } else {
      console.log('📴 Modo offline - guardando localmente');
      await saveAndHandleOfflineWithGrouping(cropData);
    }

    setIsLoading(false);
  };

  // FUNCIÓN AUXILIAR: Obtener cultivos locales
  const getLocalCrops = async () => {
    try {
      const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
      const localCrops = JSON.parse(localCropsString);
      
      const userCrops = user?.id 
        ? localCrops.filter(crop => crop.userId === user.id)
        : localCrops;
      
      return userCrops;
    } catch (error) {
      console.log('❌ Error obteniendo cultivos locales:', error);
      return [];
    }
  };

  // GUARDADO OFFLINE CON AGRUPACIÓN - CORREGIDO
  const saveAndHandleOfflineWithGrouping = async (cropData) => {
    try {
      console.log('💾 Iniciando guardado offline con agrupación...');
      
      const localCrops = await getLocalCrops();
      console.log('📁 Cultivos locales encontrados:', localCrops.length);
      
      const existingCrop = localCrops.find(crop => {
        const cropMatch = crop.crop?.toLowerCase().trim() === cropData.crop.toLowerCase().trim();
        const locationMatch = crop.location?.toLowerCase().trim() === cropData.location.toLowerCase().trim();
        const isActive = crop.status === 'Activo';
        
        return cropMatch && locationMatch && isActive;
      });

      let savedCrop;

      if (existingCrop) {
        console.log('🔄 Agregando acción a cultivo existente:', existingCrop.id);
        
        const newAction = {
          _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          type: cropData.actionType,
          seed: cropData.seed || '',
          action: generateActionDescription(cropData.actionType, cropData.seed, cropData.bioFertilizer),
          bioFertilizer: cropData.bioFertilizer || '',
          observations: cropData.observations || '',
          synced: false,
          _source: 'local'
        };

        const updatedCrop = {
          ...existingCrop,
          history: [newAction, ...(existingCrop.history || [])],
          ...(cropData.humidity && { humidity: cropData.humidity }),
          ...(cropData.bioFertilizer && { bioFertilizer: cropData.bioFertilizer }),
          ...(cropData.observations && { observations: cropData.observations }),
          ...(cropData.recommendations && { recommendations: cropData.recommendations }),
          updatedAt: new Date().toISOString()
        };

        const updatedCrops = localCrops.map(crop => 
          crop.id === existingCrop.id ? updatedCrop : crop
        );

        await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
        savedCrop = updatedCrop;

        console.log('✅ Acción agregada a cultivo local existente:', existingCrop.id);

      } else {
        console.log('🆕 Creando nuevo cultivo local...');
        savedCrop = await saveCropLocalEnhanced(cropData);
      }

      if (savedCrop) {
        Alert.alert(
          existingCrop ? '✅ Acción Agregada' : '💾 Nuevo Cultivo Local',
          existingCrop 
            ? `Acción agregada al cultivo "${cropData.crop}" existente. Se sincronizará cuando tengas conexión.`
            : `Nuevo cultivo "${cropData.crop}" guardado localmente. Se sincronizará cuando tengas conexión.`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                resetForm();
                setTimeout(() => router.back(), 1000);
              }
            },
            {
              text: 'Ver Historial',
              onPress: () => {
                resetForm();
                router.push('/farmer/history');
              }
            }
          ]
        );
      } else {
        console.log('❌ No se pudo guardar el cultivo');
        Alert.alert('❌ Error', 'No se pudo guardar la acción');
      }
    } catch (error) {
      console.log('❌ Error en guardado offline con agrupación:', error);
      Alert.alert('❌ Error', `No se pudo guardar la acción localmente: ${error.message}`);
    }
  };

  const resetForm = () => {
    setForm({
      crop: '',
      location: '',
      actionType: 'sowing',
      seed: '',
      bioFertilizer: '',
      observations: '',
      recommendations: '',
      humidity: ''
    });
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {/* 🔹 Header - Mismo estilo que Home Farmer */}
      <View style={styles.header}>
        <Text style={styles.title}>📝 Registrar Acción</Text>
        <Text style={styles.subtitle}>
          Nueva actividad agrícola
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
        
        {pendingSyncCount > 0 && (
          <Text style={styles.unsyncedText}>
            📱 {pendingSyncCount} pendientes
          </Text>
        )}
      </View>

      {/* 🔹 Tarjeta principal de estado - Mismo estilo que Home Farmer */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>💾</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Estado del Guardado</Text>
              <Text style={styles.cardSubtitle}>
                {isConnected ? 'Datos se enviarán al servidor' : 'Datos se guardarán localmente'}
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
            <Text style={styles.detailLabel}>Usuario:</Text>
            <Text style={styles.detailValue}>
              {user?.name || 'No identificado'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cultivos activos:</Text>
            <Text style={styles.detailValue}>
              {existingCrops.length}
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 Sección de selección de cultivo - Mismo estilo que Home Farmer */}
      <View style={styles.selectionSection}>
        <Text style={styles.sectionTitle}>🌱 Seleccionar Cultivo Existente</Text>
        
        {loadingCrops ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Cargando cultivos activos...</Text>
          </View>
        ) : existingCrops.length > 0 ? (
          <View style={styles.cropsContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.cropsScroll}
            >
              {existingCrops.map((crop, index) => (
                <TouchableOpacity
                  key={crop._id || crop.id || `crop-${index}`}
                  style={[
                    styles.cropCard,
                    form.crop === crop.crop && form.location === crop.location && styles.cropCardSelected
                  ]}
                  onPress={() => handleSelectCrop(crop)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                      <Text style={styles.cardIcon}>🌱</Text>
                      <View style={styles.cardTitleText}>
                        <Text style={[
                          styles.cardName,
                          form.crop === crop.crop && form.location === crop.location && styles.cropNameSelected
                        ]}>
                          {crop.crop}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          📍 {crop.location}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#2196f3' }]}>
                      <Text style={styles.statusText}>
                        {crop.history?.length || 0}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={styles.helpText}>
              💡 Toca un cultivo para autocompletar nombre y ubicación
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCrops}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyText}>No tienes cultivos activos</Text>
            <Text style={styles.emptySubtext}>
              Crea un nuevo cultivo completando el formulario
            </Text>
          </View>
        )}
      </View>

      {/* 🔹 Formulario principal - Mismo estilo de tarjetas */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>📋 Información de la Acción</Text>

        {/* Nombre del Cultivo */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>🏷️</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Nombre del Cultivo *</Text>
                <Text style={styles.cardSubtitle}>Identificador principal</Text>
              </View>
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ej: Maíz criollo, Tomate cherry..."
            value={form.crop}
            onChangeText={(text) => setForm({ ...form, crop: text })}
          />
        </View>

        {/* Ubicación */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📍</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Ubicación *</Text>
                <Text style={styles.cardSubtitle}>Lugar donde se encuentra</Text>
              </View>
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ej: Ejido Santa Catarina, Parcela Norte..."
            value={form.location}
            onChangeText={(text) => setForm({ ...form, location: text })}
          />
        </View>

        {/* Tipo de Acción */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>🎯</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Tipo de Acción *</Text>
                <Text style={styles.cardSubtitle}>Selecciona la actividad</Text>
              </View>
            </View>
          </View>
          <View style={styles.typeContainer}>
            {['sowing', 'watering', 'fertilization', 'harvest', 'pruning', 'other'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, form.actionType === type && styles.typeButtonSelected]}
                onPress={() => setForm({ ...form, actionType: type })}
              >
                <Text style={[styles.typeText, form.actionType === type && styles.typeTextSelected]}>
                  {type === 'sowing' && '🌱 Siembra'}
                  {type === 'watering' && '💧 Riego'}
                  {type === 'fertilization' && '🧪 Fertilización'}
                  {type === 'harvest' && '📦 Cosecha'}
                  {type === 'pruning' && '✂️ Poda'}
                  {type === 'other' && '📝 Otra'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Semilla o Biofertilizante */}
        {(form.actionType === 'sowing' || form.actionType === 'fertilization') && (
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardIcon}>
                  {form.actionType === 'sowing' ? '🌾' : '🧪'}
                </Text>
                <View style={styles.cardTitleText}>
                  <Text style={styles.cardName}>
                    {form.actionType === 'sowing' ? 'Tipo de Semilla' : 'Biofertilizante Usado'}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {form.actionType === 'sowing' ? 'Especifica la semilla' : 'Especifica el fertilizante'}
                  </Text>
                </View>
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder={
                form.actionType === 'sowing' 
                  ? "Ej: Maíz criollo, Tomate híbrido..." 
                  : "Ej: Compost, Humus, BioDose..."
              }
              value={form.actionType === 'sowing' ? form.seed : form.bioFertilizer}
              onChangeText={(text) => 
                form.actionType === 'sowing' 
                  ? setForm({ ...form, seed: text })
                  : setForm({ ...form, bioFertilizer: text })
              }
            />
          </View>
        )}

        {/* Humedad del Suelo */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>💧</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Humedad del Suelo (%)</Text>
                <Text style={styles.cardSubtitle}>Porcentaje de humedad</Text>
              </View>
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ej: 65"
            value={form.humidity}
            onChangeText={(text) => setForm({ ...form, humidity: text.replace(/[^0-9]/g, '') })}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>

        {/* Observaciones */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>📝</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Observaciones</Text>
                <Text style={styles.cardSubtitle}>Notas adicionales</Text>
              </View>
            </View>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Notas sobre el cultivo, estado, problemas observados..."
            value={form.observations}
            onChangeText={(text) => setForm({ ...form, observations: text })}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Recomendaciones */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardIcon}>💡</Text>
              <View style={styles.cardTitleText}>
                <Text style={styles.cardName}>Recomendaciones</Text>
                <Text style={styles.cardSubtitle}>Sugerencias para el cuidado</Text>
              </View>
            </View>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Recomendaciones de cuidado, próximos pasos..."
            value={form.recommendations}
            onChangeText={(text) => setForm({ ...form, recommendations: text })}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* 🔹 Botón de guardar - Mismo estilo que Home Farmer */}
      <TouchableOpacity 
        style={[styles.actionButton, isLoading && styles.actionButtonDisabled]} 
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.actionButtonText}>
          {isLoading ? '⏳ Guardando...' : 
           isConnected ? '💾 Guardar Acción' : '💾 Guardar Localmente'}
        </Text>
      </TouchableOpacity>

      {/* 🔹 Información adicional - Mismo estilo que Home Farmer */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información Importante</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Selecciona un cultivo existente para autocompletar</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los datos se guardan localmente cuando no hay internet</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Puedes sincronizar manualmente desde el inicio</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Los campos marcados con * son obligatorios</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🔽 ESPACIO EN BLANCO PARA SCROLL ADICIONAL */}
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
  formCard: {
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
    minWidth: 40,
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
  selectionSection: {
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 SELECTOR DE CULTIVOS
  cropsContainer: {
    marginBottom: 8,
  },
  cropsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  cropCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cropCardSelected: {
    backgroundColor: '#e8f5e8',
    borderColor: '#2e7d32',
  },
  cropNameSelected: {
    color: '#2e7d32',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // 🔹 ESTADOS DE CARGA Y VACÍO
  loadingCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyCrops: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // 🔹 INPUTS Y FORMULARIOS
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  typeButtonSelected: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  typeText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  typeTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  // 🔹 BOTONES DE ACCIÓN
  actionButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // 🔹 SECCIÓN DE AYUDA
  helpSection: {
    marginBottom: 16,
  },
  helpCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  helpList: {
    gap: 8,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpIcon: {
    marginRight: 8,
    fontSize: 14,
    color: '#666',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});