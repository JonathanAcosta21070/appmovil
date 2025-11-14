// app/scientist/home-scientist.js - VERSIÓN ACTUALIZADA CON VALIDACIÓN DE CACHE
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

export default function HomeScientist() {
  const [assignedFarmers, setAssignedFarmers] = useState([]);
  const [recentData, setRecentData] = useState([]);
  const [stats, setStats] = useState({
    totalCrops: 0,
    activeProjects: 0,
    biofertilizers: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dataSource, setDataSource] = useState('server'); // 'server' o 'cache'
  
  const { 
    isConnected, 
    isSyncing, 
    user,
    validateCacheWithServer // ✅ Nuevo del context
  } = useSync();

  // ✅ MEJORAR: loadData con validación automática
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      
      let farmersData = [];
      let dataSourceType = 'server';
      
      // Si hay conexión, siempre obtener datos frescos y validar cache
      if (isConnected) {
        console.log('🔄 Cargando datos desde servidor...');
        
        // Validar cache antes de cargar
        if (!forceRefresh) {
          await validateCacheWithServer();
        }
        
        // Obtener datos frescos (ya incluye cache automático)
        farmersData = await scientistService.getFarmersWithCache(user.id, forceRefresh);
        dataSourceType = 'server';
        
      } else {
        // Sin conexión, usar cache
        console.log('📴 Sin conexión, cargando desde cache...');
        farmersData = await scientistService.loadCachedFarmers(user.id);
        dataSourceType = 'cache';
      }

      setAssignedFarmers(farmersData || []);
      setDataSource(dataSourceType);
      await calculateStats(farmersData, dataSourceType);
      
      setLastUpdate(new Date());
      
      // Cargar datos adicionales si hay conexión
      if (isConnected) {
        try {
          const sensorData = await scientistService.getRecentSensorData(user.id);
          setRecentData(sensorData || []);
        } catch (error) {
          console.log('❌ Error cargando datos de sensor:', error);
        }
      }

    } catch (error) {
      console.log('❌ [HOME] Error cargando datos:', error);
      
      // Intentar cargar desde cache como fallback
      try {
        const cachedData = await scientistService.loadCachedFarmers(user.id);
        setAssignedFarmers(cachedData);
        setDataSource('cache');
        await calculateStats(cachedData, 'cache');
      } catch (cacheError) {
        console.log('❌ Error cargando desde cache:', cacheError);
        setAssignedFarmers([]);
      }
      
      if (isConnected) {
        Alert.alert('Error', 'No se pudieron cargar todos los datos');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isConnected, validateCacheWithServer]);

  // Calcular estadísticas MEJORADO
  const calculateStats = useCallback(async (farmersData, source) => {
    if (!farmersData || farmersData.length === 0) {
      setStats({ totalCrops: 0, activeProjects: 0, biofertilizers: 0 });
      return;
    }

    let totalCrops = 0;
    let activeProjects = 0;
    let biofertilizers = new Set();

    console.log(`📊 Calculando estadísticas desde: ${source}`);

    // Usar Promise.all para cargar cultivos en paralelo
    const cropPromises = farmersData.map(async (farmer) => {
      try {
        let crops = [];
        
        // Usar la función con cache para cultivos
        crops = await scientistService.getFarmerCropsWithCache(user.id, farmer._id, false);
        
        totalCrops += crops?.length || 0;
        
        // Contar proyectos activos
        const active = crops?.filter(crop => 
          crop.status === 'active' || crop.status === 'Activo' || !crop.status
        ).length || 0;
        activeProjects += active;

        // Contar biofertilizantes únicos
        crops?.forEach(crop => {
          if (crop.biofertilizante) {
            biofertilizers.add(crop.biofertilizante);
          }
          if (crop.fertilizer) {
            biofertilizers.add(crop.fertilizer);
          }
          if (crop.bioFertilizer) {
            biofertilizers.add(crop.bioFertilizer);
          }
        });

      } catch (error) {
        console.log(`❌ Error obteniendo cultivos para ${farmer.name}:`, error);
      }
    });

    await Promise.all(cropPromises);

    setStats({
      totalCrops,
      activeProjects,
      biofertilizers: biofertilizers.size
    });
    
    console.log('✅ Estadísticas calculadas:', { totalCrops, activeProjects, biofertilizers: biofertilizers.size });
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadData();
      }
    }, [loadData, user?.id])
  );

  // ✅ MEJORAR: onRefresh con limpieza de cache
  const onRefresh = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'No puedes actualizar los datos sin conexión a internet');
      return;
    }
    
    setRefreshing(true);
    
    try {
      // Forzar refresh completo (limpia cache y obtiene datos frescos)
      await scientistService.forceRefreshAllData(user.id);
      await loadData(true);
    } catch (error) {
      console.log('❌ Error en refresh:', error);
      Alert.alert('Error', 'No se pudieron actualizar los datos');
    } finally {
      setRefreshing(false);
    }
  }, [loadData, isConnected, user.id]);

  // ✅ MEJORAR: handleLogout con limpieza de cache
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
              // Limpiar todo el cache al cerrar sesión
              if (user?.id) {
                await scientistService.clearAllUserCache(user.id);
              }
              await AsyncStorage.multiRemove(['user', 'localActions']);
              router.replace('/');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
  }, [user?.id]);

  const HeaderSection = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.title}>🔬 Panel del Científico</Text>
      <Text style={styles.subtitle}>
        {user ? `Bienvenido, ${user.name}` : 'Bienvenido científico'}
      </Text>
    </View>
  ), [user]);

  // MainCard con información de conexión
  const MainCard = useMemo(() => (
    <View style={styles.mainCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardIcon}>💾</Text>
          <View style={styles.cardTitleText}>
            <Text style={styles.cardName}>Estado del Sistema</Text>
            <Text style={styles.cardSubtitle}>
              {isConnected ? 'Sincronizado con servidor' : 'Trabajando con datos locales'}
            </Text>
          </View>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#4caf50' : '#ff9800' }]}>
          <Text style={styles.statusText}>
            {isConnected ? '✅ En línea' : '📴 Offline'}
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
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fuente de datos:</Text>
          <Text style={[styles.detailValue, { color: dataSource === 'server' ? '#4caf50' : '#ff9800' }]}>
            {dataSource === 'server' ? '🔄 Servidor' : '📱 Cache local'}
          </Text>
        </View>
      </View>

      {/* Botón de cerrar sesión */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>🚪 Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  ), [isConnected, user, dataSource, assignedFarmers.length, handleLogout]);

  const StatsSection = useMemo(() => (
    <View style={styles.statsSection}>
      <Text style={styles.sectionTitle}>📈 Resumen Rápido</Text>
      
      <View style={styles.statsGrid}>
        <StatCard 
          icon="👥"
          number={assignedFarmers.length}
          label="Agricultores"
        />
        <StatCard 
          icon="🌱"
          number={stats.totalCrops}
          label="Total Cultivos"
        />
        <StatCard 
          icon="🧪"
          number={stats.biofertilizers}
          label="Biofertilizantes"
        />
      </View>
      
      {!isConnected && (
        <Text style={styles.cacheNotice}>
          📊 Datos en cache - Actualizado: {lastUpdate ? lastUpdate.toLocaleTimeString('es-MX') : 'Nunca'}
        </Text>
      )}
    </View>
  ), [assignedFarmers.length, stats, isConnected, lastUpdate]);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={['#7b1fa2']}
          tintColor="#7b1fa2"
          enabled={isConnected} // Solo permitir refresh si hay conexión
        />
      }
      showsVerticalScrollIndicator={true}
    >
      {HeaderSection}

      {MainCard}
      {StatsSection}

      {/* Agricultores asignados */}
      <FarmersSection farmers={assignedFarmers} isLoading={isLoading} dataSource={dataSource} />

      {/* Menú principal */}
      <MenuSection isConnected={isConnected} />

      {/* Ayuda */}
      <HelpSection isConnected={isConnected} dataSource={dataSource} />

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Componentes memoizados ACTUALIZADOS

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

