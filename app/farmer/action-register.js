// app/farmer/action-register.js - OPTIMIZADO Y CORREGIDO
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

// Constantes para tipos de acción
const ACTION_TYPES = [
  { value: 'sowing', label: '🌱 Siembra' },
  { value: 'watering', label: '💧 Riego' },
  { value: 'fertilization', label: '🧪 Fertilización' },
  { value: 'harvest', label: '📦 Cosecha' },
  { value: 'pruning', label: '✂️ Poda' },
  { value: 'other', label: '📝 Otra' }
];

const INITIAL_FORM = {
  crop: '',
  location: '',
  actionType: 'sowing',
  seed: '',
  bioFertilizer: '',
  observations: '',
  recommendations: '',
  humidity: ''
};

export default function ActionRegister() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [existingCrops, setExistingCrops] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [hasLoadedCrops, setHasLoadedCrops] = useState(false); // 🔥 NUEVO: Control de carga única

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

  // Memoizar valores computados
  const showSeedInput = useMemo(() => form.actionType === 'sowing', [form.actionType]);
  const showFertilizerInput = useMemo(() => form.actionType === 'fertilization', [form.actionType]);
  const isFormValid = useMemo(() => 
    form.crop.trim() && form.location.trim(), [form.crop, form.location]);

  // Funciones memoizadas
  const generateActionDescription = useCallback((type, seed, bioFertilizer) => {
    const descriptions = {
      sowing: `Siembra de ${seed || 'cultivo'}`,
      watering: 'Riego aplicado',
      fertilization: `Aplicación de ${bioFertilizer || 'biofertilizante'}`,
      harvest: 'Cosecha realizada',
      pruning: 'Poda realizada'
    };
    return descriptions[type] || 'Acción realizada';
  }, []);

  const saveCropLocalEnhanced = useCallback(async (cropData) => {
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

      return await saveCropLocal(cropToSave);
    } catch (error) {
      console.error('Error guardando localmente:', error);
      throw error;
    }
  }, [user?.id, saveCropLocal, generateActionDescription]);

  // 🔥 CORRECCIÓN: Cargar cultivos existentes con control de carga única
  const loadExistingCrops = useCallback(async (forceRefresh = false) => {
    // Evitar múltiples llamadas simultáneas
    if (loadingCrops && !forceRefresh) return;
    
    try {
      setLoadingCrops(true);
      
      if (!user?.id) {
        setLoadingCrops(false);
        return;
      }

      console.log('🌱 [ACTION-REGISTER] Cargando cultivos existentes...');
      
      const crops = await loadCachedCrops(forceRefresh);
      console.log('🌱 [ACTION-REGISTER] Cultivos cargados:', crops.length);
      
      const uniqueCrops = crops
        .filter(crop => crop.status?.toLowerCase() === 'activo')
        .reduce((acc, crop) => {
          const key = `${crop.crop?.toLowerCase()}-${crop.location?.toLowerCase()}`;
          if (!acc.find(item => 
            `${item.crop?.toLowerCase()}-${item.location?.toLowerCase()}` === key
          )) {
            acc.push(crop);
          }
          return acc;
        }, []);
      
      setExistingCrops(uniqueCrops);
      setHasLoadedCrops(true); // 🔥 Marcar como cargado
      
      console.log('🌱 [ACTION-REGISTER] Cultivos únicos encontrados:', uniqueCrops.length);
      
    } catch (error) {
      console.error('❌ [ACTION-REGISTER] Error cargando cultivos existentes:', error);
    } finally {
      setLoadingCrops(false);
    }
  }, [user?.id, loadCachedCrops, loadingCrops]);

  // 🔥 CORRECCIÓN: useEffect optimizado sin bucle infinito
  useEffect(() => {
    // Cargar cultivos solo si no se han cargado antes
    if (!hasLoadedCrops && user?.id) {
      console.log('🚀 [ACTION-REGISTER] Iniciando carga inicial de cultivos');
      loadExistingCrops();
    }
  }, [user?.id, hasLoadedCrops, loadExistingCrops]);

  // 🔥 CORRECCIÓN: useEffect separado para refrescar cuando hay conexión
  useEffect(() => {
    // Solo refrescar si hay conexión, cultivos ya cargados y no está sincronizando
    if (isConnected && hasLoadedCrops && !isSyncing && existingCrops.length > 0) {
      console.log('🔄 [ACTION-REGISTER] Refrescando cache por conexión');
      const refreshData = async () => {
        try {
          await refreshCache();
          await loadExistingCrops(true); // Forzar recarga
        } catch (error) {
          console.error('❌ [ACTION-REGISTER] Error refrescando cache:', error);
        }
      };
      
      refreshData();
    }
  }, [isConnected, hasLoadedCrops, isSyncing, existingCrops.length]); // 🔥 Dependencias específicas

  // Manejar selección de cultivo
  const handleSelectCrop = useCallback((crop) => {
    setForm(prev => ({
      ...prev,
      crop: crop.crop || '',
      location: crop.location || ''
    }));
  }, []);

  // Guardar acción
  const handleSave = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert('Error', 'Nombre del cultivo y ubicación son requeridos');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Usuario no identificado');
      return;
    }

    setIsLoading(true);

    const cropData = {
      crop: form.crop.trim(),
      location: form.location.trim(),
      actionType: form.actionType,
      seed: form.seed,
      bioFertilizer: form.bioFertilizer,
      observations: form.observations,
      recommendations: form.recommendations,
      humidity: form.humidity ? parseInt(form.humidity) : null,
      status: 'Activo'
    };

    try {
      if (isConnected && !isSyncing) {
        await saveToServer(cropData);
      } else {
        await saveOffline(cropData);
      }
    } catch (error) {
      console.error('❌ [ACTION-REGISTER] Error guardando:', error);
      Alert.alert('Error', 'No se pudo guardar la acción');
    } finally {
      setIsLoading(false);
    }
  }, [form, isFormValid, user, isConnected, isSyncing]);

  // Guardar en servidor
  const saveToServer = async (cropData) => {
    console.log('📤 [ACTION-REGISTER] Guardando en servidor...');
    
    const response = await fetch(`${API_BASE_URL}/farmer/crops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': user.id },
      body: JSON.stringify(cropData)
    });

    if (response.ok) {
      const result = await response.json();
      const message = result.tipo === 'accion_agregada' 
        ? '✅ Acción agregada al cultivo existente'
        : '🌱 Nuevo cultivo creado correctamente';
      
      Alert.alert('Éxito', message);
      
      // 🔥 CORRECCIÓN: Refrescar cache después de guardar
      try {
        await cacheUserCrops(await getUserCrops(false));
        await loadExistingCrops(true); // Recargar cultivos
      } catch (error) {
        console.error('❌ [ACTION-REGISTER] Error refrescando cache:', error);
      }
      
      resetForm();
      setTimeout(() => router.back(), 1500);
    } else {
      throw new Error(`Error del servidor: ${response.status}`);
    }
  };

  // Guardar offline
  const saveOffline = async (cropData) => {
    console.log('💾 [ACTION-REGISTER] Guardando localmente...');
    
    const localCrops = await getLocalCrops();
    const existingCrop = findExistingCrop(localCrops, cropData);

    if (existingCrop) {
      await updateExistingCrop(existingCrop, cropData);
    } else {
      await createNewCrop(cropData);
    }
  };

  // Funciones auxiliares
  const getLocalCrops = async () => {
    try {
      const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
      return JSON.parse(localCropsString);
    } catch {
      return [];
    }
  };

  const findExistingCrop = (localCrops, cropData) => 
    localCrops.find(crop => 
      crop.crop?.toLowerCase().trim() === cropData.crop.toLowerCase().trim() &&
      crop.location?.toLowerCase().trim() === cropData.location.toLowerCase().trim() &&
      crop.status === 'Activo'
    );

  const updateExistingCrop = async (existingCrop, cropData) => {
    const newAction = createActionObject(cropData);
    const updatedCrop = {
      ...existingCrop,
      history: [newAction, ...(existingCrop.history || [])],
      ...(cropData.humidity && { humidity: cropData.humidity }),
      ...(cropData.bioFertilizer && { bioFertilizer: cropData.bioFertilizer }),
      ...(cropData.observations && { observations: cropData.observations }),
      ...(cropData.recommendations && { recommendations: cropData.recommendations }),
      updatedAt: new Date().toISOString()
    };

    const updatedCrops = (await getLocalCrops()).map(crop => 
      crop.id === existingCrop.id ? updatedCrop : crop
    );

    await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
    showSuccessAlert('✅ Acción Agregada', existingCrop.crop, true);
  };

  const createNewCrop = async (cropData) => {
    const savedCrop = await saveCropLocalEnhanced(cropData);
    if (savedCrop) {
      showSuccessAlert('💾 Nuevo Cultivo Local', cropData.crop, false);
    }
  };

  const createActionObject = (cropData) => ({
    _id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
    type: cropData.actionType,
    seed: cropData.seed || '',
    action: generateActionDescription(cropData.actionType, cropData.seed, cropData.bioFertilizer),
    bioFertilizer: cropData.bioFertilizer || '',
    observations: cropData.observations || '',
    synced: false,
    _source: 'local'
  });

  const showSuccessAlert = (title, cropName, isExisting) => {
    Alert.alert(
      title,
      isExisting 
        ? `Acción agregada al cultivo "${cropName}" existente. Se sincronizará cuando tengas conexión.`
        : `Nuevo cultivo "${cropName}" guardado localmente. Se sincronizará cuando tengas conexión.`,
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
  };

  const resetForm = () => setForm(INITIAL_FORM);

  // 🔥 CORRECCIÓN: Función para forzar recarga manual
  const handleManualRefresh = useCallback(async () => {
    if (loadingCrops) return;
    
    console.log('🔄 [ACTION-REGISTER] Recarga manual solicitada');
    await loadExistingCrops(true);
  }, [loadExistingCrops, loadingCrops]);

  // Renderizado optimizado
  const renderCropSelection = () => (
    <View style={styles.selectionSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🌱 Seleccionar Cultivo Existente</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleManualRefresh}
          disabled={loadingCrops}
        >
          <Text style={styles.refreshButtonText}>
            {loadingCrops ? '⏳' : '🔄'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {loadingCrops ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Cargando cultivos activos...</Text>
        </View>
      ) : existingCrops.length > 0 ? (
        <View style={styles.cropsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cropsScroll}>
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
                      <Text style={styles.cardSubtitle}>📍 {crop.location}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#2196f3' }]}>
                    <Text style={styles.statusText}>{crop.history?.length || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.helpText}>💡 Toca un cultivo para autocompletar nombre y ubicación</Text>
        </View>
      ) : (
        <View style={styles.emptyCrops}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyText}>No tienes cultivos activos</Text>
          <Text style={styles.emptySubtext}>Crea un nuevo cultivo completando el formulario</Text>
        </View>
      )}
    </View>
  );

  // ... (el resto del código de renderizado se mantiene igual)
  const renderFormField = (icon, title, subtitle, children, key) => (
    <View style={styles.formCard} key={key}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardIcon}>{icon}</Text>
          <View style={styles.cardTitleText}>
            <Text style={styles.cardName}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>
      {children}
    </View>
  );

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📝 Registrar Acción</Text>
        <Text style={styles.subtitle}>Nueva actividad agrícola</Text>
      </View>

      {/* Tarjeta principal */}
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
            <Text style={styles.detailValue}>{user?.name || 'No identificado'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cultivos activos:</Text>
            <Text style={styles.detailValue}>{existingCrops.length}</Text>
          </View>
        </View>
      </View>

      {/* Selección de cultivos */}
      {renderCropSelection()}

      {/* Formulario */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>📋 Información de la Acción</Text>

        {renderFormField('🏷️', 'Nombre del Cultivo *', 'Identificador principal',
          <TextInput
            style={styles.input}
            placeholder="Ej: Maíz criollo, Tomate cherry..."
            value={form.crop}
            onChangeText={(text) => setForm(prev => ({ ...prev, crop: text }))}
          />
        )}

        {renderFormField('📍', 'Ubicación *', 'Lugar donde se encuentra',
          <TextInput
            style={styles.input}
            placeholder="Ej: Ejido Santa Catarina, Parcela Norte..."
            value={form.location}
            onChangeText={(text) => setForm(prev => ({ ...prev, location: text }))}
          />
        )}

        {/* ... (resto del formulario se mantiene igual) */}
        {renderFormField('🎯', 'Tipo de Acción *', 'Selecciona la actividad',
          <View style={styles.typeContainer}>
            {ACTION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.typeButton, form.actionType === type.value && styles.typeButtonSelected]}
                onPress={() => setForm(prev => ({ ...prev, actionType: type.value }))}
              >
                <Text style={[styles.typeText, form.actionType === type.value && styles.typeTextSelected]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showSeedInput && renderFormField('🌾', 'Tipo de Semilla', 'Especifica la semilla',
          <TextInput
            style={styles.input}
            placeholder="Ej: Maíz criollo, Tomate híbrido..."
            value={form.seed}
            onChangeText={(text) => setForm(prev => ({ ...prev, seed: text }))}
          />
        )}

        {showFertilizerInput && renderFormField('🧪', 'Biofertilizante Usado', 'Especifica el fertilizante',
          <TextInput
            style={styles.input}
            placeholder="Ej: Compost, Humus, BioDose..."
            value={form.bioFertilizer}
            onChangeText={(text) => setForm(prev => ({ ...prev, bioFertilizer: text }))}
          />
        )}

        {renderFormField('💧', 'Humedad del Suelo (%)', 'Porcentaje de humedad',
          <TextInput
            style={styles.input}
            placeholder="Ej: 65"
            value={form.humidity}
            onChangeText={(text) => setForm(prev => ({ ...prev, humidity: text.replace(/[^0-9]/g, '') }))}
            keyboardType="numeric"
            maxLength={3}
          />
        )}

        {renderFormField('📝', 'Observaciones', 'Notas adicionales',
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Notas sobre el cultivo, estado, problemas observados..."
            value={form.observations}
            onChangeText={(text) => setForm(prev => ({ ...prev, observations: text }))}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        )}

        {renderFormField('💡', 'Recomendaciones', 'Sugerencias para el cuidado',
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Recomendaciones de cuidado, próximos pasos..."
            value={form.recommendations}
            onChangeText={(text) => setForm(prev => ({ ...prev, recommendations: text }))}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        )}
      </View>

      {/* Botón de guardar */}
      <TouchableOpacity 
        style={[styles.actionButton, (!isFormValid || isLoading) && styles.actionButtonDisabled]} 
        onPress={handleSave}
        disabled={!isFormValid || isLoading}
      >
        <Text style={styles.actionButtonText}>
          {isLoading ? '⏳ Guardando...' : 
           isConnected ? '💾 Guardar Acción' : '💾 Guardar Localmente'}
        </Text>
      </TouchableOpacity>

      {/* Información adicional */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información Importante</Text>
          <View style={styles.helpList}>
            {[
             '💡 Consejo: Mantén tus registros al día para analizar el rendimiento del cultivo',
            '📶 No te preocupes si no hay señal: todo se guarda y se enviará más tarde',
            '🪴 Si repites una acción, selecciona el mismo cultivo para llevar el historial completo',
            '✏️ Agrega recomendaciones para recordar qué funcionó mejor en futuras siembras',
            '🔄 Puedes actualizar la lista de cultivos tocando el botón de recarga arriba a la derecha'
                      ].map((text, index) => (
              <View key={index} style={styles.helpItem}>
                <Text style={styles.helpIcon}>•</Text>
                <Text style={styles.helpText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Estilos (agregar los nuevos estilos)
const styles = StyleSheet.create({
  // ... (todos los estilos anteriores se mantienen)
  
  // 🔥 NUEVOS ESTILOS
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  refreshButtonText: {
    fontSize: 16,
  },
  
  // ... (el resto de estilos se mantienen igual)
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16, paddingBottom: 60 },
  header: { backgroundColor: '#2e7d32', padding: 20, borderRadius: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'white', textAlign: 'center', opacity: 0.9 },
  connectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 16 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusOnline: { backgroundColor: '#4caf50' },
  statusOffline: { backgroundColor: '#f44336' },
  statusText: { fontSize: 14, color: '#333', fontWeight: '500' },
  unsyncedText: { fontSize: 12, color: '#ff9800', fontWeight: '500' },
  mainCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  formCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  cardIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  cardTitleText: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#666' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 40, alignItems: 'center' },
  cardDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  selectionSection: { marginBottom: 16 },
  formSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  cropsContainer: { marginBottom: 8 },
  cropsScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  cropCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginRight: 12, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 2, borderColor: 'transparent' },
  cropCardSelected: { backgroundColor: '#e8f5e8', borderColor: '#2e7d32' },
  cropNameSelected: { color: '#2e7d32' },
  helpText: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  loadingCard: { backgroundColor: 'white', padding: 40, borderRadius: 12, alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#666', fontStyle: 'italic' },
  emptyCrops: { backgroundColor: 'white', padding: 40, borderRadius: 12, alignItems: 'center' },
  emptyIcon: { fontSize: 32, marginBottom: 12, opacity: 0.5 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#999', textAlign: 'center', fontStyle: 'italic' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fafafa' },
  textArea: { height: 100, textAlignVertical: 'top' },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dee2e6' },
  typeButtonSelected: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  typeText: { fontSize: 12, color: '#6c757d', fontWeight: '500' },
  typeTextSelected: { color: 'white', fontWeight: 'bold' },
  actionButton: { backgroundColor: '#4caf50', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  actionButtonDisabled: { backgroundColor: '#cccccc' },
  actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  helpSection: { marginBottom: 16 },
  helpCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  helpTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  helpList: { gap: 8 },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start' },
  helpIcon: { marginRight: 8, fontSize: 14, color: '#666' },
  helpText: { fontSize: 14, color: '#666', flex: 1, lineHeight: 20 },
  bottomSpacing: { height: 40 },
});