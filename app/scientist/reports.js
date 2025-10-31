// app/scientist/reports.js - VERSIÓN ACTUALIZADA SOLO FARMERS
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  Dimensions,
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { router } from 'expo-router';
import { useSync } from '../../contexts/SyncContext';
import { scientistService } from '../../services/scientistService';

const screenWidth = Dimensions.get('window').width;

// 🔥 Componente para Ranking de Agricultores - ACTUALIZADO
const FarmersRankingChart = ({ data, title }) => {
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
      
      <View style={styles.rankingLegend}>
        <Text style={styles.legendTitle}>🏆 Top Agricultores</Text>
        {data.slice(0, 5).map((farmer, index) => (
          <View key={index} style={styles.rankingItem}>
            <Text style={styles.rankingPosition}>#{index + 1}</Text>
            <Text style={styles.rankingName}>{farmer.name || farmer.nombre}</Text>
            <Text style={styles.rankingProjects}>{farmer.totalProyectos || farmer.projectCount || 0} proy.</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// 🔥 Componente para Biofertilizantes - MANTENIDO IGUAL
const BiofertilizerChart = ({ data, title }) => {
  const [ChartComponent, setChartComponent] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadChart = async () => {
      try {
        const chartKit = await import('react-native-chart-kit');
        
        if (chartKit.PieChart) {
          setChartComponent(() => chartKit.PieChart);
        } else {
          console.log('❌ PieChart no encontrado en react-native-chart-kit');
          setError(true);
        }
      } catch (err) {
        console.log('❌ Error cargando PieChart:', err);
        setError(true);
      }
    };

    loadChart();
  }, []);

  if (error || !data || data.length === 0) {
    return (
      <View style={styles.chartErrorContainer}>
        <Text style={styles.chartErrorText}>🧪 Gráfica no disponible</Text>
        <Text style={styles.chartErrorSubtext}>
          {!data || data.length === 0 ? 'No hay datos de biofertilizantes' : 'Error cargando gráfica'}
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

  // Colores para los biofertilizantes
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

  // Preparar datos para la gráfica de pastel
  const pieData = data.map((item, index) => ({
    name: item.biofertilizante || 'No especificado',
    population: item.totalProyectos || 1, // Mínimo 1 para evitar errores
    color: colors[index % colors.length],
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
      
      {/* Estadísticas adicionales */}
      <View style={styles.biofertilizerStats}>
        <Text style={styles.statsTitle}>📈 Resumen de Biofertilizantes</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{data.length}</Text>
            <Text style={styles.statLabel}>Tipos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {data.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Proyectos</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// Componente de tarjeta de estadística
const StatCard = ({ title, value, subtitle, color = '#7b1fa2' }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

export default function Reports() {
  const [rankingData, setRankingData] = useState([]);
  const [biofertilizerData, setBiofertilizerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSync();

  useEffect(() => {
    loadGlobalStats();
  }, []);

  // 🔥 CORRECCIÓN PRINCIPAL: Método actualizado para obtener farmers
  const loadGlobalStats = async () => {
    try {
      setLoading(true);
      console.log('📊 [REPORTS] Iniciando carga de estadísticas...');
      
      // 🔍 DEBUG: Verificar el usuario actual
      console.log('🔍 [DEBUG] Usuario actual:', {
        hasUser: !!user,
        userId: user?.id,
        userRole: user?.role
      });
      
      // Validar que tenemos un usuario con ID válido
      if (!user?.id) {
        console.log('❌ [REPORTS] No hay usuario autenticado');
        Alert.alert(
          'Sesión requerida', 
          'Por favor, inicia sesión para ver los reportes',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
        return;
      }
      
      // Validar que el ID sea un ObjectId válido
      const isValidId = user.id.match(/^[0-9a-fA-F]{24}$/);
      if (!isValidId) {
        console.log('❌ [REPORTS] ID de usuario inválido:', user.id);
        Alert.alert('Error', 'ID de usuario inválido. Por favor, vuelve a iniciar sesión.');
        return;
      }
      
      console.log('✅ [REPORTS] ID válido, solicitando estadísticas...');
      
      // 🔥 NUEVO MÉTODO: Obtener farmers primero como en farmer-details.js
      const farmers = await scientistService.getFarmers(user.id);
      console.log('✅ [REPORTS] Agricultores obtenidos:', farmers?.length || 0);

      if (!farmers || farmers.length === 0) {
        setRankingData([]);
        // Mantener biofertilizerData como estaba
        let biofertilizers = [];
        try {
          biofertilizers = await scientistService.getBiofertilizerStats(user.id);
        } catch (e) {
          console.log('⚠️ No se pudieron obtener biofertilizantes');
        }
        setBiofertilizerData(biofertilizers);
        return;
      }

      // 🔥 PROCESAR FARMERS PARA RANKING
      const rankingPromises = farmers.map(async (farmer) => {
        try {
          // Obtener cultivos de cada agricultor - igual que en farmer-details.js
          const crops = await scientistService.getFarmerCrops(user.id, farmer._id || farmer.id);
          return {
            id: farmer._id || farmer.id,
            nombre: farmer.name || farmer.nombre,
            email: farmer.email,
            ubicacion: farmer.ubicacion,
            totalProyectos: crops?.length || 0,
            cultivos: crops || []
          };
        } catch (error) {
          console.log(`Error obteniendo cultivos para ${farmer.name}:`, error);
          return {
            id: farmer._id || farmer.id,
            nombre: farmer.name || farmer.nombre,
            totalProyectos: 0,
            cultivos: []
          };
        }
      });

      const rankingResults = await Promise.all(rankingPromises);
      
      // Ordenar por total de proyectos (ranking)
      const sortedRanking = rankingResults
        .filter(farmer => farmer.totalProyectos > 0)
        .sort((a, b) => b.totalProyectos - a.totalProyectos);

      setRankingData(sortedRanking);

      // 🔥 OBTENER BIOFERTILIZANTES (método original)
      let biofertilizers = [];
      try {
        biofertilizers = await scientistService.getBiofertilizerStats(user.id);
      } catch (e) {
        console.log('⚠️ [REPORTS] Error con getBiofertilizerStats, usando datos de cultivos...');
        // Método alternativo: extraer de los cultivos obtenidos
        const allCrops = rankingResults.flatMap(farmer => farmer.cultivos);
        const biofertilizerStats = {};
        allCrops.forEach(crop => {
          const biofertilizer = crop.biofertilizante || crop.fertilizer || 'No especificado';
          if (!biofertilizerStats[biofertilizer]) {
            biofertilizerStats[biofertilizer] = 0;
          }
          biofertilizerStats[biofertilizer]++;
        });

        biofertilizers = Object.entries(biofertilizerStats).map(([name, count]) => ({
          biofertilizante: name,
          totalProyectos: count
        }));
      }

      setBiofertilizerData(biofertilizers);

      console.log('✅ [REPORTS] Datos cargados exitosamente:', {
        ranking: sortedRanking.length,
        biofertilizantes: biofertilizers.length
      });
      
    } catch (error) {
      console.log('❌ [REPORTS] Error crítico:', error);
      
      // Manejar diferentes tipos de error
      if (error.message.includes('401') || error.message.includes('Token')) {
        Alert.alert(
          'Sesión expirada', 
          'Por favor, vuelve a iniciar sesión',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
      } else if (error.message.includes('Network') || error.message.includes('Timeout')) {
        Alert.alert('Error de conexión', 'Verifica tu conexión a internet e intenta nuevamente.');
      } else {
        // Para otros errores, mostrar datos vacíos sin alerta
        console.log('⚠️ [REPORTS] Error no crítico, mostrando datos vacíos');
      }
      
      setRankingData([]);
      setBiofertilizerData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGlobalStats();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={styles.loadingText}>Cargando reportes...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>📊 Reportes y Estadísticas</Text>
        <Text style={styles.subtitle}>Análisis global de datos agrícolas</Text>
      </View>

      <View style={styles.content}>
        {/* Estadísticas Rápidas */}
        <View style={styles.quickStats}>
          <Text style={styles.sectionTitle}>📈 Resumen General</Text>
          <View style={styles.statsGrid}>
            <StatCard 
              title="Agricultores" 
              value={rankingData.length}
              color="#4caf50"
            />
            <StatCard 
              title="Biofertilizantes" 
              value={biofertilizerData.length}
              color="#2196f3"
            />
            <StatCard 
              title="Proyectos Totales" 
              value={rankingData.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)}
              color="#ff9800"
            />
          </View>
        </View>

        {/* 📊 GRÁFICA: Ranking de Agricultores */}
        <FarmersRankingChart 
          data={rankingData}
          title="🟩 Ranking de Agricultores"
        />

        {/* 📊 GRÁFICA: Comparativa de Biofertilizantes */}
        <BiofertilizerChart 
          data={biofertilizerData}
          title="🥧 Uso de Biofertilizantes"
        />

        {/* Información del Reporte */}
        <View style={styles.reportInfo}>
          <Text style={styles.reportInfoTitle}>📋 Información del Reporte</Text>
          <Text style={styles.reportInfoText}>
            • Agricultores analizados: {rankingData.length}
          </Text>
          <Text style={styles.reportInfoText}>
            • Proyectos en ranking: {rankingData.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)}
          </Text>
          <Text style={styles.reportInfoText}>
            • Biofertilizantes registrados: {biofertilizerData.length}
          </Text>
          <Text style={styles.reportInfoText}>
            • Fecha de generación: {new Date().toLocaleDateString('es-MX')}
          </Text>
          <Text style={styles.reportInfoText}>
            • Estado: {loading ? 'Cargando...' : 'Completado'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// Los estilos se mantienen igual
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
  content: {
    padding: 16,
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
  quickStats: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  // Estilos para gráficas
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
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
  // Estilos para el ranking
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
  // Estilos para biofertilizantes
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
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  statLabel: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 2,
  },
  // Información del reporte
  reportInfo: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 30,
  },
  reportInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  reportInfoText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 4,
  },
});