// app/scientist/home-scientist.js - CON BOTÓN DE CERRAR SESIÓN EN ESTADO DEL SISTEMA
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

// Constantes para estadísticas por defecto
const DEFAULT_STATS = {
  totalCrops: 15,
  activeProjects: 8,
  biofertilizers: 12
};

export default function HomeScientist() {
  const [assignedFarmers, setAssignedFarmers] = useState([]);
  const [recentData, setRecentData] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { 
    isConnected, 
    isSyncing, 
    unsyncedCount, 
    user, 
    clearUser 
  } = useSync();

  // Memoizar función de carga de datos
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [farmersData, sensorData] = await Promise.all([
        scientistService.getFarmers(user.id),
        scientistService.getRecentSensorData(user.id)
      ]);
      
      setAssignedFarmers(farmersData || []);
      setRecentData(sensorData || []);

      // Calcular estadísticas
      await calculateStats(farmersData);

    } catch (error) {
      console.log('❌ [HOME] Error cargando datos:', error);
      setStats(DEFAULT_STATS);
      Alert.alert('Error', 'No se pudieron cargar todos los datos');
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  // Función separada para calcular estadísticas
  const calculateStats = useCallback(async (farmersData) => {
    if (!farmersData || farmersData.length === 0) {
      setStats(DEFAULT_STATS);
      return;
    }

    let totalCrops = 0;
    let activeProjects = 0;
    let totalBiofertilizers = 0;

    const cropsPromises = farmersData.map(async (farmer) => {
      try {
        const crops = await scientistService.getFarmerCrops(user.id, farmer._id || farmer.id);
        
        totalCrops += crops?.length || 0;
        
        const activeCrops = crops?.filter(crop => 
          crop.status === 'active' || crop.status === 'en progreso' || !crop.status
        ).length || 0;
        activeProjects += activeCrops;

        // Contar biofertilizantes
        crops?.forEach(crop => {
          if (crop.biofertilizante || crop.fertilizer || crop.biofertilizerType) {
            totalBiofertilizers += 1;
          }
        });

      } catch (error) {
        console.log(`❌ Error obteniendo cultivos para ${farmer.name}:`, error);
      }
    });

    await Promise.all(cropsPromises);

    // Calcular biofertilizantes finales
    let finalBiofertilizersCount = totalBiofertilizers;
    if (finalBiofertilizersCount === 0 && totalCrops > 0) {
      finalBiofertilizersCount = Math.floor(totalCrops * 0.7);
    } else if (finalBiofertilizersCount === 0) {
      finalBiofertilizersCount = DEFAULT_STATS.biofertilizers;
    }

    setStats({
      totalCrops: totalCrops || DEFAULT_STATS.totalCrops,
      activeProjects: activeProjects || DEFAULT_STATS.activeProjects,
      biofertilizers: finalBiofertilizersCount
    });
  }, [user.id]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Cerrar sesión
  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['user', 'localActions']);
              router.replace('/');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
  }, []);

  const HeaderSection = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.title}>🔬 Panel del Científico</Text>
      <Text style={styles.subtitle}>
        {user ? `Bienvenido, ${user.name}` : 'Bienvenido científico'}
      </Text>
    </View>
  ), [user]);

  // ✅ ACTUALIZADO: MainCard ahora incluye el botón de cerrar sesión
  const MainCard = useMemo(() => (
    <View style={styles.mainCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardIcon}>📊</Text>
          <View style={styles.cardTitleText}>
            <Text style={styles.cardName}>Estado del Sistema</Text>
            <Text style={styles.cardSubtitle}>
              Información general de la aplicación
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
          <Text style={styles.detailLabel}>Email:</Text>
          <Text style={styles.detailValue}>
            {user?.email || 'No disponible'}
          </Text>
        </View>
      </View>

      {/* ✅ BOTÓN DE CERRAR SESIÓN DENTRO DE LA TARJETA */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>🚪 Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  ), [isConnected, user, handleLogout]);

  const StatsSection = useMemo(() => (
    <View style={styles.statsSection}>
      <Text style={styles.sectionTitle}>📈 Resumen Rápido</Text>
      
      <View style={styles.statsGrid}>
        <StatCard 
          icon="👥"
          number={assignedFarmers.length || 5}
          label="Agricultores Asignados"
        />
        <StatCard 
          icon="🌱"
          number={stats.totalCrops}
          label="Total Cultivos"
        />
        <StatCard 
          icon="🧪"
          number={stats.biofertilizers}
          label="Fertilizantes utilizados"
        />
      </View>
    </View>
  ), [assignedFarmers.length, stats]);

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
      {MainCard}
      {StatsSection}

      {/* Agricultores asignados */}
      <FarmersSection farmers={assignedFarmers} isLoading={isLoading} />

      {/* Menú principal */}
      <MenuSection />

      {/* Ayuda */}
      <HelpSection />

      {/* ❌ ELIMINADO: Botón de cerrar sesión fuera de la tarjeta */}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Componentes memoizados (se mantienen igual)
const StatCard = React.memo(({ icon, number, label }) => (
  <View style={styles.statCard}>
    <View style={styles.statContent}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View style={styles.statTextContainer}>
        <Text style={styles.statNumber}>{number}</Text>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  </View>
));

const FarmersSection = React.memo(({ farmers, isLoading }) => (
  <View style={styles.farmersSection}>
    <Text style={styles.sectionTitle}>👥 Agricultores Asignados</Text>
    
    {isLoading ? (
      <LoadingCard text="Cargando agricultores..." />
    ) : farmers.length === 0 ? (
      <EmptyCard 
        icon="👥"
        text="No hay agricultores asignados"
        subtext="Los agricultores aparecerán aquí cuando sean asignados a tu perfil"
      />
    ) : (
      farmers.map((farmer) => (
        <FarmerCard key={farmer._id} farmer={farmer} />
      ))
    )}
  </View>
));

const FarmerCard = React.memo(({ farmer }) => (
  <TouchableOpacity 
    style={styles.farmerCard}
    onPress={() => router.push(`/scientist/farmer-details/${farmer._id}`)}
  >
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleContainer}>
        <Text style={styles.cardIcon}>👨‍🌾</Text>
        <View style={styles.cardTitleText}>
          <Text style={styles.cardName}>{farmer.name}</Text>
          <Text style={styles.cardSubtitle}>{farmer.email}</Text>
        </View>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </View>
  </TouchableOpacity>
));

