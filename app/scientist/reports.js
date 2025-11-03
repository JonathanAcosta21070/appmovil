// app/scientist/reports.js - VERSIÓN CON ESTILO DE HOME SCIENTIST
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity 
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

// 🔥 Componente para Biofertilizantes
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

// Componente de tarjeta de estadística - ACTUALIZADO CON ESTILO HOME SCIENTIST
const StatCard = ({ title, value, subtitle, color = '#7b1fa2' }) => (
  <View style={styles.statCard}>
    <View style={styles.statContent}>
      <Text style={styles.statIcon}>📊</Text>
      <View style={styles.statTextContainer}>
        <Text style={styles.statNumber}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={2}>{title}</Text>
      </View>
    </View>
  </View>
);

export default function Reports() {
  const [rankingData, setRankingData] = useState([]);
  const [biofertilizerData, setBiofertilizerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 🔹 Usar el contexto global - Mismo estilo que Home Scientist
  const { 
    isConnected, 
    isSyncing, 
    unsyncedCount, 
    user 
  } = useSync();

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
        <ActivityIndicator size="large" color="#7b1fa2" />
        <Text style={styles.loadingText}>Cargando reportes...</Text>
      </View>
    );
  }

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
        <Text style={styles.title}>📊 Reportes y Estadísticas</Text>
        <Text style={styles.subtitle}>
          Análisis global de datos agrícolas
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

      {/* 🔹 Estadísticas rápidas - Mismo estilo que Home Scientist */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>📈 Resumen General</Text>
        
        <View style={styles.statsGrid}>
          <StatCard 
            title="Agricultores Analizados"
            value={rankingData.length}
          />
          <StatCard 
            title="Biofertilizantes"
            value={biofertilizerData.length}
          />
          <StatCard 
            title="Proyectos Totales"
            value={rankingData.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)}
          />
        </View>
      </View>

      {/* 🔹 Gráficas de Reportes */}
      <View style={styles.chartsSection}>
        <Text style={styles.sectionTitle}>📊 Gráficas de Análisis</Text>
        
        {/* 📊 GRÁFICA: Ranking de Agricultores */}
        <FarmersRankingChart 
          data={rankingData}
          title="🏆 Ranking de Agricultores"
        />

        {/* 📊 GRÁFICA: Comparativa de Biofertilizantes */}
        <BiofertilizerChart 
          data={biofertilizerData}
          title="🧪 Uso de Biofertilizantes"
        />
      </View>

      {/* 🔹 Información adicional - Mismo estilo que Home Scientist */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información del Reporte</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Agricultores analizados: {rankingData.length}</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Proyectos en ranking: {rankingData.reduce((sum, item) => sum + (item.totalProyectos || 0), 0)}</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Biofertilizantes registrados: {biofertilizerData.length}</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Fecha de generación: {new Date().toLocaleDateString('es-MX')}</Text>
            </View>
          </View>
        </View>
      </View>

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
  // 🔹 HEADER - Mismo estilo que Home Scientist
  header: {
    backgroundColor: '#7b1fa2', // Color morado para científico
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
  // 🔹 SECCIONES
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
  // 🔹 ESTADÍSTICAS - Mismo estilo que Home Scientist
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16, // 🔹 Espacio vertical entre filas
    columnGap: 12, // 🔹 Espacio horizontal entre columnas
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
    marginHorizontal: 6, // 🔹 Espacio lateral
    marginVertical: 6,   // 🔹 Espacio entre tarjetas verticalmente
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
  // 🔹 GRÁFICAS
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
  // 🔹 SECCIÓN DE AYUDA
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
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});