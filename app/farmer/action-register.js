// app/farmer/action-register.js - VERSIÓN LIMPIA
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

  const { 
    isConnected, 
    isSyncing, 
    user,
    API_BASE_URL
  } = useSync();

  // 🔄 GUARDADO LOCAL MEJORADO
  const saveCropLocal = async (cropData) => {
    try {
      const cropToSave = {
        ...cropData,
        id: Date.now().toString(),
        synced: false,
        createdAt: new Date().toISOString(),
        history: [{
          date: new Date().toISOString(),
          type: cropData.actionType,
          seed: cropData.seed || '',
          action: generateActionDescription(cropData.actionType, cropData.seed, cropData.bioFertilizer),
          bioFertilizer: cropData.bioFertilizer || '',
          observations: cropData.observations || '',
          synced: false
        }]
      };

      const existingCrops = await AsyncStorage.getItem('localCrops') || '[]';
      const crops = JSON.parse(existingCrops);
      crops.push(cropToSave);
      await AsyncStorage.setItem('localCrops', JSON.stringify(crops));
      
      console.log('✅ Cultivo guardado localmente, ID:', cropToSave.id);
      
      return cropToSave;
    } catch (error) {
      console.log('❌ Error guardando localmente:', error);
      return null;
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

  // 🔄 GUARDAR CULTIVO/ACCIÓN
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

    const cropData = {
      userId: user.id,
      ...form,
      humidity: form.humidity ? parseInt(form.humidity) : null
    };

    console.log('💾 Intentando guardar cultivo/acción...');

    if (isConnected && !isSyncing) {
      // 🔄 MODO ONLINE: Intentar guardar en MongoDB primero
      try {
        const response = await fetch(`${API_BASE_URL}/crops`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': user.id
          },
          body: JSON.stringify(cropData)
        });

        if (response.ok) {
          const result = await response.json();
          Alert.alert('✅ Éxito', 'Acción registrada correctamente en la nube');
          console.log('🌱 Cultivo/acción guardado en MongoDB:', result);
          
          resetForm();
          setTimeout(() => router.back(), 1500);
        } else {
          throw new Error('Error en respuesta del servidor');
        }
      } catch (error) {
        console.log('❌ Error guardando en MongoDB, guardando localmente:', error);
        // Fallback: guardar localmente
        await saveAndHandleOffline(cropData);
      }
    } else {
      // 📴 MODO OFFLINE: Guardar localmente directamente
      await saveAndHandleOffline(cropData);
    }

    setIsLoading(false);
  };

  // 🔄 FUNCIÓN PARA GUARDADO OFFLINE
  const saveAndHandleOffline = async (cropData) => {
    const saved = await saveCropLocal(cropData);
    if (saved) {
      Alert.alert(
        '💾 Guardado Local', 
        'Acción guardada localmente. Se sincronizará automáticamente cuando haya conexión.',
        [{ text: 'OK', onPress: () => resetForm() }]
      );
      setTimeout(() => router.back(), 1500);
    } else {
      Alert.alert('❌ Error', 'No se pudo guardar la acción');
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
      <Text style={styles.title}>🌱 Registrar Nueva Acción</Text>

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
          onChangeText={(text) => setForm({ ...form, humidity: text })}
          keyboardType="numeric"
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
        />
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>
          {isLoading ? '⏳ Guardando...' : '💾 Guardar Acción'}
        </Text>
      </TouchableOpacity>

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
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 20, 
    color: '#2e7d32' 
  },
  section: { 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16 
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
    backgroundColor: '#f0f0f0', 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  typeButtonSelected: { 
    backgroundColor: '#2e7d32', 
    borderColor: '#2e7d32' 
  },
  typeText: { 
    fontSize: 12, 
    color: '#666' 
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
    fontSize: 16 
  },
  textArea: { 
    height: 80, 
    textAlignVertical: 'top' 
  },
  saveButton: { 
    backgroundColor: '#2e7d32', 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 20 
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
});