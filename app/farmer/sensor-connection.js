// app/farmer/sensor-connection.js - CON HISTORIAL SIMPLIFICADO
import React, { useCallback, useMemo } from "react";
import { 
  View, 
  Text, 
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useBle } from '../../contexts/BleContext';

// Constantes para estados de humedad
const HUMIDITY_STATUS = {
  noData: { level: "Sin datos", color: "#666", icon: "❓", advice: "Conecta el sensor para ver la humedad" },
  low: { level: "Baja", color: "#f44336", icon: "⚠️", advice: "Necesita riego urgente" },
  optimal: { level: "Óptima", color: "#4caf50", icon: "✅", advice: "Humedad ideal" },
  high: { level: "Alta", color: "#2196f3", icon: "💧", advice: "Suelo húmedo" }
};




const HUMIDITY_LEVELS = [
  { color: '#f44336', text: 'Baja (0-30%): Necesita riego urgente' },
  { color: '#4caf50', text: 'Óptima (30-60%): Condiciones ideales' },
  { color: '#2196f3', text: 'Alta (60-100%): Suelo húmedo' }
];

export default function SensorConnectionScreen() {
  const {
    humidity,
    status,
    isConnected,
    deviceName,
    connectionError,
    lastUpdate,
    isScanning,
    devicesList,
    disconnectDevice,
    connectToDevice,
    scanForDevices,
    stopScan,
    humidityHistory, // ✅ Nuevo: historial de humedad
  } = useBle();

  // Memoizar valores computados
  const humidityStatus = useMemo(() => {
    if (humidity === null) return HUMIDITY_STATUS.noData;
    if (humidity < 30) return HUMIDITY_STATUS.low;
    if (humidity < 60) return HUMIDITY_STATUS.optimal;
    return HUMIDITY_STATUS.high;
  }, [humidity]);

  const formattedTime = useMemo(() => {
    if (!lastUpdate) return '--:--:--';
    return lastUpdate.toLocaleTimeString('es-MX');
  }, [lastUpdate]);

  // ✅ NUEVO: Formatear historial de humedad - SIMPLIFICADO
  const formattedHistory = useMemo(() => {
    if (!humidityHistory || humidityHistory.length === 0) {
      return [];
    }
    
    // Tomar los últimos 5 datos y formatearlos
    return humidityHistory
      .slice(-5) // Últimos 5 elementos
      .map((item) => ({
        ...item,
        time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString('es-MX', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }) : '--:--:--'
      }))
      .reverse(); // Mostrar del más reciente al más antiguo
  }, [humidityHistory]);

  // Funciones memoizadas
  const handleRefresh = useCallback(() => {
    if (!isConnected && !isScanning) {
      scanForDevices();
    }
  }, [isConnected, isScanning, scanForDevices]);

  const handleDeviceConnect = useCallback((device) => {
    connectToDevice(device.device);
  }, [connectToDevice]);

  // ✅ NUEVO: Renderizar historial de humedad - SIMPLIFICADO
  const renderHumidityHistory = useCallback(() => (
    <View style={styles.historyCard}>
      <Text style={styles.historyTitle}>📈 Historial de Humedad</Text>
      
      {formattedHistory.length > 0 ? (
        <View style={styles.historyList}>
          {formattedHistory.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyData}>
                <Text style={styles.historyValue}>{item.value}%</Text>
                <Text style={styles.historyTime}>{item.time}</Text>
              </View>
              <View style={[
                styles.historyStatus,
                { 
                  backgroundColor: 
                    item.value < 30 ? '#f44336' : 
                    item.value < 60 ? '#4caf50' : '#2196f3'
                }
              ]}>
                <Text style={styles.historyStatusText}>
                  {item.value < 30 ? 'Baja' : item.value < 60 ? 'Óptima' : 'Alta'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryText}>📊</Text>
          <Text style={styles.emptyHistoryText}>No hay datos históricos</Text>
          <Text style={styles.emptyHistorySubtext}>
            {isConnected ? 'Los datos aparecerán aquí' : 'Conecta el sensor para ver el historial'}
          </Text>
        </View>
      )}
    </View>
  ), [formattedHistory, isConnected]);

  // Renderizado de componentes (los demás se mantienen igual)
  const renderHumidityBar = useCallback(() => (
    <View style={styles.humidityBarContainer}>
      <View style={styles.humidityBar}>
        <View 
          style={[
            styles.humidityFill,
            { 
              width: `${humidity !== null ? Math.min(humidity, 100) : 0}%`,
              backgroundColor: humidityStatus.color
            }
          ]} 
        />
      </View>
      <View style={styles.humidityLabels}>
        <Text style={styles.humidityLabel}>0%</Text>
        <Text style={styles.humidityLabel}>50%</Text>
        <Text style={styles.humidityLabel}>100%</Text>
      </View>
    </View>
  ), [humidity, humidityStatus.color]);

  const renderControls = useCallback(() => (
    <View style={styles.controlsContainer}>
      {isConnected ? (
        <TouchableOpacity 
          style={[styles.controlButton, styles.disconnectButton]}
          onPress={disconnectDevice}
        >
          <Text style={styles.controlButtonText}>🔴 Desconectar</Text>
        </TouchableOpacity>
      ) : isScanning ? (
        <TouchableOpacity 
          style={[styles.controlButton, styles.stopButton]}
          onPress={stopScan}
        >
          <Text style={styles.controlButtonText}>⏹️ Detener Escaneo</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={[styles.controlButton, styles.connectButton]}
          onPress={scanForDevices}
        >
          <Text style={styles.controlButtonText}>🔍 Buscar Sensores</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [isConnected, isScanning, disconnectDevice, stopScan, scanForDevices]);

  const renderDevicesList = useCallback(() => (
    devicesList.length > 0 && !isConnected && (
      <View style={styles.devicesSection}>
        <Text style={styles.sectionTitle}>📋 Sensores Disponibles</Text>
        {devicesList.map((device) => (
          <View key={device.id} style={styles.deviceCardContainer}>
            <TouchableOpacity
              style={styles.deviceCard}
              onPress={() => handleDeviceConnect(device)}
            >
              <View style={styles.deviceHeader}>
                <View style={styles.deviceTitleContainer}>
                  <Text style={styles.deviceIcon}>📱</Text>
                  <View style={styles.deviceTitleText}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceId}>ID: {device.id}</Text>
                  </View>
                </View>
                <Text style={styles.connectText}>Conectar →</Text>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )
  ), [devicesList, isConnected, handleDeviceConnect]);

  const renderHelpSection = useCallback(() => (
    <View style={styles.helpCard}>
      <Text style={styles.helpTitle}>💡 Cómo usar</Text>
      <View style={styles.helpList}>
        {HELP_ITEMS.map((item, index) => (
          <View key={index} style={styles.helpItem}>
            <Text style={styles.helpIcon}>{item.icon}</Text>
            <Text style={styles.helpText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  ), []);

  const renderHumidityLevels = useCallback(() => (
    <View style={styles.levelsCard}>
      <Text style={styles.levelsTitle}>📊 Niveles de Humedad</Text>
      <View style={styles.levelsList}>
        {HUMIDITY_LEVELS.map((level, index) => (
          <View key={index} style={styles.levelItem}>
            <View style={[styles.levelColor, { backgroundColor: level.color }]} />
            <Text style={styles.levelText}>{level.text}</Text>
          </View>
        ))}
      </View>
    </View>
  ), []);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl 
          refreshing={false}
          onRefresh={handleRefresh}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📡 Conexión de Sensores</Text>
        <Text style={styles.subtitle}>Monitorea la humedad del suelo en tiempo real</Text>
      </View>

      {/* Tarjeta principal */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>🌡️</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Sensor de Humedad</Text>
              <Text style={styles.cardSubtitle}>
                {isConnected ? (deviceName || 'Dispositivo ESP32') : 'Desconectado'}
              </Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: humidityStatus.color }]}>
            <Text style={styles.statusText}>
              {humidityStatus.icon} {humidityStatus.level}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado:</Text>
            <Text style={styles.detailValue}>
              {isConnected ? '✅ Conectado' : isScanning ? '🔍 Escaneando' : '🔌 Desconectado'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Humedad actual:</Text>
            <Text style={[styles.detailValue, { color: humidityStatus.color }]}>
              {humidity !== null ? `${humidity}%` : '--%'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recomendación:</Text>
            <Text style={styles.detailValue}>{humidityStatus.advice}</Text>
          </View>
        </View>

        {/* Barra de humedad */}
        {renderHumidityBar()}

        {/* Controles */}
        {renderControls()}

        {/* Error */}
        {connectionError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{connectionError}</Text>
          </View>
        )}
      </View>

      {/* Lista de dispositivos */}
      {renderDevicesList()}

      {/* ✅ NUEVO: Historial de humedad - AHORA DESPUÉS DE SENSORES DISPONIBLES */}
      {renderHumidityHistory()}

      {/* Niveles de referencia */}
      {renderHumidityLevels()}

            {/* Información adicional */}
            <View style={styles.helpSection}>
              <View style={styles.helpCard}>
                <Text style={styles.helpTitle}>💡 Como usar</Text>
                <View style={styles.helpList}>
                  {[
                  '1️⃣ Activa el Bluetooth en tu dispositivo antes de iniciar la búsqueda.',
                  '2️⃣ Presiona "Buscar Sensores" para encontrar dispositivos cercanos.',
                  '3️⃣ Una vez conectado, observa la humedad del suelo en tiempo real.' ,
                  '4️⃣ Mantén el sensor limpio y evita enterrarlo completamente en agua.' ,
                  '5️⃣ Usa "Desconectar" cuando termines para liberar la conexión BLE.' ,
                  '⚠️ Si no aparece el sensor, asegúrate de que esté encendido y cerca (menos de 5 m).' ,
                            ].map((text, index) => (
                    <View key={index} style={styles.helpItem}>
                      <Text style={styles.helpIcon}>•</Text>
                      <Text style={styles.helpText}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Estilos actualizados con el nuevo componente de historial SIMPLIFICADO
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16, paddingBottom: 60 },
  header: { backgroundColor: '#2e7d32', padding: 20, borderRadius: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'white', textAlign: 'center', opacity: 0.9 },
  connectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 16 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusOnline: { backgroundColor: '#4caf50' },
  statusOffline: { backgroundColor: '#f44336' },
  statusText: { fontSize: 14, color: '#333', fontWeight: '500' },
  lastUpdateText: { fontSize: 12, color: '#666' },
  mainCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  cardIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  cardTitleText: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#666' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 100, alignItems: 'center' },
  cardDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  humidityBarContainer: { marginBottom: 16 },
  humidityBar: { width: '100%', height: 20, backgroundColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  humidityFill: { height: '100%', borderRadius: 10 },
  humidityLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  humidityLabel: { fontSize: 12, color: '#666' },
  controlsContainer: { marginBottom: 12 },
  controlButton: { padding: 12, borderRadius: 8, alignItems: 'center' },
  connectButton: { backgroundColor: '#4caf50' },
  disconnectButton: { backgroundColor: '#f44336' },
  stopButton: { backgroundColor: '#ff9800' },
  controlButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  errorContainer: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  errorIcon: { marginRight: 8 },
  errorText: { color: '#dc2626', fontSize: 14, fontWeight: '500', flex: 1 },
  devicesSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  deviceCardContainer: { marginBottom: 12 },
  deviceCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  deviceIcon: { fontSize: 20, marginRight: 12 },
  deviceTitleText: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  deviceId: { fontSize: 12, color: '#666' },
  connectText: { fontSize: 14, color: '#2196f3', fontWeight: '600' },
  helpCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  helpTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  helpList: { gap: 12 },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start' },
  helpIcon: { marginRight: 12, fontSize: 16 },
  helpText: { fontSize: 14, color: '#666', flex: 1, lineHeight: 20 },
  levelsCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  levelsTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  levelsList: { gap: 10 },
  levelItem: { flexDirection: 'row', alignItems: 'center' },
  levelColor: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  levelText: { fontSize: 14, color: '#666', flex: 1 },
  
  // ✅ NUEVOS ESTILOS PARA EL HISTORIAL SIMPLIFICADO
  historyCard: { 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  historyTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 16 
  },
  historyList: { 
    gap: 10 
  },
  historyItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8
  },
  historyData: { 
    flex: 1 
  },
  historyValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333',
    marginBottom: 2
  },
  historyTime: { 
    fontSize: 12, 
    color: '#666' 
  },
  historyStatus: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  historyStatusText: { 
    fontSize: 12, 
    color: 'white', 
    fontWeight: '600' 
  },
  emptyHistory: { 
    alignItems: 'center', 
    padding: 20 
  },
  emptyHistoryText: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center',
    marginBottom: 4
  },
  emptyHistorySubtext: { 
    fontSize: 14, 
    color: '#999', 
    textAlign: 'center' 
  },
  
  bottomSpacing: { height: 40 },
});