// app/scientist/reports.js - VERSIÓN CON GUARDADO LOCAL PARA MODO OFFLINE
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, ScrollView, StyleSheet, Alert, Dimensions,
  ActivityIndicator, RefreshControl, TouchableOpacity 
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

const screenWidth = Dimensions.get('window').width;

// Constantes para colores
const CHART_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

// Claves para almacenamiento local
const STORAGE_KEYS = {
  RANKING_DATA: 'reports_ranking_data',
  BIOFERTILIZER_DATA: 'reports_biofertilizer_data',
  LAST_UPDATE: 'reports_last_update',
  CACHE_TIMESTAMP: 'reports_cache_timestamp'
};

// Componente de tarjeta de estadística optimizado
const StatCard = React.memo(({ title, value, icon = "📊" }) => (
  <View style={styles.statCard}>
    <View style={styles.statContent}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View style={styles.statTextContainer}>
        <Text style={styles.statNumber}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={2}>{title}</Text>
      </View>
    </View>
  </View>
));

// Componente de gráfica de ranking optimizado
const FarmersRankingChart = React.memo(({ data, title }) => {
  const [ChartComponent, setChartComponent] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadChart = async () => {
      try {
        const chartKit = await import('react-native-chart-kit');
        if (chartKit.BarChart) {
          setChartComponent(() => chartKit.BarChart);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      }
    };

    loadChart();
  }, []);

  if (error || !data || data.length === 0) {
    return (
      <View style={styles.chartErrorContainer}>
        <Text style={styles.chartErrorText}>📊 Ranking no disponible</Text>
        <Text style={styles.chartErrorSubtext}>
          {!data || data.length === 0 ? 'No hay datos de agricultores' : 'Error cargando gráfica'}
        </Text>
      </View>
    );
  }

  if (!ChartComponent) {
    return (
      <View style={styles.chartLoadingContainer}>
        <ActivityIndicator size="small" color="#2196f3" />
        <Text style={styles.chartLoadingText}>Cargando ranking...</Text>
      </View>
    );
  }

  const chartData = {
    labels: data.map(item => {
      const name = item.name || item.nombre || 'Agricultor';
      return name.length > 8 ? name.substring(0, 8) + '...' : name;
    }),
    datasets: [
      {
        data: data.map(item => item.totalProyectos || item.projectCount || 0)
      }
    ]
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 16 },
    barPercentage: 0.6,
    propsForLabels: { fontSize: 9 }
  };

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <ChartComponent
        data={chartData}
        width={screenWidth - 40}
        height={220}
        chartConfig={chartConfig}
        style={styles.chart}
        showValuesOnTopOfBars
        fromZero
        withInnerLines={false}
        yAxisLabel=""
        yAxisSuffix=""
      />
      
      <RankingLegend data={data.slice(0, 5)} />
    </View>
  );
});

const RankingLegend = React.memo(({ data }) => (
  <View style={styles.rankingLegend}>
    <Text style={styles.legendTitle}>🏆 Top Agricultores</Text>
    {data.map((farmer, index) => (
      <RankingItem 
        key={index}
        position={index + 1}
        name={farmer.name || farmer.nombre}
        projects={farmer.totalProyectos || farmer.projectCount || 0}
      />
    ))}
  </View>
));

const RankingItem = React.memo(({ position, name, projects }) => (
  <View style={styles.rankingItem}>
    <Text style={styles.rankingPosition}>#{position}</Text>
    <Text style={styles.rankingName}>{name}</Text>
    <Text style={styles.rankingProjects}>{projects} proy.</Text>
  </View>
));

