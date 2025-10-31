// app/scientist/farmer-details.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSync } from '../../../contexts/SyncContext';
import { scientistService } from '../../../services/scientistService';

export default function FarmerDetails() {
  const { farmerId } = useLocalSearchParams();
  const [farmer, setFarmer] = useState(null);
  const [crops, setCrops] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useSync();

  useEffect(() => {
    loadFarmerDetails();
  }, [farmerId]);

  const loadFarmerDetails = async () => {
    try {
      setIsLoading(true);
      
      const [farmerData, cropsData, sensorData] = await Promise.all([
        scientistService.getFarmerDetails(user.id, farmerId),
        scientistService.getFarmerCrops(user.id, farmerId),
        scientistService.getFarmerSensorData(user.id, farmerId)
      ]);

      setFarmer(farmerData);
      setCrops(cropsData);
      setSensorData(sensorData);

    } catch (error) {
      console.log('Error loading farmer details:', error);
      Alert.alert('Error', 'No se pudieron cargar los detalles');
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestSensorData = (cropName, location) => {
    return sensorData.find(data => 
      data.crop === cropName && data.location === location
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando información del agricultor...</Text>
      </View>
    );
  }

  if (!farmer) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Agricultor no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>👨‍🌾 {farmer.name}</Text>
        <Text style={styles.subtitle}>{farmer.email}</Text>
      </View>

      {/* Información de Contacto */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📞 Información de Contacto</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{farmer.email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Fecha Registro</Text>
            <Text style={styles.infoValue}>
              {new Date(farmer.fechaRegistro).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Cultivos del Agricultor - SIN BOTÓN DE RECOMENDAR */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🌱 Cultivos Activos</Text>

        {crops.length === 0 ? (
          <Text style={styles.noDataText}>No hay cultivos activos</Text>
        ) : (
          crops.map((crop) => {
            const latestData = getLatestSensorData(crop.crop, crop.location);
            return (
              <TouchableOpacity 
                key={crop._id}
                style={styles.cropCard}
                onPress={() => router.push(`/scientist/crop-details/${crop._id}`)}
              >
                <View style={styles.cropHeader}>
                  <Text style={styles.cropName}>{crop.crop}</Text>
                  <Text style={styles.cropStatus}>{crop.status}</Text>
                </View>
                <Text style={styles.cropLocation}>📍 {crop.location}</Text>
                
                {latestData && (
                  <View style={styles.sensorData}>
                    <Text style={styles.dataItem}>💧 Humedad: {latestData.moisture}%</Text>
                    <Text style={styles.dataItem}>🌡️ Temp: {latestData.temperature}°C</Text>
                  </View>
                )}

                <Text style={styles.cropDate}>
                  Iniciado: {new Date(crop.sowingDate).toLocaleDateString()}
                </Text>
                
                <View style={styles.historyBadge}>
                  <Text style={styles.historyText}>
                    {crop.history?.length || 0} acciones registradas
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#7b1fa2', padding: 20, paddingTop: 50 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  subtitle: { fontSize: 16, color: 'white', opacity: 0.9, marginBottom: 2 },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { width: '48%', marginBottom: 12 },
  infoLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  cropCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  cropHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cropName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cropStatus: { fontSize: 12, color: '#666', backgroundColor: '#f3e5f5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  cropLocation: { fontSize: 14, color: '#666', marginBottom: 8 },
  sensorData: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dataItem: { fontSize: 12, color: '#666' },
  cropDate: { fontSize: 11, color: '#999', marginBottom: 4 },
  historyBadge: { alignSelf: 'flex-start', backgroundColor: '#f3e5f5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  historyText: { fontSize: 10, color: '#7b1fa2', fontWeight: '500' },
  loadingText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' },
  errorText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#f44336' },
  noDataText: { textAlign: 'center', color: '#999', fontStyle: 'italic', padding: 20 },
});