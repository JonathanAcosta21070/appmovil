// app/scientist/reports.js - VERSIÓN CORREGIDA
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

export default function Reports() {
  const { farmerId } = useLocalSearchParams();
  const [selectedFarmer, setSelectedFarmer] = useState(farmerId || '');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [farmers, setFarmers] = useState([]);
  const [crops, setCrops] = useState([]);
  const [stats, setStats] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(false);
  const { user } = useSync();

  useEffect(() => {
    loadFarmers();
  }, []);

  useEffect(() => {
    if (selectedFarmer) {
      loadFarmerCrops(selectedFarmer);
      loadStats(selectedFarmer);
    }
  }, [selectedFarmer, timeRange]);

  const loadFarmers = async () => {
    try {
      const farmersData = await scientistService.getFarmers(user.id);
      setFarmers(farmersData);
      
      if (!selectedFarmer && farmersData.length > 0) {
        setSelectedFarmer(farmersData[0]._id);
      }
    } catch (error) {
      console.log('Error loading farmers:', error);
      Alert.alert('Error', 'No se pudieron cargar los agricultores');
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

  const loadStats = async (farmerId) => {
    try {
      setLoading(true);
      const statsData = await scientistService.getStats(user.id, farmerId, timeRange);
      setStats(statsData);
    } catch (error) {
      console.log('Error loading stats:', error);
      Alert.alert('Error', 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedFarmer = () => {
    return farmers.find(f => f._id === selectedFarmer);
  };

  const StatCard = ({ title, value, subtitle, color = '#7b1fa2' }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Reportes y Estadísticas</Text>
        <Text style={styles.subtitle}>Análisis de datos y métricas de agricultores</Text>
      </View>

      <View style={styles.form}>
        {/* Selección de Agricultor */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>👨‍🌾 Seleccionar Agricultor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.farmerScroll}>
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

        {/* Rango de Tiempo */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📅 Período de Tiempo</Text>
          <View style={styles.timeRangeOptions}>
            {[
              { value: '24hours', label: '24 Horas' },
              { value: '7days', label: '7 Días' },
              { value: '30days', label: '30 Días' }
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.timeRangeOption,
                  timeRange === option.value && styles.timeRangeOptionSelected
                ]}
                onPress={() => setTimeRange(option.value)}
              >
                <Text style={[
                  styles.timeRangeOptionText,
                  timeRange === option.value && styles.timeRangeOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando estadísticas...</Text>
          </View>
        ) : stats && (
          <View style={styles.statsContainer}>
            {/* Resumen de Cultivos */}
            <Text style={styles.sectionTitle}>🌱 Resumen de Cultivos</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                title="Total Cultivos" 
                value={stats.crops?.totalCrops || 0}
                color="#4caf50"
              />
              <StatCard 
                title="Activos" 
                value={stats.crops?.activeCrops || 0}
                color="#2196f3"
              />
              <StatCard 
                title="Cosechados" 
                value={stats.crops?.harvestedCrops || 0}
                color="#ff9800"
              />
            </View>

            {/* Datos de Sensores */}
            <Text style={styles.sectionTitle}>📊 Datos de Sensores</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                title="Temperatura Avg" 
                value={`${stats.sensorData?.avgTemperature?.toFixed(1) || 0}°C`}
                subtitle={`Max: ${stats.sensorData?.maxTemperature?.toFixed(1) || 0}°C`}
                color="#f44336"
              />
              <StatCard 
                title="Humedad Avg" 
                value={`${stats.sensorData?.avgMoisture?.toFixed(1) || 0}%`}
                subtitle={`Max: ${stats.sensorData?.maxMoisture?.toFixed(1) || 0}%`}
                color="#2196f3"
              />
              <StatCard 
                title="Puntos de Datos" 
                value={stats.sensorData?.dataPoints || 0}
                color="#9c27b0"
              />
            </View>

            {/* Recomendaciones */}
            <Text style={styles.sectionTitle}>💡 Recomendaciones</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                title="Total" 
                value={stats.recommendations?.totalRecommendations || 0}
                color="#7b1fa2"
              />
              <StatCard 
                title="Pendientes" 
                value={stats.recommendations?.pendingRecommendations || 0}
                color="#ff9800"
              />
              <StatCard 
                title="Completadas" 
                value={stats.recommendations?.completedRecommendations || 0}
                color="#4caf50"
              />
            </View>

            {/* Acciones por Tipo */}
            <Text style={styles.sectionTitle}>📝 Distribución de Acciones</Text>
            <View style={styles.actionsList}>
              {stats.actionsByType?.map((action, index) => (
                <View key={index} style={styles.actionItem}>
                  <Text style={styles.actionType}>
                    {action._id === 'sowing' && '🌱 Siembra'}
                    {action._id === 'watering' && '💧 Riego'}
                    {action._id === 'fertilization' && '🧪 Fertilización'}
                    {action._id === 'harvest' && '📦 Cosecha'}
                    {action._id === 'pruning' && '✂️ Poda'}
                    {action._id === 'other' && '📝 Otras'}
                  </Text>
                  <Text style={styles.actionCount}>{action.count}</Text>
                </View>
              ))}
            </View>

            {/* Información del Reporte */}
            <View style={styles.reportInfo}>
              <Text style={styles.reportInfoText}>
                📋 Reporte generado: {new Date(stats.generatedAt).toLocaleDateString()}
              </Text>
              <Text style={styles.reportInfoText}>
                ⏱️ Período: {timeRange === '24hours' ? '24 horas' : timeRange === '7days' ? '7 días' : '30 días'}
              </Text>
            </View>
          </View>
        )}
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
    backgroundColor: '#2196f3',
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
    backgroundColor: '#2196f3',
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
  timeRangeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  timeRangeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeRangeOptionSelected: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  timeRangeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timeRangeOptionTextSelected: {
    color: 'white',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  actionsList: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionType: {
    fontSize: 16,
    color: '#333',
  },
  actionCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  reportInfo: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  reportInfoText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 5,
  },
});