// Componente de gráfica de biofertilizantes optimizado - VERSIÓN CORREGIDA
const BiofertilizerChart = React.memo(({ data, title }) => {
  const [ChartComponent, setChartComponent] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadChart = async () => {
      try {
        const chartKit = await import('react-native-chart-kit');
        if (chartKit.PieChart) {
          setChartComponent(() => chartKit.PieChart);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      }
    };

    loadChart();
  }, []);

  // 🔥 CORRECCIÓN: Agrupar biofertilizantes iguales
  const groupedBiofertilizers = useMemo(() => {
    if (!data || data.length === 0) return [];

    const grouped = {};
    
    data.forEach(item => {
      // Normalizar el nombre del biofertilizante (minúsculas, sin espacios extras)
      const bioName = (item.biofertilizante || 'No especificado')
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' '); // Eliminar espacios múltiples
      
      const count = item.totalProyectos || 1;
      
      if (grouped[bioName]) {
        // Si ya existe, sumar los proyectos
        grouped[bioName] += count;
      } else {
        // Si no existe, crear nueva entrada
        grouped[bioName] = count;
      }
    });

    // Convertir el objeto agrupado a array y ordenar por cantidad (descendente)
    return Object.entries(grouped)
      .map(([name, totalProyectos]) => ({
        biofertilizante: name,
        totalProyectos: totalProyectos
      }))
      .sort((a, b) => b.totalProyectos - a.totalProyectos);
  }, [data]);

  console.log('🧪 [DEBUG] Biofertilizantes agrupados:', {
    original: data?.length || 0,
    agrupados: groupedBiofertilizers.length,
    datos: groupedBiofertilizers
  });

  if (error || !groupedBiofertilizers || groupedBiofertilizers.length === 0) {
    return (
      <View style={styles.chartErrorContainer}>
        <Text style={styles.chartErrorText}>🧪 Gráfica no disponible</Text>
        <Text style={styles.chartErrorSubtext}>
          {!groupedBiofertilizers || groupedBiofertilizers.length === 0 
            ? 'No hay datos de biofertilizantes' 
            : 'Error cargando gráfica'
          }
        </Text>
      </View>
    );
  }

  if (!ChartComponent) {
    return (
      <View style={styles.chartLoadingContainer}>
        <ActivityIndicator size="small" color="#2196f3" />
        <Text style={styles.chartLoadingText}>Cargando comparativa...</Text>
      </View>
    );
  }

  const pieData = groupedBiofertilizers.map((item, index) => ({
    name: item.biofertilizante.charAt(0).toUpperCase() + item.biofertilizante.slice(1), // Capitalizar primera letra
    population: item.totalProyectos,
    color: CHART_COLORS[index % CHART_COLORS.length],
    legendFontColor: '#7F7F7F',
    legendFontSize: 10,
  }));

  const chartConfig = {
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
  };

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <ChartComponent
        data={pieData}
        width={screenWidth - 40}
        height={200}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
      
      <BiofertilizerStats data={groupedBiofertilizers} originalData={data} />
    </View>
  );
});

const BiofertilizerStats = React.memo(({ data, originalData }) => (
  <View style={styles.biofertilizerStats}>
    <Text style={styles.statsTitle}>📈 Resumen de Biofertilizantes</Text>
    <View style={styles.statsGrid}>
      <StatItem value={data.length} label="Tipos únicos" />
      <StatItem 
        value={data.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)} 
        label="Total usos" 
      />
    </View>
    
    {/* 🔥 NUEVO: Lista de biofertilizantes agrupados */}
    <View style={styles.biofertilizerList}>
      <Text style={styles.listTitle}>🧪 Biofertilizantes registrados:</Text>
      {data.slice(0, 5).map((item, index) => (
        <View key={index} style={styles.biofertilizerItem}>
          <Text style={styles.biofertilizerName}>
            {item.biofertilizante.charAt(0).toUpperCase() + item.biofertilizante.slice(1)}
          </Text>
          <Text style={styles.biofertilizerCount}>{item.totalProyectos} usos</Text>
        </View>
      ))}
      {data.length > 5 && (
        <Text style={styles.moreText}>... y {data.length - 5} más</Text>
      )}
    </View>
  </View>
));

