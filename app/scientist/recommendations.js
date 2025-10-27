// app/scientist/recommendations.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

export default function Recommendations() {
  const { farmerId } = useLocalSearchParams();
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState('');
  const [crops, setCrops] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useSync();

  useEffect(() => {
    loadFarmers();
  }, []);

  useEffect(() => {
    if (selectedFarmer) {
      loadFarmerCrops(selectedFarmer);
    }
  }, [selectedFarmer]);

  const loadFarmers = async () => {
    try {
      const farmersData = await scientistService.getFarmers(user.id);
      setFarmers(farmersData);
    } catch (error) {
      console.log('Error loading farmers:', error);
    }
  };

  const loadFarmerCrops = async (farmerId) => {
    try {
      const cropsData = await scientistService.getFarmerCrops(user.id, farmerId);
      setCrops(cropsData);
    } catch (error) {
      console.log('Error loading crops:', error);
    }
  };

const handleSubmitRecommendation = async () => {
  if (!selectedFarmer || !recommendation.trim()) {
    Alert.alert('Error', 'Por favor selecciona un agricultor y escribe una recomendación');
    return;
  }

  setIsSubmitting(true);
  try {
    console.log('Preparando para enviar recomendación:', {
      selectedFarmer,
      selectedCrop,
      recommendation: recommendation.trim(),
      priority,
      scientistId: user.id,
      scientistName: user.name,
    });

    await scientistService.sendRecommendation(user.id, {
      farmerId: selectedFarmer,
      cropId: selectedCrop || null, // Asegurar que sea null si está vacío
      recommendation: recommendation.trim(),
      priority,
      scientistId: user.id,
      scientistName: user.name,
      timestamp: new Date().toISOString(), // Agregar timestamp
    });

    Alert.alert('Éxito', 'Recomendación enviada correctamente');
    setRecommendation('');
    setSelectedCrop('');
    setSelectedFarmer('');
    router.back();
    
  } catch (error) {
    console.log('Error detallado enviando recomendación:', error);
    
    // Mensaje de error más específico
    let errorMessage = 'No se pudo enviar la recomendación';
    
    if (error.message.includes('Network request failed')) {
      errorMessage = 'Error de conexión. Verifica tu internet.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
      errorMessage = 'Error de autenticación. Vuelve a iniciar sesión.';
    } else if (error.message.includes('500')) {
      errorMessage = 'Error del servidor. Intenta más tarde.';
    }
    
    Alert.alert('Error', errorMessage);
  } finally {
    setIsSubmitting(false);
  }
};

  const getSelectedFarmer = () => {
    return farmers.find(f => f._id === selectedFarmer);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💡 Generar Recomendación</Text>
        <Text style={styles.subtitle}>Asesorar a agricultores sobre sus cultivos</Text>
      </View>

      <View style={styles.form}>
        {/* Selección de Agricultor */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>👨‍🌾 Agricultor *</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.farmerScroll}
          >
            {farmers.map((farmer) => (
              <TouchableOpacity
                key={farmer._id}
                style={[
                  styles.farmerOption,
                  selectedFarmer === farmer._id && styles.farmerOptionSelected
                ]}
                onPress={() => setSelectedFarmer(farmer._id)}
              >
                <Text style={[
                  styles.farmerOptionText,
                  selectedFarmer === farmer._id && styles.farmerOptionTextSelected
                ]}>
                  {farmer.name}
                </Text>
                <Text style={styles.farmerOptionCrop}>{farmer.cultivo}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Información del Agricultor Seleccionado */}
        {selectedFarmer && (
          <View style={styles.farmerInfo}>
            <Text style={styles.farmerInfoText}>
              📍 {getSelectedFarmer()?.ubicacion}
            </Text>
            <Text style={styles.farmerInfoText}>
              🌱 {getSelectedFarmer()?.cultivo}
            </Text>
          </View>
        )}

        {/* Selección de Cultivo (Opcional) */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>🌱 Cultivo Específico (Opcional)</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.cropScroll}
          >
            <TouchableOpacity
              style={[
                styles.cropOption,
                selectedCrop === '' && styles.cropOptionSelected
              ]}
              onPress={() => setSelectedCrop('')}
            >
              <Text style={[
                styles.cropOptionText,
                selectedCrop === '' && styles.cropOptionTextSelected
              ]}>
                Todos los cultivos
              </Text>
            </TouchableOpacity>
            {crops.map((crop) => (
              <TouchableOpacity
                key={crop._id}
                style={[
                  styles.cropOption,
                  selectedCrop === crop._id && styles.cropOptionSelected
                ]}
                onPress={() => setSelectedCrop(crop._id)}
              >
                <Text style={[
                  styles.cropOptionText,
                  selectedCrop === crop._id && styles.cropOptionTextSelected
                ]}>
                  {crop.crop}
                </Text>
                <Text style={styles.cropOptionLocation}>{crop.location}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Prioridad */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>🎯 Prioridad</Text>
          <View style={styles.priorityOptions}>
            {[
              { value: 'low', label: 'Baja', color: '#4caf50' },
              { value: 'medium', label: 'Media', color: '#ff9800' },
              { value: 'high', label: 'Alta', color: '#f44336' }
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.priorityOption,
                  { borderColor: option.color },
                  priority === option.value && { backgroundColor: option.color }
                ]}
                onPress={() => setPriority(option.value)}
              >
                <Text style={[
                  styles.priorityOptionText,
                  priority === option.value && styles.priorityOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recomendación */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📝 Recomendación *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Escribe tu recomendación para el agricultor...
Ejemplo: 'Regar mañana a las 6 am cuando la temperatura sea más baja'
'O aplicar fertilizante orgánico en los próximos 3 días'"
            value={recommendation}
            onChangeText={setRecommendation}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {recommendation.length} caracteres
          </Text>
        </View>

        {/* Ejemplos de Recomendaciones */}
        <View style={styles.examplesSection}>
          <Text style={styles.examplesTitle}>💡 Ejemplos de Recomendaciones:</Text>
          <Text style={styles.example}>• "Regar mañana a las 6:00 AM"</Text>
          <Text style={styles.example}>• "Aplicar fertilizante nitrogenado"</Text>
          <Text style={styles.example}>• "Revisar sistema de riego"</Text>
          <Text style={styles.example}>• "Cosechar en 2 semanas"</Text>
        </View>

        {/* Botón de Envío */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedFarmer || !recommendation.trim() || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitRecommendation}
          disabled={!selectedFarmer || !recommendation.trim() || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Enviando...' : '📤 Enviar Recomendación'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#7b1fa2',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  farmerScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  farmerOption: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  farmerOptionSelected: {
    backgroundColor: '#7b1fa2',
  },
  farmerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  farmerOptionTextSelected: {
    color: 'white',
  },
  farmerOptionCrop: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  farmerInfo: {
    backgroundColor: '#f3e5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  farmerInfoText: {
    fontSize: 14,
    color: '#7b1fa2',
    marginBottom: 2,
  },
  cropScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  cropOption: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  cropOptionSelected: {
    backgroundColor: '#4caf50',
  },
  cropOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  cropOptionTextSelected: {
    color: 'white',
  },
  cropOptionLocation: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  priorityOptionTextSelected: {
    color: 'white',
  },
  textArea: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  examplesSection: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 6,
  },
  example: {
    fontSize: 12,
    color: '#e65100',
    marginBottom: 2,
  },
  submitButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#b0bec5',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});