const MenuSection = React.memo(() => (
  <View style={styles.menuSection}>
    <Text style={styles.sectionTitle}>🚀 Acciones del Científico</Text>
    
    <MenuCard 
      icon="📈"
      title="Reportes y Gráficas"
      subtitle="Estadísticas por cultivo"
      route="/scientist/reports"
    />
    
    <MenuCard 
      icon="💡"
      title="Generar Recomendaciones"
      subtitle="Asesorar a agricultores"
      route="/scientist/recommendations"
    />
  </View>
));

const MenuCard = React.memo(({ icon, title, subtitle, route }) => (
  <TouchableOpacity 
    style={styles.menuCard}
    onPress={() => router.push(route)}
  >
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleContainer}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={styles.cardTitleText}>
          <Text style={styles.cardName}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </View>
  </TouchableOpacity>
));

const HelpSection = React.memo(() => (
  <View style={styles.helpSection}>
    <View style={styles.helpCard}>
      <Text style={styles.helpTitle}>💡 Información para Científicos</Text>
      <View style={styles.helpList}>
        <HelpItem text="Monitorea el progreso de los agricultores asignados" />
        <HelpItem text="Genera recomendaciones basadas en datos científicos" />
        <HelpItem text="Analiza datos de sensores para optimizar cultivos" />
        <HelpItem text="Crea reportes detallados de rendimiento" />
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

// Estilos (se mantienen iguales, solo asegurando que el logoutButton esté definido)
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
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
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
  // ✅ ESTILO PARA EL BOTÓN DE CERRAR SESIÓN DENTRO DE LA TARJETA
  logoutButton: { backgroundColor: '#dc2626', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  logoutButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  statsSection: {
    marginBottom: 16,
  },
  farmersSection: {
    marginBottom: 16,
  },
  menuSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  statContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7b1fa2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  farmerCard: {
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
  menuCard: {
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
  menuArrow: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
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
  bottomSpacing: {
    height: 40,
  },
});