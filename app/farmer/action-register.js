// app/farmer/action-register.js - VERSIÓN COMPLETA CON SINCRONIZACIÓN MANUAL
import React, { useState } from 'react';
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

  const { 
    isConnected, 
    isSyncing, 
    user,
    API_BASE_URL,
    saveCropLocal,
    pendingSyncCount
  } = useSync();

  // 🔄 GUARDADO LOCAL MEJORADO
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

 // 🔄 GUARDAR CULTIVO/ACCIÓN (CON SINCRONIZACIÓN MANUAL)
const handleSave = async () => {
  // Validaciones
  if (!form.crop || !form.location) {
    Alert.alert('Error', 'Nombre del cultivo y ubicación son requeridos');
    return;
  }

  if (!user) {
    Alert.alert('Error', 'Usuario no identificado');
    return;
  }

  setIsLoading(true);

  // 🎯 NORMALIZAR DATOS PARA EVITAR DUPLICADOS
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
  console.log('📶 Estado conexión:', isConnected ? 'Conectado' : 'Desconectado');

  if (isConnected && !isSyncing) {
    // 🔄 MODO ONLINE: Intentar guardar en servidor primero
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
        
        // 📊 MOSTRAR MENSAJE ESPECÍFICO SEGÚN EL TIPO DE OPERACIÓN
        const message = result.tipo === 'accion_agregada' 
          ? '✅ Acción agregada al cultivo existente'
          : '🌱 Nuevo cultivo creado correctamente';
        
        Alert.alert('Éxito', message);
        console.log('🌱 Resultado del servidor:', result);
        
        resetForm();
        setTimeout(() => router.back(), 1500);
      } else {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log('❌ Error guardando en servidor, guardando localmente:', error);
      // Fallback: guardar localmente
      await saveAndHandleOffline(cropData);
    }
  } else {
    // 📴 MODO OFFLINE: Guardar localmente con lógica de agrupación
    console.log('📴 Modo offline - guardando localmente');
    await saveAndHandleOfflineWithGrouping(cropData);
  }

  setIsLoading(false);
};
// 🔄 FUNCIÓN AUXILIAR: Obtener cultivos locales
const getLocalCrops = async () => {
  try {
    const localCropsString = await AsyncStorage.getItem('localCrops') || '[]';
    const localCrops = JSON.parse(localCropsString);
    
    // Filtrar por usuario actual
    const userCrops = user?.id 
      ? localCrops.filter(crop => crop.userId === user.id)
      : localCrops;
    
    return userCrops;
  } catch (error) {
    console.log('❌ Error obteniendo cultivos locales:', error);
    return [];
  }
};
// 🔄 GUARDADO OFFLINE CON AGRUPACIÓN - CORREGIDO
const saveAndHandleOfflineWithGrouping = async (cropData) => {
  try {
    console.log('💾 Iniciando guardado offline con agrupación...');
    
    // Obtener cultivos locales existentes
    const localCrops = await getLocalCrops();
    console.log('📁 Cultivos locales encontrados:', localCrops.length);
    
    // Buscar cultivo existente con mismo nombre y ubicación
    const existingCrop = localCrops.find(crop => {
      const cropMatch = crop.crop?.toLowerCase().trim() === cropData.crop.toLowerCase().trim();
      const locationMatch = crop.location?.toLowerCase().trim() === cropData.location.toLowerCase().trim();
      const isActive = crop.status === 'Activo';
      
      console.log('🔍 Buscando cultivo existente:', {
        buscando: { crop: cropData.crop, location: cropData.location },
        encontrado: cropMatch && locationMatch && isActive
      });
      
      return cropMatch && locationMatch && isActive;
    });

    let savedCrop;

    if (existingCrop) {
      // 🔄 AGREGAR ACCIÓN A CULTIVO EXISTENTE
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

      // Actualizar cultivo existente
      const updatedCrop = {
        ...existingCrop,
        history: [newAction, ...(existingCrop.history || [])],
        // Actualizar campos si se proporcionan
        ...(cropData.humidity && { humidity: cropData.humidity }),
        ...(cropData.bioFertilizer && { bioFertilizer: cropData.bioFertilizer }),
        ...(cropData.observations && { observations: cropData.observations }),
        ...(cropData.recommendations && { recommendations: cropData.recommendations }),
        updatedAt: new Date().toISOString()
      };

      // Reemplazar en el array
      const updatedCrops = localCrops.map(crop => 
        crop.id === existingCrop.id ? updatedCrop : crop
      );

      await AsyncStorage.setItem('localCrops', JSON.stringify(updatedCrops));
      savedCrop = updatedCrop;

      console.log('✅ Acción agregada a cultivo local existente:', existingCrop.id);

    } else {
      // 🆕 CREAR NUEVO CULTIVO LOCAL
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Registrar Nueva Acción</Text>
        
        {/* Indicador de estado */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, 
            isConnected ? styles.statusOnline : styles.statusOffline
          ]} />
          <Text style={styles.statusText}>
            {isConnected ? 'En línea' : 'Sin conexión'}
          </Text>
        </View>
      </View>

      {/* Información de sincronización */}
      <View style={styles.syncInfoContainer}>
        {!isConnected ? (
          <View style={styles.syncWarning}>
            <Text style={styles.syncWarningText}>
              📴 Modo offline - Esta acción se guardará localmente
            </Text>
            <Text style={styles.syncWarningSubtext}>
              Sincroniza desde el inicio cuando tengas conexión
            </Text>
          </View>
        ) : pendingSyncCount > 0 ? (
          <View style={styles.pendingSync}>
            <Text style={styles.pendingSyncText}>
              ⚡ Tienes {pendingSyncCount} acción(es) pendientes de sincronizar
            </Text>
            <Text style={styles.pendingSyncSubtext}>
              Usa el botón "Sincronizar" en el inicio para enviarlas al servidor
            </Text>
          </View>
        ) : null}
      </View>

      {/* Formulario principal */}
      <View style={styles.section}>
        <Text style={styles.label}>Nombre del Cultivo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Maíz criollo, Tomate cherry..."
          value={form.crop}
          onChangeText={(text) => setForm({ ...form, crop: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ubicación *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Ejido Santa Catarina, Parcela Norte..."
          value={form.location}
          onChangeText={(text) => setForm({ ...form, location: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tipo de Acción *</Text>
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

      {(form.actionType === 'sowing' || form.actionType === 'fertilization') && (
        <View style={styles.section}>
          <Text style={styles.label}>
            {form.actionType === 'sowing' ? 'Tipo de Semilla' : 'Biofertilizante Usado'}
          </Text>
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

      <View style={styles.section}>
        <Text style={styles.label}>Humedad del Suelo (%)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 65"
          value={form.humidity}
          onChangeText={(text) => setForm({ ...form, humidity: text.replace(/[^0-9]/g, '') })}
          keyboardType="numeric"
          maxLength={3}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Observaciones</Text>
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

      <View style={styles.section}>
        <Text style={styles.label}>Recomendaciones</Text>
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

      <TouchableOpacity 
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>
          {isLoading ? '⏳ Guardando...' : 
           isConnected ? '💾 Guardar Acción' : '💾 Guardar Localmente'}
        </Text>
      </TouchableOpacity>

      {/* Información adicional */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>💡 Información Importante</Text>
        <Text style={styles.infoText}>
          • Los datos se guardan localmente cuando no hay internet{'\n'}
          • Puedes sincronizar manualmente desde el inicio{'\n'}
          • Los campos marcados con * son obligatorios{'\n'}
          • Los datos web aparecerán automáticamente
        </Text>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5', 
    padding: 16 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#2e7d32',
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusOnline: {
    backgroundColor: '#4caf50',
  },
  statusOffline: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  syncInfoContainer: {
    marginBottom: 16,
  },
  syncWarning: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  syncWarningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  syncWarningSubtext: {
    color: '#856404',
    fontSize: 12,
    opacity: 0.8,
  },
  pendingSync: {
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0dcaf0',
  },
  pendingSyncText: {
    color: '#055160',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  pendingSyncSubtext: {
    color: '#055160',
    fontSize: 12,
    opacity: 0.8,
  },
  section: { 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 8, 
    color: '#333' 
  },
  typeContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  typeButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#f8f9fa', 
    borderWidth: 1, 
    borderColor: '#dee2e6' 
  },
  typeButtonSelected: { 
    backgroundColor: '#2e7d32', 
    borderColor: '#2e7d32' 
  },
  typeText: { 
    fontSize: 12, 
    color: '#6c757d',
    fontWeight: '500',
  },
  typeTextSelected: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
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
    textAlignVertical: 'top' 
  },
  saveButton: { 
    backgroundColor: '#2e7d32', 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: { 
    backgroundColor: '#cccccc' 
  },
  saveButtonText: { 
    color: 'white', 
    textAlign: 'center', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1565c0',
    lineHeight: 18,
  },
});