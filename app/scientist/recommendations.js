// app/scientist/recommendations.js - VERSIÓN CON ESTILO DE HOME SCIENTIST
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, RefreshControl } from 'react-native';
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { user, isConnected, unsyncedCount } = useSync();

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
      setIsLoading(true);
      const farmersData = await scientistService.getFarmers(user.id);
      setFarmers(farmersData || []);
    } catch (error) {
      console.log('Error loading farmers:', error);
      Alert.alert('Error', 'No se pudieron cargar los agricultores');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadFarmerCrops = async (farmerId) => {
    try {
      const cropsData = await scientistService.getFarmerCrops(user.id, farmerId);
      setCrops(cropsData || []);
    } catch (error) {
      console.log('Error loading crops:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFarmers();
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
        cropId: selectedCrop || null,
        recommendation: recommendation.trim(),
        priority,
        scientistId: user.id,
        scientistName: user.name,
        timestamp: new Date().toISOString(),
      });

      Alert.alert('Éxito', 'Recomendación enviada correctamente');
      setRecommendation('');
      setSelectedCrop('');
      setSelectedFarmer('');
      router.back();
      
    } catch (error) {
      console.log('Error detallado enviando recomendación:', error);
      
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'high': return '#f44336';
      default: return '#666';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
    >
      {/* 🔹 Header - Mismo estilo que Home Scientist */}
      <View style={styles.header}>
        <Text style={styles.title}>💡 Generar Recomendaciones</Text>
        <Text style={styles.subtitle}>
          Asesorar a agricultores sobre sus cultivos
        </Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Home Scientist */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>
        
        {unsyncedCount > 0 && (
          <Text style={styles.unsyncedText}>
            📱 {unsyncedCount} pendientes
          </Text>
        )}
      </View>


      {/* 🔹 Selección de Agricultor - Mismo estilo de tarjetas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👨‍🌾 Seleccionar Agricultor</Text>
        
        {isLoading ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Cargando agricultores...</Text>
          </View>
        ) : farmers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No hay agricultores asignados</Text>
            <Text style={styles.emptySubtext}>
              Los agricultores aparecerán aquí cuando sean asignados a tu perfil
            </Text>
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.scrollContainer}
          >
            {farmers.map((farmer) => (
              <TouchableOpacity
                key={farmer._id}
                style={[
                  styles.optionCard,
                  selectedFarmer === farmer._id && styles.optionCardSelected
                ]}
                onPress={() => setSelectedFarmer(farmer._id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardIcon}>👨‍🌾</Text>
                    <View style={styles.cardTitleText}>
                      <Text style={[
                        styles.cardName,
                        selectedFarmer === farmer._id && styles.cardNameSelected
                      ]}>
                        {farmer.name}
                      </Text>
                      <Text style={[
                        styles.cardSubtitle,
                        selectedFarmer === farmer._id && styles.cardSubtitleSelected
                      ]}>
                        {farmer.email}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 🔹 Información del Agricultor Seleccionado */}
      {selectedFarmer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Información del Agricultor</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>👤 Nombre:</Text>
              <Text style={styles.infoValue}>{getSelectedFarmer()?.name}</Text>
            </View>
            {getSelectedFarmer()?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📧 Email:</Text>
                <Text style={styles.infoValue}>{getSelectedFarmer()?.email}</Text>
              </View>
            )}
            {getSelectedFarmer()?.ubicacion && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📍 Ubicación:</Text>
                <Text style={styles.infoValue}>{getSelectedFarmer()?.ubicacion}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>🌱 Cultivos Activos:</Text>
              <Text style={styles.infoValue}>{crops.length}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 🔹 Selección de Cultivo - Mismo estilo de tarjetas */}
      {selectedFarmer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌱 Seleccionar Cultivo (Opcional)</Text>
          
          {crops.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyText}>No hay cultivos activos</Text>
              <Text style={styles.emptySubtext}>
                Este agricultor no tiene cultivos registrados
              </Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.scrollContainer}
            >
              {crops.map((crop) => (
                <TouchableOpacity
                  key={crop._id}
                  style={[
                    styles.optionCard,
                    selectedCrop === crop._id && styles.optionCardSelected
                  ]}
                  onPress={() => setSelectedCrop(crop._id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                      <Text style={styles.cardIcon}>🌿</Text>
                      <View style={styles.cardTitleText}>
                        <Text style={[
                          styles.cardName,
                          selectedCrop === crop._id && styles.cardNameSelected
                        ]}>
                          {crop.crop || 'Cultivo'}
                        </Text>
                        <Text style={[
                          styles.cardSubtitle,
                          selectedCrop === crop._id && styles.cardSubtitleSelected
                        ]}>
                          📍 {crop.location || 'Ubicación no especificada'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* 🔹 Prioridad - Mismo estilo de tarjetas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Nivel de Prioridad</Text>
        <View style={styles.priorityGrid}>
          {[
            { value: 'low', label: 'Baja', color: '#4caf50' },
            { value: 'medium', label: 'Media', color: '#ff9800' },
            { value: 'high', label: 'Alta', color: '#f44336' }
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.priorityCard,
                { borderLeftColor: option.color },
                priority === option.value && { backgroundColor: option.color }
              ]}
              onPress={() => setPriority(option.value)}
            >
              <Text style={[
                styles.priorityText,
                priority === option.value && styles.priorityTextSelected
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 🔹 Recomendación - Mismo estilo de tarjetas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Escribir Recomendación</Text>
        <View style={styles.textInputCard}>
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
      </View>

      {/* 🔹 Ejemplos de Recomendaciones */}
      <View style={styles.section}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Ejemplos de Recomendaciones</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>"Regar mañana a las 6:00 AM cuando la temperatura sea más baja"</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>"Aplicar fertilizante nitrogenado en los próximos 3 días"</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>"Revisar sistema de riego por posible obstrucción"</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>"Programar cosecha para dentro de 2 semanas"</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🔹 Botón de Envío */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!selectedFarmer || !recommendation.trim() || isSubmitting) && styles.submitButtonDisabled
        ]}
        onPress={handleSubmitRecommendation}
        disabled={!selectedFarmer || !recommendation.trim() || isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? '⏳ Enviando...' : '📤 Enviar Recomendación'}
        </Text>
      </TouchableOpacity>

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
  // 🔹 HEADER - Mismo estilo que Home Scientist
  header: {
    backgroundColor: '#7b1fa2',
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
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Home Scientist
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
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Home Scientist
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
  cardNameSelected: {
    color: 'white',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  cardSubtitleSelected: {
    color: 'white',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 SCROLL CONTAINER
  scrollContainer: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  // 🔹 TARJETAS DE OPCIÓN
  optionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionCardSelected: {
    backgroundColor: '#7b1fa2',
  },
  // 🔹 TARJETA DE INFORMACIÓN
  infoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  // 🔹 PRIORIDAD
  priorityGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  priorityTextSelected: {
    color: 'white',
  },
  // 🔹 ÁREA DE TEXTO
  textInputCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#333',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  // 🔹 SECCIÓN DE AYUDA
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
  // 🔹 BOTÓN DE ENVÍO
  submitButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#b0bec5',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
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
  emptyCard: {
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
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});