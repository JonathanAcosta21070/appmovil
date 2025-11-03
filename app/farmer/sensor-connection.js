// app/farmer/sensor-connection.js - VERSIÓN CON MÁS ESPACIO AL FINAL
import React from "react";
import { 
  View, 
  Text, 
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useBle } from '../../contexts/BleContext';

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
  } = useBle();

  // ✅ FUNCIÓN LOCAL: getHumidityStatus
  const getHumidityStatus = (humidityValue) => {
    if (humidityValue === null) return { level: "Sin datos", color: "#666", icon: "❓", advice: "Conecta el sensor para ver la humedad" };
    if (humidityValue < 30) return { level: "Baja", color: "#f44336", icon: "⚠️", advice: "Necesita riego urgente" };
    if (humidityValue < 60) return { level: "Óptima", color: "#4caf50", icon: "✅", advice: "Humedad ideal" };
    return { level: "Alta", color: "#2196f3", icon: "💧", advice: "Suelo húmedo" };
  };

  const humidityStatus = getHumidityStatus(humidity);

  const formatTime = (date) => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('es-MX');
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl 
          refreshing={false}
          onRefresh={scanForDevices}
        />
      }
    >
      {/* Header con mismo estilo que Crop List */}
      <View style={styles.header}>
        <Text style={styles.title}>📡 Conexión de Sensores</Text>
        <Text style={styles.subtitle}>Monitorea la humedad del suelo en tiempo real</Text>
      </View>

      {/* Información de conexión */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : isScanning ? 'Escaneando...' : 'Desconectado'}
          </Text>
        </View>
        
        {lastUpdate && isConnected && (
          <Text style={styles.lastUpdateText}>
            🕒 {formatTime(lastUpdate)}
          </Text>
        )}
      </View>

      {/* Tarjeta principal de estado */}
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

        {/* Barra de humedad visual */}
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

        {/* Botones de control */}
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

        {connectionError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{connectionError}</Text>
          </View>
        )}
      </View>

      {/* Lista de dispositivos disponibles */}
      {devicesList.length > 0 && !isConnected && (
        <View style={styles.devicesSection}>
          <Text style={styles.sectionTitle}>📋 Sensores Disponibles</Text>
          {devicesList.map((device) => (
            <View key={device.id} style={styles.deviceCardContainer}>
              <TouchableOpacity
                style={styles.deviceCard}
                onPress={() => connectToDevice(device.device)}
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
      )}

      {/* Información de ayuda */}
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>💡 Cómo usar</Text>
        <View style={styles.helpList}>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>1️⃣</Text>
            <Text style={styles.helpText}>Presiona "Buscar Sensores" para encontrar dispositivos</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>2️⃣</Text>
            <Text style={styles.helpText}>Selecciona tu sensor ESP32 de la lista</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>3️⃣</Text>
            <Text style={styles.helpText}>Monitorea la humedad en tiempo real</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>4️⃣</Text>
            <Text style={styles.helpText}>Usa "Desconectar" cuando termines</Text>
          </View>
        </View>
      </View>

      {/* Niveles de referencia */}
      <View style={styles.levelsCard}>
        <Text style={styles.levelsTitle}>📊 Niveles de Humedad</Text>
        <View style={styles.levelsList}>
          <View style={styles.levelItem}>
            <View style={[styles.levelColor, { backgroundColor: '#f44336' }]} />
            <Text style={styles.levelText}>Baja (0-30%): Necesita riego urgente</Text>
          </View>
          <View style={styles.levelItem}>
            <View style={[styles.levelColor, { backgroundColor: '#4caf50' }]} />
            <Text style={styles.levelText}>Óptima (30-60%): Condiciones ideales</Text>
          </View>
          <View style={styles.levelItem}>
            <View style={[styles.levelColor, { backgroundColor: '#2196f3' }]} />
            <Text style={styles.levelText}>Alta (60-100%): Suelo húmedo</Text>
          </View>
        </View>
      </View>

      {/* Espacio al final para mejor scroll - MÁS ESPACIO como en Home Farmer */}
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
    paddingBottom: 60, // ✅ Más espacio al fondo como en Home Farmer
  },
  header: {
    backgroundColor: '#2e7d32',
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
  lastUpdateText: {
    fontSize: 12,
    color: '#666',
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
    minWidth: 100,
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
  humidityBarContainer: {
    marginBottom: 16,
  },
  humidityBar: {
    width: '100%',
    height: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  humidityFill: {
    height: '100%',
    borderRadius: 10,
    transition: 'width 0.5s ease-in-out',
  },
  humidityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  humidityLabel: {
    fontSize: 12,
    color: '#666',
  },
  controlsContainer: {
    marginBottom: 12,
  },
  controlButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#4caf50',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
  },
  stopButton: {
    backgroundColor: '#ff9800',
  },
  controlButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  devicesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  deviceCardContainer: {
    marginBottom: 12,
  },
  deviceCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  deviceTitleText: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
  },
  connectText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
  },
  helpCard: {
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
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  helpList: {
    gap: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpIcon: {
    marginRight: 12,
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  levelsCard: {
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
  levelsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  levelsList: {
    gap: 10,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  levelText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  bottomSpacing: {
    height: 40, // ✅ Más espacio para mejor experiencia de scroll
  },
});