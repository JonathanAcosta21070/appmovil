// app/scientist/recommendations.js - VERSIÓN CON ESTILO DE HOME SCIENTIST
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

// Constantes para prioridades
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja', color: '#4caf50' },
  { value: 'medium', label: 'Media', color: '#ff9800' },
  { value: 'high', label: 'Alta', color: '#f44336' }
];

const EXAMPLE_RECOMMENDATIONS = [
  "Regar mañana a las 6:00 AM cuando la temperatura sea más baja",
  "Aplicar fertilizante nitrogenado en los próximos 3 días",
  "Revisar sistema de riego por posible obstrucción",
  "Programar cosecha para dentro de 2 semanas"
];

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

  // Memoizar funciones
  const loadFarmers = useCallback(async () => {
    try {
      setIsLoading(true);
      const farmersData = await scientistService.getFarmers(user.id);
      setFarmers(farmersData || []);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los agricultores');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  const loadFarmerCrops = useCallback(async (farmerId) => {
    try {
      const cropsData = await scientistService.getFarmerCrops(user.id, farmerId);
      setCrops(cropsData || []);
    } catch (error) {
      console.log('Error loading crops:', error);
    }
  }, [user.id]);

  useEffect(() => {
    loadFarmers();
  }, [loadFarmers]);

  useEffect(() => {
    if (selectedFarmer) {
      loadFarmerCrops(selectedFarmer);
    }
  }, [selectedFarmer, loadFarmerCrops]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFarmers();
  }, [loadFarmers]);

  const handleSubmitRecommendation = useCallback(async () => {
    if (!selectedFarmer || !recommendation.trim()) {
      Alert.alert('Error', 'Por favor selecciona un agricultor y escribe una recomendación');
      return;
    }

    setIsSubmitting(true);
    try {
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
  }, [selectedFarmer, selectedCrop, recommendation, priority, user, router]);

  const getSelectedFarmer = useCallback(() => {
    return farmers.find(f => f._id === selectedFarmer);
  }, [farmers, selectedFarmer]);

  // Componentes memoizados
  const ConnectionInfo = useMemo(() => (
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
  ), [isConnected, unsyncedCount]);

  const HeaderSection = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.title}>💡 Generar Recomendaciones</Text>
      <Text style={styles.subtitle}>
        Asesorar a agricultores sobre sus cultivos
      </Text>
    </View>
  ), []);

  const FarmerSelectionSection = useMemo(() => (
    <SelectionSection
      title="👨‍🌾 Seleccionar Agricultor"
      isLoading={isLoading}
      items={farmers}
      selectedItem={selectedFarmer}
      onSelect={setSelectedFarmer}
      emptyIcon="👥"
      emptyText="No hay agricultores asignados"
      emptySubtext="Los agricultores aparecerán aquí cuando sean asignados a tu perfil"
      renderItem={(farmer) => ({
        icon: '👨‍🌾',
        name: farmer.name,
        subtitle: farmer.email
      })}
    />
  ), [isLoading, farmers, selectedFarmer]);

  const FarmerInfoSection = useMemo(() => {
    const selectedFarmerData = getSelectedFarmer();
    if (!selectedFarmerData) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Información del Agricultor</Text>
        <View style={styles.infoCard}>
          <InfoRow label="👤 Nombre:" value={selectedFarmerData.name} />
          {selectedFarmerData.email && <InfoRow label="📧 Email:" value={selectedFarmerData.email} />}
          {selectedFarmerData.ubicacion && <InfoRow label="📍 Ubicación:" value={selectedFarmerData.ubicacion} />}
          <InfoRow label="🌱 Cultivos Activos:" value={crops.length.toString()} />
        </View>
      </View>
    );
  }, [getSelectedFarmer, crops.length]);

  const CropSelectionSection = useMemo(() => {
    if (!selectedFarmer) return null;

    return (
      <SelectionSection
        title="🌱 Seleccionar Cultivo (Opcional)"
        isLoading={false}
        items={crops}
        selectedItem={selectedCrop}
        onSelect={setSelectedCrop}
        emptyIcon="🌱"
        emptyText="No hay cultivos activos"
        emptySubtext="Este agricultor no tiene cultivos registrados"
        renderItem={(crop) => ({
          icon: '🌿',
          name: crop.crop || 'Cultivo',
          subtitle: `📍 ${crop.location || 'Ubicación no especificada'}`
        })}
      />
    );
  }, [selectedFarmer, crops, selectedCrop]);

  const PrioritySection = useMemo(() => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎯 Nivel de Prioridad</Text>
      <View style={styles.priorityGrid}>
        {PRIORITY_OPTIONS.map((option) => (
          <PriorityCard
            key={option.value}
            option={option}
            isSelected={priority === option.value}
            onSelect={() => setPriority(option.value)}
          />
        ))}
      </View>
    </View>
  ), [priority]);

  const RecommendationSection = useMemo(() => (
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
  ), [recommendation]);

  const isSubmitDisabled = !selectedFarmer || !recommendation.trim() || isSubmitting;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
    >
      {HeaderSection}

      {FarmerSelectionSection}
      {FarmerInfoSection}
      {CropSelectionSection}
      {PrioritySection}
      {RecommendationSection}

      {/* Ejemplos de Recomendaciones */}
      <ExamplesSection />

      {/* Botón de Envío */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          isSubmitDisabled && styles.submitButtonDisabled
        ]}
        onPress={handleSubmitRecommendation}
        disabled={isSubmitDisabled}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? '⏳ Enviando...' : '📤 Enviar Recomendación'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Componentes auxiliares memoizados