const FarmersSection = React.memo(({ farmers, isLoading, dataSource }) => (
  <View style={styles.farmersSection}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>👥 Agricultores Asignados</Text>
      <View style={[styles.dataSourceBadge, { backgroundColor: dataSource === 'server' ? '#e8f5e8' : '#fff3e0' }]}>
        <Text style={{ color: dataSource === 'server' ? '#4caf50' : '#ff9800', fontSize: 10, fontWeight: 'bold' }}>
          {dataSource === 'server' ? '🔄 LIVE' : '📱 CACHE'}
        </Text>
      </View>
    </View>
    
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

const MenuSection = React.memo(({ isConnected }) => (
  <View style={styles.menuSection}>
    <Text style={styles.sectionTitle}>🚀 Acciones del Científico</Text>
    
    <MenuCard 
      icon="📈"
      title="Reportes y Gráficas"
      subtitle="Estadísticas por cultivo"
      route="/scientist/reports"
      enabled={true}
    />
    
    <MenuCard 
      icon="💡"
      title="Generar Recomendaciones"
      subtitle="Asesorar a agricultores"
      route="/scientist/recommendations"
      enabled={isConnected}
    />
  </View>
));

const MenuCard = React.memo(({ icon, title, subtitle, route, enabled = true }) => (
  <TouchableOpacity 
    style={[styles.menuCard, !enabled && styles.disabledCard]}
    onPress={() => enabled && router.push(route)}
    disabled={!enabled}
  >
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleContainer}>
        <Text style={[styles.cardIcon, !enabled && styles.disabledIcon]}>{icon}</Text>
        <View style={styles.cardTitleText}>
          <Text style={[styles.cardName, !enabled && styles.disabledText]}>{title}</Text>
          <Text style={[styles.cardSubtitle, !enabled && styles.disabledText]}>
            {!enabled ? 'Requiere conexión a internet' : subtitle}
          </Text>
        </View>
      </View>
      <Text style={[styles.menuArrow, !enabled && styles.disabledText]}>›</Text>
    </View>
  </TouchableOpacity>
));

const HelpSection = React.memo(({ isConnected, dataSource }) => (
  <View style={styles.helpSection}>
    <View style={styles.helpCard}>
      <Text style={styles.helpTitle}>💡 Información para Científicos</Text>
      <View style={styles.helpList}>
         <HelpItem 
          text="👨‍🌾 Gestiona agricultores asignados y revisa sus cultivos" 
        />
          <HelpItem 
          text="📊 Analiza reportes y estadísticas de productividad" 
        />
         <HelpItem 
          text="💡 Genera recomendaciones basadas en datos científicos" 
        />
        {!isConnected && (
          <HelpItem text="📱 Los datos se actualizarán cuando recuperes la conexión" />
        )}
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

// Estilos ACTUALIZADOS
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
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  logoutButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dataSourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  cacheNotice: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
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
  farmersSection: {
    marginBottom: 16,
  },
  menuSection: {
    marginBottom: 16,
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
  disabledCard: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  disabledIcon: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
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