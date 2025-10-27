// app/scientist/crop-details/[id].js - VERSIÓN LIMPIA
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { scientistService } from '../../../services/scientistService';

export default function CropDetails() {
  const { id } = useLocalSearchParams();
  const [crop, setCrop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSync();

  useEffect(() => {
    if (id && id !== 'undefined') {
      loadCropDetails();
    } else {
      Alert.alert('Error', 'ID del cultivo no válido');
      setIsLoading(false);
    }
  }, [id]);

  const loadCropDetails = async () => {
    try {
      setIsLoading(true);
      const cropData = await scientistService.getCropDetails(user.id, id);
      setCrop(cropData);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los detalles del cultivo');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCropDetails();
  };

  const renderFarmerData = () => {
    if (!crop) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Datos Registrados por el Agricultor</Text>
        <View style={styles.dataGrid}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Cultivo</Text>
            <Text style={styles.dataValue}>{crop.crop}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Ubicación</Text>
            <Text style={styles.dataValue}>{crop.location}</Text>
          </View>
          {crop.humidity && (
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Humedad Registrada</Text>
              <Text style={styles.dataValue}>{crop.humidity}%</Text>
            </View>
          )}
          {crop.seed && (
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Semilla</Text>
              <Text style={styles.dataValue}>{crop.seed}</Text>
            </View>
          )}
          {crop.bioFertilizer && (
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Biofertilizante</Text>
              <Text style={styles.dataValue}>{crop.bioFertilizer}</Text>
            </View>
          )}
          {crop.sowingDate && (
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Fecha de Siembra</Text>
              <Text style={styles.dataValue}>
                {new Date(crop.sowingDate).toLocaleDateString()}
              </Text>
            </View>
          )}
          {crop.status && (
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Estado</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(crop.status) }]} />
                <Text style={styles.dataValue}>{crop.status}</Text>
              </View>
            </View>
          )}
        </View>

        {crop.observations && (
          <View style={styles.textData}>
            <Text style={styles.dataLabel}>Observaciones del Agricultor</Text>
            <Text style={styles.dataText}>{crop.observations}</Text>
          </View>
        )}

        {crop.recommendations && (
          <View style={styles.textData}>
            <Text style={styles.dataLabel}>Notas del Agricultor</Text>
            <Text style={styles.dataText}>{crop.recommendations}</Text>
          </View>
        )}

        {crop.history && crop.history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionSubtitle}>Historial de Acciones</Text>
            {crop.history.slice(0, 10).map((action, index) => (
              <View key={action._id || `action-${index}`} style={styles.actionItem}>
                <Text style={styles.actionDate}>
                  {action.date ? new Date(action.date).toLocaleDateString() : 'Fecha no disponible'}
                </Text>
                <Text style={styles.actionText}>{action.action}</Text>
                {action.observations && <Text style={styles.actionNotes}>📝 {action.observations}</Text>}
                {action.seed && <Text style={styles.actionMeta}>🌱 Semilla: {action.seed}</Text>}
                {action.bioFertilizer && <Text style={styles.actionMeta}>🧪 Biofertilizante: {action.bioFertilizer}</Text>}
              </View>
            ))}
          </View>
        )}

        {crop.synced === false && (
          <View style={styles.syncWarning}>
            <Text style={styles.syncWarningText}>⚠️ Este cultivo está pendiente de sincronización</Text>
          </View>
        )}
      </View>
    );
  };

  const getStatusColor = (status) => {
    const colors = {
      'activo': '#4caf50',
      'inactivo': '#f44336', 
      'cosechado': '#ff9800',
      'problema': '#ff5722',
      'pendiente': '#ffc107'
    };
    return colors[status?.toLowerCase()] || '#666';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7b1fa2" />
        <Text style={styles.loadingText}>Cargando información del cultivo...</Text>
      </View>
    );
  }

  if (!crop) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Cultivo no encontrado</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>🌱 {crop.crop}</Text>
          <Text style={styles.subtitle}>📍 {crop.location}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(crop.status) }]}>
            <Text style={styles.statusText}>{crop.status?.toUpperCase() || 'ACTIVO'}</Text>
          </View>
        </View>
      </View>

      {renderFarmerData()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  header: { backgroundColor: '#4caf50', padding: 20, paddingTop: 50 },
  headerContent: { alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  subtitle: { fontSize: 16, color: 'white', opacity: 0.9, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  statusText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  farmerText: { fontSize: 14, color: 'white', opacity: 0.9 },
  section: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  sectionSubtitle: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 12 },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  dataItem: { width: '48%', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8 },
  dataLabel: { fontSize: 12, color: '#666', fontWeight: '500', marginBottom: 4 },
  dataValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  textData: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 12 },
  dataText: { fontSize: 14, color: '#333', lineHeight: 20 },
  historySection: { marginTop: 8 },
  actionItem: { backgroundColor: '#f0f8ff', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#2196f3' },
  actionDate: { fontSize: 11, color: '#666', fontWeight: '500', marginBottom: 4 },
  actionText: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  actionNotes: { fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 2 },
  actionMeta: { fontSize: 11, color: '#888' },
  syncWarning: { backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#ffc107', marginTop: 12 },
  syncWarningText: { color: '#856404', fontSize: 12, fontWeight: '500' },
  errorText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#f44336' },
  button: { backgroundColor: '#7b1fa2', padding: 12, borderRadius: 8, marginTop: 16, marginHorizontal: 50 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold' },
});