const SelectionSection = React.memo(({ 
  title, 
  isLoading, 
  items, 
  selectedItem, 
  onSelect, 
  emptyIcon, 
  emptyText, 
  emptySubtext,
  renderItem 
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    
    {isLoading ? (
      <LoadingCard text="Cargando..." />
    ) : items.length === 0 ? (
      <EmptyCard icon={emptyIcon} text={emptyText} subtext={emptySubtext} />
    ) : (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollContainer}
      >
        {items.map((item) => {
          const { icon, name, subtitle } = renderItem(item);
          return (
            <OptionCard
              key={item._id}
              icon={icon}
              name={name}
              subtitle={subtitle}
              isSelected={selectedItem === item._id}
              onPress={() => onSelect(item._id)}
            />
          );
        })}
      </ScrollView>
    )}
  </View>
));

const OptionCard = React.memo(({ icon, name, subtitle, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.optionCard,
      isSelected && styles.optionCardSelected
    ]}
    onPress={onPress}
  >
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleContainer}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={styles.cardTitleText}>
          <Text style={[
            styles.cardName,
            isSelected && styles.cardNameSelected
          ]}>
            {name}
          </Text>
          <Text style={[
            styles.cardSubtitle,
            isSelected && styles.cardSubtitleSelected
          ]}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
));

const InfoRow = React.memo(({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
));

const PriorityCard = React.memo(({ option, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.priorityCard,
      { borderLeftColor: option.color },
      isSelected && { backgroundColor: option.color }
    ]}
    onPress={onSelect}
  >
    <Text style={[
      styles.priorityText,
      isSelected && styles.priorityTextSelected
    ]}>
      {option.label}
    </Text>
  </TouchableOpacity>
));

const ExamplesSection = React.memo(() => (
  <View style={styles.section}>
    <View style={styles.helpCard}>
      <Text style={styles.helpTitle}>💡 Ejemplos de Recomendaciones</Text>
      <View style={styles.helpList}>
        {EXAMPLE_RECOMMENDATIONS.map((example, index) => (
          <HelpItem key={index} text={example} />
        ))}
      </View>
    </View>
  </View>
));

const HelpItem = React.memo(({ text }) => (
  <View style={styles.helpItem}>
    <Text style={styles.helpIcon}>•</Text>
    <Text style={styles.helpText}>{text}</Text>
  </View>
));

const LoadingCard = React.memo(({ text }) => (
  <View style={styles.loadingCard}>
    <Text style={styles.loadingText}>{text}</Text>
  </View>
));

const EmptyCard = React.memo(({ icon, text, subtext }) => (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyText}>{text}</Text>
    <Text style={styles.emptySubtext}>{subtext}</Text>
  </View>
));

// Estilos (iguales al original)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 60,
  },
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  scrollContainer: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
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
  bottomSpacing: {
    height: 40,
  },
});