const StatItem = React.memo(({ value, label }) => (
  <View style={styles.statItem}>
    <Text style={styles.statNumber}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

export default function Reports() {
  const [rankingData, setRankingData] = useState([]);
  const [biofertilizerData, setBiofertilizerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState('server'); // 'server' o 'cache'
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  
  const { isConnected, unsyncedCount, user } = useSync();

  // ✅ NUEVA FUNCIÓN: Guardar datos en cache local
  const saveToLocalCache = useCallback(async (rankingData, biofertilizerData) => {
    try {
      const cacheData = {
        rankingData,
        biofertilizerData,
        timestamp: Date.now(),
        lastUpdate: new Date().toISOString(),
        userId: user?.id
      };

      await AsyncStorage.setItem(STORAGE_KEYS.RANKING_DATA, JSON.stringify(rankingData));
      await AsyncStorage.setItem(STORAGE_KEYS.BIOFERTILIZER_DATA, JSON.stringify(biofertilizerData));
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATE, new Date().toISOString());
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_TIMESTAMP, Date.now().toString());

      console.log('💾 Datos de reportes guardados en cache local');
    } catch (error) {
      console.log('❌ Error guardando reportes en cache:', error);
    }
  }, [user?.id]);

  // ✅ NUEVA FUNCIÓN: Cargar datos desde cache local
  const loadFromLocalCache = useCallback(async () => {
    try {
      console.log('📁 Intentando cargar reportes desde cache...');
      
      const [cachedRanking, cachedBiofertilizer, lastUpdateString, cacheTimestamp] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.RANKING_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.BIOFERTILIZER_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATE),
        AsyncStorage.getItem(STORAGE_KEYS.CACHE_TIMESTAMP)
      ]);

      // Verificar si el cache es válido (menos de 1 hora)
      const isCacheValid = cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < 3600000; // 1 hora

      if (cachedRanking && cachedBiofertilizer && isCacheValid) {
        const rankingData = JSON.parse(cachedRanking);
        const biofertilizerData = JSON.parse(cachedBiofertilizer);
        
        console.log('✅ Reportes cargados desde cache:', {
          ranking: rankingData.length,
          biofertilizer: biofertilizerData.length
        });

        setRankingData(rankingData);
        setBiofertilizerData(biofertilizerData);
        setDataSource('cache');
        setLastUpdate(lastUpdateString ? new Date(lastUpdateString) : new Date());
        return true;
      } else {
        console.log('❌ Cache de reportes no válido o expirado');
        if (!isCacheValid) {
          // Limpiar cache expirado
          await clearLocalCache();
        }
        return false;
      }
    } catch (error) {
      console.log('❌ Error cargando reportes desde cache:', error);
      return false;
    }
  }, []);

  // ✅ NUEVA FUNCIÓN: Limpiar cache local
  const clearLocalCache = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.RANKING_DATA,
        STORAGE_KEYS.BIOFERTILIZER_DATA,
        STORAGE_KEYS.LAST_UPDATE,
        STORAGE_KEYS.CACHE_TIMESTAMP
      ]);
      console.log('🧹 Cache de reportes limpiado');
    } catch (error) {
      console.log('❌ Error limpiando cache de reportes:', error);
    }
  }, []);

  // ✅ FUNCIÓN MEJORADA: Cargar estadísticas con soporte offline
  const loadGlobalStats = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setConnectionError(false);
      
      if (!user?.id) {
        Alert.alert(
          'Sesión requerida', 
          'Por favor, inicia sesión para ver los reportes',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
        return;
      }
      
      // ✅ ESTRATEGIA: Primero intentar cache si no se fuerza refresh
      if (!forceRefresh) {
        const cacheLoaded = await loadFromLocalCache();
        if (cacheLoaded) {
          setLoading(false);
          return;
        }
      }

      // ✅ Intentar servidor si hay conexión
      if (isConnected) {
        try {
          console.log('🔄 Cargando reportes desde servidor...');
          
          const isValidId = user.id.match(/^[0-9a-fA-F]{24}$/);
          if (!isValidId) {
            Alert.alert('Error', 'ID de usuario inválido. Por favor, vuelve a iniciar sesión.');
            return;
          }
          
          const farmers = await scientistService.getFarmers(user.id);

          if (!farmers || farmers.length === 0) {
            setRankingData([]);
            setBiofertilizerData([]);
            return;
          }

          const rankingResults = await processFarmersData(farmers, user.id);
          const sortedRanking = rankingResults
            .filter(farmer => farmer.totalProyectos > 0)
            .sort((a, b) => b.totalProyectos - a.totalProyectos);

          // Obtener datos de biofertilizantes
          let biofertilizers = [];
          try {
            biofertilizers = await scientistService.getBiofertilizerStats(user.id);
          } catch (e) {
            // Método alternativo desde cultivos
            const allCrops = rankingResults.flatMap(farmer => farmer.cultivos);
            const biofertilizerStats = {};
            
            allCrops.forEach(crop => {
              const biofertilizer = crop.biofertilizante || crop.fertilizer || 'No especificado';
              biofertilizerStats[biofertilizer] = (biofertilizerStats[biofertilizer] || 0) + 1;
            });

            biofertilizers = Object.entries(biofertilizerStats).map(([name, count]) => ({
              biofertilizante: name,
              totalProyectos: count
            }));
          }

          setRankingData(sortedRanking);
          setBiofertilizerData(biofertilizers);
          setDataSource('server');
          setLastUpdate(new Date());

          // ✅ Guardar en cache local
          await saveToLocalCache(sortedRanking, biofertilizers);

          console.log('✅ Reportes cargados desde servidor y guardados en cache');

        } catch (error) {
          console.log('⚠️ Error cargando desde servidor:', error);
          setConnectionError(true);
          
          // ✅ Fallback a cache si hay error de servidor
          const cacheLoaded = await loadFromLocalCache();
          if (!cacheLoaded) {
            // Si no hay cache, mostrar datos vacíos
            setRankingData([]);
            setBiofertilizerData([]);
          }
        }
      } else {
        // ✅ Sin conexión: intentar cargar desde cache
        console.log('📱 Sin conexión, cargando desde cache...');
        const cacheLoaded = await loadFromLocalCache();
        if (!cacheLoaded) {
          setRankingData([]);
          setBiofertilizerData([]);
        }
      }

    } catch (error) {
      console.log('❌ Error general cargando reportes:', error);
      handleLoadError(error);
      
      // ✅ Último intento: cargar desde cache
      const cacheLoaded = await loadFromLocalCache();
      if (!cacheLoaded) {
        setRankingData([]);
        setBiofertilizerData([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isConnected, loadFromLocalCache, saveToLocalCache]);

  // Procesar datos de agricultores
  const processFarmersData = useCallback(async (farmers, userId) => {
    const rankingPromises = farmers.map(async (farmer) => {
      try {
        const crops = await scientistService.getFarmerCrops(userId, farmer._id || farmer.id);
        return {
          id: farmer._id || farmer.id,
          nombre: farmer.name || farmer.nombre,
          email: farmer.email,
          ubicacion: farmer.ubicacion,
          totalProyectos: crops?.length || 0,
          cultivos: crops || []
        };
      } catch (error) {
        return {
          id: farmer._id || farmer.id,
          nombre: farmer.name || farmer.nombre,
          totalProyectos: 0,
          cultivos: []
        };
      }
    });

    return await Promise.all(rankingPromises);
  }, []);

  // Manejar errores de carga
  const handleLoadError = useCallback((error) => {
    if (error.message.includes('401') || error.message.includes('Token')) {
      Alert.alert(
        'Sesión expirada', 
        'Por favor, vuelve a iniciar sesión',
        [{ text: 'OK', onPress: () => router.push('/login') }]
      );
    } else if (error.message.includes('Network') || error.message.includes('Timeout')) {
      // No mostrar alerta aquí, ya manejamos el estado connectionError
    }
  }, []);

  useEffect(() => {
    loadGlobalStats();
  }, [loadGlobalStats]);

  const onRefresh = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'No puedes actualizar los datos sin conexión a internet');
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setConnectionError(false);
    await loadGlobalStats(true); // Forzar refresh desde servidor
  }, [loadGlobalStats, isConnected]);

  const HeaderSection = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.title}>📊 Reportes y Estadísticas</Text>
      <Text style={styles.subtitle}>
        {connectionError ? "Error de conexión - Modo offline" :
         isConnected ? "Datos sincronizados" : "Modo offline"}
      </Text>
    </View>
  ), [isConnected, connectionError]);

  const StatsSection = useMemo(() => (
    <View style={styles.statsSection}>
      <Text style={styles.sectionTitle}>📈 Resumen General</Text>
      
      <View style={styles.statsGrid}>
        <StatCard 
          title="Agricultores Analizados"
          value={rankingData.length}
          icon="👥"
        />
        <StatCard 
          title="Proyectos Totales"
          value={rankingData.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)}
          icon="🌱"
        />
        <StatCard 
          title="Biofertilizantes"
          value={biofertilizerData.length}
          icon="🧪"
        />
      </View>
    </View>
  ), [rankingData, biofertilizerData]);

  const ChartsSection = useMemo(() => (
    <View style={styles.chartsSection}>
      <Text style={styles.sectionTitle}>📊 Gráficas de Análisis</Text>
      
      <FarmersRankingChart 
        data={rankingData}
        title="🏆 Ranking de Agricultores"
      />

      <BiofertilizerChart 
        data={biofertilizerData}
        title="🧪 Uso de Biofertilizantes"
      />
    </View>
  ), [rankingData, biofertilizerData]);

  const HelpSection = useMemo(() => (
    <View style={styles.helpSection}>
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>💡 Información del Reporte</Text>
        <View style={styles.helpList}>
          <HelpItem text="📊 Este reporte resume la actividad reciente y el rendimiento de los agricultores y sus cultivos" />
           <HelpItem text="📶 Si no hay internet, verás la última información guardada en tu dispositivo; los datos se sincronizarán cuando vuelvas a estar conectado" />
            <HelpItem text="⚙️ Los datos se actualizan automáticamente cuando hay conexión, reflejando información en tiempo real" />
             <HelpItem text="📈 Las gráficas te ayudan a comparar el desempeño entre agricultores y detectar áreas de mejora" />
        </View>
      </View>
    </View>
  ), [rankingData, biofertilizerData, dataSource]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#7b1fa2" />
        <Text style={styles.loadingText}>Cargando reportes...</Text>
        {connectionError && (
          <Text style={styles.loadingSubtext}>
            Recuperando datos desde cache...
          </Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          enabled={isConnected && !connectionError}
          colors={['#7b1fa2']}
          tintColor="#7b1fa2"
        />
      }
      showsVerticalScrollIndicator={true}
    >
      {HeaderSection}

      {StatsSection}
      {ChartsSection}
      {HelpSection}

      {/* ✅ Botón de reintento si hay error de conexión */}
      {connectionError && isConnected && (
        <View style={styles.retrySection}>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadGlobalStats(true)}>
            <Text style={styles.retryButtonText}>🔄 Reintentar conexión con servidor</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const HelpItem = React.memo(({ text }) => (
  <View style={styles.helpItem}>
    <Text style={styles.helpIcon}>•</Text>
    <Text style={styles.helpText}>{text}</Text>
  </View>
));

// Estilos actualizados con nuevos componentes
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 60,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
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
  // ✅ NUEVOS ESTILOS PARA BOTÓN DE REINTENTO
  retrySection: {
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#7b1fa2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // ... (el resto de los estilos se mantienen igual)
  statsSection: {
    marginBottom: 16,
  },
  chartsSection: {
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    columnGap: 12,
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
    marginHorizontal: 6,
    marginVertical: 6,
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
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  chartLoadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
  },
  chartLoadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  chartErrorContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
  },
  chartErrorText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 5,
  },
  chartErrorSubtext: {
    fontSize: 12,
    color: '#adb5bd',
    textAlign: 'center',
  },
  rankingLegend: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  rankingPosition: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#495057',
    width: 25,
  },
  rankingName: {
    fontSize: 12,
    color: '#495057',
    flex: 1,
    marginLeft: 8,
  },
  rankingProjects: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28a745',
  },
  biofertilizerStats: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  biofertilizerList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  listTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  biofertilizerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  biofertilizerName: {
    fontSize: 11,
    color: '#495057',
    flex: 1,
  },
  biofertilizerCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#28a745',
    marginLeft: 8,
  },
  moreText: {
    fontSize: 10,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
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